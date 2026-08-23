import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    aiReviewEnabled: Boolean(process.env.OPENAI_API_KEY),
    mode: process.env.OPENAI_API_KEY ? 'secure-ai' : 'local-only',
  });
});

app.post('/api/ai-review', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const { text } = req.body || {};

  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });
  }

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing OCR text.' });
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
        messages: [
          {
            role: 'system',
            content: 'You extract structured trade data from OCR text. Return JSON only with instrument, direction, entryPrice, stopLoss, takeProfit, exitPrice, profitLoss, positionSize, notes. Use null when unclear.',
          },
          {
            role: 'user',
            content: `OCR text:\n${text}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: 'OpenAI request failed', detail: err });
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content);
    return res.json(parsed);
  } catch (error) {
    return res.status(500).json({ error: 'AI review failed', detail: error instanceof Error ? error.message : String(error) });
  }
});

app.listen(port, () => {
  console.log(`AI review server listening on http://localhost:${port}`);
});
