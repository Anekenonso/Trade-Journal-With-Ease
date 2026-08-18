# Trade Screenshot Journal

A privacy-first browser application that turns up to 15 MT4, MT5, or TradingView screenshots into an editable Excel trade journal.

## Run locally

```bash
npm install
npm run dev
```

## Privacy

OCR uses Tesseract.js in the browser and the Excel workbook is created locally with SheetJS. Screenshots and trade data are kept in memory only—there is no backend, account, database, cloud storage, or external AI API.

## Deploy

This is a standard Vite static app. Connect its GitHub repository to Vercel; no environment variables are required.

## Notes

OCR is inherently dependent on screenshot quality. Uncertain or missing fields are left blank and flagged for review; users can edit every value before export.
