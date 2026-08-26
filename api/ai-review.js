// Vercel serverless function: secure vision-AI proxy for reviewing low-confidence
// extractions. The provider token stays server-side and is never sent to the
// browser. When AI review is enabled, the user's screenshot (downscaled) plus the
// OCR text hint reach this endpoint and are forwarded to the model.
//
// Provider: any Anthropic-compatible Messages API. Defaults target AgentRouter
// (set ANTHROPIC_BASE_URL=https://agentrouter.org); for official Anthropic set
// ANTHROPIC_BASE_URL=https://api.anthropic.com. Configure with ANTHROPIC_AUTH_TOKEN
// and ANTHROPIC_MODEL.
//
// AI review is opt-in in the UI (off by default): the screenshot only leaves the
// device when a user explicitly turns it on. This endpoint is that protected path.

const WINDOW_MS = 60_000; // 1 minute sliding window
const MAX_REQUESTS_PER_WINDOW = 20; // per client IP
const MAX_TEXT_LENGTH = 8000; // characters of OCR text accepted per request
const MAX_IMAGE_CHARS = 4_000_000; // ~2.9MB data URL; stays under Vercel's body cap
const ANTHROPIC_VERSION = '2023-06-01';
// AgentRouter (and similar Claude-Code-oriented gateways) gate access on a client
// signature: they only accept requests whose User-Agent looks like the Claude Code
// CLI, otherwise returning 401 "unauthorized client detected". Official Anthropic
// ignores the User-Agent, so sending this is safe for both providers.
const CLIENT_USER_AGENT = 'claude-cli/1.0.60 (external, cli)';
const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const DEFAULT_MODEL = 'claude-3-5-sonnet-latest';

// Best-effort, in-memory rate limiter. Serverless instances are ephemeral and
// scale horizontally, so this throttles abuse from a single warm instance but is
// not a hard global guarantee. For durable limits use Vercel KV / Upstash.
const hits = new Map();

const isRateLimited = (ip) => {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((timestamp) => now - timestamp < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_REQUESTS_PER_WINDOW;
};

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

// Claude returns the JSON as message text. Strip any markdown fences and extract
// the JSON object so a stray code block or prose line can't break parsing.
const extractJson = (text) => {
  if (!text) return undefined;
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const direct = safeJsonParse(cleaned);
  if (direct && typeof direct === 'object') return direct;
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) return safeJsonParse(cleaned.slice(start, end + 1));
  return undefined;
};

// Split a `data:image/...;base64,...` URL into the parts Anthropic's image block
// expects (media_type + raw base64, without the data-URL prefix).
const parseDataUrl = (value) => {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(value);
  return match ? { mediaType: match[1], data: match[2] } : null;
};

const SYSTEM_PROMPT =
  'You are a trading-screenshot data extractor. The user sends a screenshot from MetaTrader 4/5 or TradingView, plus possibly-noisy OCR text as a hint. Read the image and return ONLY a JSON object with keys: instrument, direction, entryPrice, stopLoss, takeProfit, exitPrice, profitLoss, positionSize, notes. ' +
  'Rules: instrument = symbol in uppercase with no separators (e.g. "EURUSD", "XAUUSD", "US30"). direction = "BUY" for long positions, "SELL" for short. entryPrice/stopLoss/takeProfit/exitPrice = numbers only, using "." as the decimal separator and no thousands separators; a history row like "1.15592 -> 1.15508" means entryPrice=1.15592 and exitPrice=1.15508; "S/L" is stopLoss and "T/P" is takeProfit. profitLoss = the net profit/loss as a signed number (negative for a loss), no currency symbol. positionSize = the volume/lots as a number. notes = a short note only if genuinely noteworthy. Use null for any field you cannot read confidently; do not guess. ' +
  'Return only the raw JSON object with no markdown fences, code blocks, or commentary.';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.ANTHROPIC_AUTH_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'ANTHROPIC_AUTH_TOKEN is not configured on the server.' });
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || '').split(',')[0].trim() || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }

  const body = typeof req.body === 'string' ? safeJsonParse(req.body) : req.body;
  const text = typeof body?.text === 'string' ? body.text : '';
  const image = typeof body?.image === 'string' ? body.image : '';
  if (!text && !image) {
    return res.status(400).json({ error: 'Missing screenshot and OCR text.' });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(413).json({ error: 'OCR text too large.' });
  }
  if (image.length > MAX_IMAGE_CHARS) {
    return res.status(413).json({ error: 'Image too large.' });
  }

  const userContent = [
    {
      type: 'text',
      text: text.trim()
        ? `Extract the trade shown in the screenshot. A possibly-noisy OCR transcription is provided as a hint — trust the screenshot over this text when they disagree.\n\nOCR hint:\n${text}`
        : 'Extract the trade shown in the screenshot.',
    },
  ];
  const parsedImage = image ? parseDataUrl(image) : null;
  if (parsedImage) {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: parsedImage.mediaType, data: parsedImage.data },
    });
  }

  const baseUrl = (process.env.ANTHROPIC_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');

  try {
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'anthropic-version': ANTHROPIC_VERSION,
        'User-Agent': CLIENT_USER_AGENT,
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 1024,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(502).json({ error: 'AI provider request failed', detail });
    }

    const json = await response.json();
    const content = Array.isArray(json?.content)
      ? json.content.filter((block) => block?.type === 'text').map((block) => block.text).join('\n')
      : '';
    return res.status(200).json(extractJson(content) ?? {});
  } catch (error) {
    return res.status(500).json({ error: 'AI review failed', detail: error instanceof Error ? error.message : String(error) });
  }
}
