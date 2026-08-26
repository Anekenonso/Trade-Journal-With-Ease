# Trade Screenshot Journal v1.3

## V1.3 release notes

This release upgrades AI review to a **vision model** and switches the backend to
an Anthropic-compatible Messages API (AgentRouter by default), fixing weak
extraction on real MT4/MT5 screenshots.

### Highlights

- **AI review now reads the screenshot itself**, not just the OCR text. The
  downscaled image is sent to a vision-capable model (`claude-opus-4-8`), which
  extracts the trade directly and overrides noisy OCR — a large accuracy win on
  real MetaTrader layouts.
- **Backend moved to the Anthropic-compatible Messages API**, defaulting to
  AgentRouter (`ANTHROPIC_BASE_URL=https://agentrouter.org`). Official Anthropic
  still works by pointing `ANTHROPIC_BASE_URL` at `api.anthropic.com`. Configure
  with `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_MODEL`.
- **Privacy promise unchanged**: AI review is still opt-in and off by default,
  and the provider token stays server-side. The privacy copy now states plainly
  that the screenshot leaves the device when AI review is turned on.
- **Fixed a Windows + Vite 8 test crash** by switching Vitest to the `forks`
  pool, and added a test covering the screenshot-upload path.

## V1.2 release notes

This release makes secure AI review work in production, fixes an MT5 exit-price
extraction bug, and adds automated test coverage.

### Highlights

- **Secure AI review now runs in production**, served by Vercel serverless
  functions (`/api/health`, `/api/ai-review`) instead of only the local Express
  server. Set `ANTHROPIC_AUTH_TOKEN` in your Vercel project to enable it.
- **AI review is opt-in (off by default) and rate-limited**, with a payload-size
  cap, keeping the privacy-first promise intact.
- **Fixed an MT5 history bug** where the exit price was extracted as the entry
  price for every trade (a nested capturing-group regex issue).
- **Added automated tests** for P/L calculations, the MT5 parser, the AI
  enhancement layer, and the Excel workbook builder.
- Removed dead imports.

## V1.1 release notes

This release improves the product’s core trade-extraction workflow and makes the exported output more actionable for traders.

### Highlights

- stronger OCR parsing for real MT4/MT5 trade screenshot layouts
- better handling of decimal/separator noise and fragmented trade rows
- improved trade-block detection when multiple trade candidates appear in one image
- Excel export now includes a summary sheet and a P/L bar chart for multiple trades
- added a secure AI review layer for low-confidence extractions without exposing the API key in the browser (opt-in, off by default)
- local-only privacy mode is available when AI review is disabled or unavailable

### Business value

The app now converts screenshots into cleaner, more reviewable trade data faster, while preserving the user’s privacy-first workflow. If the user enables AI review, the enhancement runs through a protected backend so the provider token stays off the client.

## Run locally

### Local-only privacy mode

```bash
npm install
npm run dev
```

### Secure AI review mode

```bash
npm install
npm run dev:all
```

This starts the Vite frontend and the Express AI review server together. The backend reads `ANTHROPIC_AUTH_TOKEN` (and optional `ANTHROPIC_BASE_URL` / `ANTHROPIC_MODEL`) from `.env`, while the browser never sees it.

## Privacy

By default, OCR uses Tesseract.js in the browser and the Excel workbook is generated locally — screenshots and trade data never leave the device. AI review is opt-in and off by default; when you turn it on, the screenshot (plus the OCR text as a hint) is sent to the secure backend and forwarded to a vision-capable model (Claude via AgentRouter by default) for analysis. Turn it off to stay fully local.

## Deploy

Deploy to Vercel from GitHub with zero config — Vercel detects Vite, builds the
static frontend, and serves the functions in `api/` (`/api/health`,
`/api/ai-review`) as serverless endpoints on the same origin.

- **Core V1 needs no environment variables.** With no `ANTHROPIC_AUTH_TOKEN` set, the
  app runs entirely local-only (screenshots and trade data never leave the
  browser).
- **To enable secure AI review in production**, add `ANTHROPIC_AUTH_TOKEN` to your
  Vercel project's Environment Variables (plus `ANTHROPIC_BASE_URL=https://agentrouter.org`
  to route through AgentRouter). The token stays server-side inside the serverless
  function and is never shipped to the client.
- **AI review is opt-in.** Even when the backend is available, it stays off until
  the user turns it on with the in-app toggle. When enabled, the screenshot (plus
  the OCR text as a hint) is sent to a vision model for analysis; with it off,
  nothing leaves the browser.
- **The model is configurable** via the `ANTHROPIC_MODEL` env var (e.g.
  `claude-opus-4-8`; a smaller model such as `claude-3-5-haiku` lowers cost). The
  backend calls an Anthropic-compatible Messages API, so AgentRouter or official
  Anthropic both work — switch with `ANTHROPIC_BASE_URL`.
- The `/api/ai-review` endpoint applies best-effort in-memory rate limiting and a
  payload-size cap to protect the key from abuse. For strong global limits, back
  it with Vercel KV / Upstash.

The standalone Express server in `server/` remains for local development
(`npm run dev:all`); it and the `api/` functions share the same request/response
contract.

## Notes

OCR quality still depends on screenshot clarity. Uncertain or missing fields are left blank and flagged for review so users can correct them before export. If AI review is unavailable or disabled, the app automatically falls back to the local parsing pipeline.
