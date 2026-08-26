// Vercel serverless function: secure OpenAI proxy for reviewing low-confidence
// OCR extractions. The OPENAI_API_KEY stays server-side and is never sent to the
// browser. Only OCR *text* reaches this endpoint — never the screenshot itself.
//
// AI review is opt-in in the UI (off by default) to keep the product's
// privacy-first promise intact; this endpoint is the protected path used only
// when a user explicitly turns it on.

const WINDOW_MS = 60_000; // 1 minute sliding window
const MAX_REQUESTS_PER_WINDOW = 20; // per client IP
const MAX_TEXT_LENGTH = 8000; // characters of OCR text accepted per request

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || '').split(',')[0].trim() || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }

  const body = typeof req.body === 'string' ? safeJsonParse(req.body) : req.body;
  const text = body?.text;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing OCR text.' });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(413).json({ error: 'OCR text too large.' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You extract structured trade data from OCR text. Return JSON only with instrument, direction, entryPrice, stopLoss, takeProfit, exitPrice, profitLoss, positionSize, notes. Use null when unclear.',
          },
          {
            role: 'user',
            content: `OCR text:\n${text}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(502).json({ error: 'OpenAI request failed', detail });
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content ?? '{}';
    return res.status(200).json(safeJsonParse(content) ?? {});
  } catch (error) {
    return res.status(500).json({ error: 'AI review failed', detail: error instanceof Error ? error.message : String(error) });
  }
}
