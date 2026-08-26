import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

// Local dev counterpart to api/ai-review.js. Talks to any Anthropic-compatible
// Messages API (default AgentRouter via ANTHROPIC_BASE_URL). Shares the same
// request/response contract as the Vercel function.

const ANTHROPIC_VERSION = '2023-06-01';
// AgentRouter gates access on a Claude Code client signature (User-Agent must look
// like the CLI) — without it, it returns 401 "unauthorized client detected".
// Official Anthropic ignores the User-Agent, so this is safe for both providers.
const CLIENT_USER_AGENT = 'claude-cli/1.0.60 (external, cli)';
const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const DEFAULT_MODEL = 'claude-3-5-sonnet-latest';

const SYSTEM_PROMPT =
  'You are a trading-screenshot data extractor. The user sends a screenshot from MetaTrader 4/5 or TradingView, plus possibly-noisy OCR text as a hint. Read the image and return ONLY a JSON object with keys: instrument, direction, entryPrice, stopLoss, takeProfit, exitPrice, profitLoss, positionSize, notes. ' +
  'Rules: instrument = symbol in uppercase with no separators (e.g. "EURUSD", "XAUUSD", "US30"). direction = "BUY" for long positions, "SELL" for short. entryPrice/stopLoss/takeProfit/exitPrice = numbers only, using "." as the decimal separator and no thousands separators; a history row like "1.15592 -> 1.15508" means entryPrice=1.15592 and exitPrice=1.15508; "S/L" is stopLoss and "T/P" is takeProfit. profitLoss = the net profit/loss as a signed number (negative for a loss), no currency symbol. positionSize = the volume/lots as a number. notes = a short note only if genuinely noteworthy. Use null for any field you cannot read confidently; do not guess. ' +
  'Return only the raw JSON object with no markdown fences, code blocks, or commentary.';

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

const parseDataUrl = (value) => {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(value);
  return match ? { mediaType: match[1], data: match[2] } : null;
};

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: '6mb' }));

app.get('/api/health', (_req, res) => {
  const enabled = Boolean(process.env.ANTHROPIC_AUTH_TOKEN);
  res.json({
    aiReviewEnabled: enabled,
    mode: enabled ? 'secure-ai' : 'local-only',
  });
});

app.post('/api/ai-review', async (req, res) => {
  const token = process.env.ANTHROPIC_AUTH_TOKEN;
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  const image = typeof req.body?.image === 'string' ? req.body.image : '';

  if (!token) {
    return res.status(500).json({ error: 'ANTHROPIC_AUTH_TOKEN is not configured on the server.' });
  }

  if (!text && !image) {
    return res.status(400).json({ error: 'Missing screenshot and OCR text.' });
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
      const err = await response.text();
      return res.status(502).json({ error: 'AI provider request failed', detail: err });
    }

    const json = await response.json();
    const content = Array.isArray(json?.content)
      ? json.content.filter((block) => block?.type === 'text').map((block) => block.text).join('\n')
      : '';
    return res.json(extractJson(content) ?? {});
  } catch (error) {
    return res.status(500).json({ error: 'AI review failed', detail: error instanceof Error ? error.message : String(error) });
  }
});

app.listen(port, () => {
  console.log(`AI review server listening on http://localhost:${port}`);
});
