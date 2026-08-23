# Trade Screenshot Journal v1.1

## V1.1 release notes

This release improves the product’s core trade-extraction workflow and makes the exported output more actionable for traders.

### Highlights

- stronger OCR parsing for real MT4/MT5 trade screenshot layouts
- better handling of decimal/separator noise and fragmented trade rows
- improved trade-block detection when multiple trade candidates appear in one image
- Excel export now includes a summary sheet and a P/L bar chart for multiple trades
- keeps the existing privacy-first, browser-only workflow with no server or database

### Business value

The app now converts screenshots into cleaner, more reviewable trade data faster, while still keeping screenshots and journal data entirely on the user’s device.

## Run locally

```bash
npm install
npm run dev
```

## Privacy

OCR uses Tesseract.js in the browser and the Excel workbook is generated locally. Screenshots and trade data remain in memory only—there is no backend, database, cloud storage, or external AI API.

## Deploy

This is a standard Vite static app. Connect its GitHub repository to Vercel; no environment variables are required.

## Notes

OCR quality still depends on screenshot clarity. Uncertain or missing fields are left blank and flagged for review so users can correct them before export.
