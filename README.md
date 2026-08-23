# Trade Screenshot Journal v1.1

## V1.1 release notes

This release improves the product’s core trade-extraction workflow and makes the exported output more actionable for traders.

### Highlights

- stronger OCR parsing for real MT4/MT5 trade screenshot layouts
- better handling of decimal/separator noise and fragmented trade rows
- improved trade-block detection when multiple trade candidates appear in one image
- Excel export now includes a summary sheet and a P/L bar chart for multiple trades
- added a secure AI review layer for low-confidence extractions without exposing the API key in the browser
- local-only privacy mode is available when AI review is disabled or unavailable

### Business value

The app now converts screenshots into cleaner, more reviewable trade data faster, while preserving the user’s privacy-first workflow. If the user enables AI review, the enhancement runs through a protected backend so the OpenAI key stays off the client.

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

This starts the Vite frontend and the Express AI review server together. The backend reads `OPENAI_API_KEY` from `.env`, while the browser never sees it.

## Privacy

By default, OCR uses Tesseract.js in the browser and the Excel workbook is generated locally. Screenshots and trade data remain on-device unless the user explicitly enables the optional secure AI review backend.

## Deploy

This app can be deployed as a Vite static frontend. For secure AI review in production, use a server-side proxy or hosted backend to keep the API secret out of the browser.

## Notes

OCR quality still depends on screenshot clarity. Uncertain or missing fields are left blank and flagged for review so users can correct them before export. If AI review is unavailable or disabled, the app automatically falls back to the local parsing pipeline.
