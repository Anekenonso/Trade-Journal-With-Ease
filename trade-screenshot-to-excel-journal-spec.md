# AI Agent Build Specification — Trade Screenshot to Excel Journal

## 1. Project Overview

Build a lightweight, privacy-first web application that converts trading screenshots from **MT4, MT5, and TradingView** into a structured Excel trade journal.

The application must require:

* No user registration
* No login
* No database
* No permanent file storage
* No server-side image processing
* No mandatory external AI API
* No backend for V1

The application should process screenshots **locally inside the user's browser**, extract the available trade information, allow the user to review and correct the extracted data, generate an Excel file locally, and allow the user to download it.

### Core product promise

> Upload your trade screenshots. Extract your trade data. Download your Excel journal. Your data stays on your device.

Maximum upload limit:

**15 images per session.**

---

# 2. Core User Flow

Implement exactly this primary flow:

```text
Home
  ↓
Select 1–15 Images
  ↓
Image Preview / Confirmation
  ↓
Process Images
  ↓
Extract Trade Information
  ↓
Extraction Results
  ↓
Review / Edit
  ↓
Generate Excel
  ↓
Download Excel
  ↓
Start Over
```

No user data should persist between sessions.

---

# 3. Technology Architecture

## Frontend

Use:

* React
* TypeScript
* Vite
* HTML5
* CSS
* Responsive design

Do not use Next.js unless there is a compelling technical reason.

The application should remain a static client-side application that can be deployed to Vercel.

## Image Processing

Use browser-side processing.

Recommended technologies:

* Canvas API
* Browser File API
* Web Workers where appropriate
* Tesseract.js for OCR

Images must not be uploaded to a remote server during normal operation.

## Excel Generation

Use:

* SheetJS (`xlsx`)

Generate the `.xlsx` file entirely inside the browser.

## Hosting

Target deployment:

**Vercel**

The application should work as a static frontend.

It must also be compatible with GitHub-based continuous deployment.

## Storage

Do not implement:

* PostgreSQL
* MySQL
* MongoDB
* Supabase database
* Firebase database
* Cloud storage
* User accounts

The only temporary state should exist in browser memory during the current session.

---

# 4. Privacy Requirements

Privacy is a core product feature.

The application must NOT:

* Upload screenshots to a server
* Store screenshots remotely
* Store extracted trade information remotely
* Create user accounts
* Track individual trades
* Persist trade data after the session
* Send screenshots to third-party APIs by default

All image processing and Excel generation should happen locally.

The UI should clearly communicate:

> Your data stays on your device. We don't store your screenshots or trading data.

Do not make unsupported claims such as "100% secure."

---

# 5. Application Pages / States

## Screen 1 — Home

Create a clean professional landing interface.

Primary heading:

> Turn your trade screenshots into an Excel journal

Supporting text:

> Upload up to 15 screenshots from MT4, MT5 or TradingView. We'll extract the trade data and create an organized Excel file for you.

Primary CTA:

**Upload Trade Screenshots**

Supported formats:

* JPG
* JPEG
* PNG
* WEBP

Maximum:

**15 images**

Include a privacy indicator:

> 🔒 Your data stays on your device. We don't store your files.

Include creator branding discreetly:

> Built with ♥ by @symplyken

Place the creator credit in the footer rather than making it the dominant element.

The `@symplyken` text should be configurable as a link.

---

# 6. Screen 2 — Image Selection

After selecting images, display a preview grid.

Example:

```text
Selected Images (8 of 15)

[Image] [Image] [Image] [Image]
[Image] [Image] [Image] [Image]

+ Add more images

                    Process Images →
```

Each image must have:

* Thumbnail
* Filename
* Remove button

Display:

> 8 of 15 images selected

If the user attempts to select more than 15 images:

> You can upload a maximum of 15 images per session.

Do not silently discard files.

Allow the user to remove individual images.

Provide:

* Add Images
* Clear All
* Process Images

---

# 7. Screen 3 — Processing

Process images without freezing the browser.

Use Web Workers where appropriate.

Process images sequentially or in controlled batches rather than attempting to OCR all 15 images simultaneously.

Display progress:

```text
Processing your screenshots...

6 / 8 completed
```

Show individual statuses:

```text
✓ image_01.png       Extracted
✓ image_02.png       Extracted
✓ image_03.png       Extracted
⟳ image_04.png       Processing
○ image_05.png       Pending
```

Display a warning:

> Please don't close or refresh this page while processing.

The UI must remain responsive.

---

# 8. OCR / Extraction Engine

The extraction system should be designed specifically for trading screenshots.

Primary targets:

### MT4

Extract when available:

* Symbol
* Order type
* Entry price
* Stop Loss
* Take Profit
* Exit price
* Lot size
* Profit
* Date
* Time

### MT5

Extract when available:

* Symbol
* Direction
* Volume
* Entry
* Stop Loss
* Take Profit
* Exit
* Profit
* Date
* Time

### TradingView

Extract information that can reliably be identified from the screenshot.

Do NOT fabricate missing values.

If a value cannot be confidently extracted, leave it blank and mark the trade for review.

---

# 9. Extraction Data Model

Each extracted trade should use a structure similar to:

```typescript
interface Trade {
  id: string;
  sourceFileName: string;

  date?: string;
  time?: string;

  instrument?: string;
  direction?: "BUY" | "SELL";

  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  exitPrice?: number;

  positionSize?: number;
  profitLoss?: number;

  confidence: {
    instrument: number;
    direction: number;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    exitPrice: number;
    profitLoss: number;
  };

  needsReview: boolean;

  notes?: string;
}
```

Do not force values into fields when OCR is uncertain.

---

# 10. Data Validation

After OCR, validate extracted information.

Examples:

### Direction

Only accept:

```text
BUY
SELL
```

### Price

Reject obviously invalid OCR results.

### Instrument

Normalize common variations.

Examples:

```text
EUR/USD → EURUSD
GBP/USD → GBPUSD
XAU/USD → XAUUSD
```

Do not incorrectly normalize unknown instruments.

### P&L

Support:

```text
+$42.50
-$18.20
42.50
-18.20
```

### Missing data

If important information is missing:

```text
⚠ Needs Review
```

Do not invent information.

---

# 11. Screen 4 — Extracted Data

Display all extracted trades in a table.

Example columns:

| # | Instrument | Direction | Entry | SL | TP | Exit | P&L | Status |
| - | ---------- | --------- | ----: | -: | -: | ---: | --: | ------ |

Example status:

```text
✓ Extracted
⚠ Needs Review
```

Display a summary:

```text
8 trades extracted

7 extracted successfully
1 needs review
```

The user should be able to:

* Review all trades
* Edit individual trades
* Delete an incorrect trade
* Return to upload
* Continue to review

---

# 12. Screen 5 — Review & Edit

Create a dedicated trade review interface.

Display:

### Left side

The original screenshot.

### Right side

Editable fields:

```text
Instrument
Direction
Entry Price
Stop Loss
Take Profit
Exit Price
Position Size
P&L
Date
Time
```

Buttons:

* Previous
* Next
* Save Changes
* Delete Trade
* Back

If OCR identified a field with low confidence, visually indicate it.

Example:

```text
Entry Price
[ 1.08540 ] ⚠
```

The user must be able to manually correct every extracted value.

---

# 13. Calculated Fields

Where enough information is available, calculate:

### R-Multiple

For a completed trade:

```text
R Multiple = P&L / Risk Amount
```

However, do not calculate R if risk cannot reliably be determined.

### Trade Result

Automatically classify:

```text
WIN
LOSS
BREAKEVEN
```

based on P&L.

Do not overwrite manually entered information unnecessarily.

---

# 14. Excel Generation

Generate the Excel file entirely in the browser using SheetJS.

The workbook should contain:

## Sheet 1 — Trades

Columns:

```text
Trade #
Date
Time
Instrument
Direction
Entry Price
Stop Loss
Take Profit
Exit Price
Position Size
Profit/Loss
R-Multiple
Result
Source Image
```

## Sheet 2 — Summary

Include:

```text
Total Trades
Winning Trades
Losing Trades
Breakeven Trades
Win Rate
Total P&L
Average Win
Average Loss
Profit Factor
Average R-Multiple
```

Only calculate statistics when the required data exists.

Do not create misleading statistics from incomplete information.

---

# 15. Final Download Screen

After Excel generation, display:

```text
✓

All done!

Your Excel file is ready to download.

trade_journal_YYYY-MM-DD.xlsx

[ Download Excel File ]

Start Over
```

Include a subtle creator credit:

> Built with ♥ by @symplyken

The Download button should trigger a local browser download.

No file should be uploaded to a server.

---

# 16. Start Over

When the user clicks:

**Start Over**

clear all application state from memory.

Return to the Home screen.

Do not retain:

* Images
* Extracted trades
* Excel data
* User information

Use `URL.revokeObjectURL()` for generated object URLs where appropriate.

---

# 17. UI / UX Design

Create a professional fintech-style interface.

Design principles:

* Clean
* Minimal
* Modern
* Fast
* Mobile responsive
* Desktop optimized
* Easy for non-technical traders

Suggested visual direction:

* White / very light background
* Dark navy typography
* Blue primary actions
* Green success states
* Amber warning states
* Red destructive actions

Avoid excessive gradients, animations, glassmorphism, or decorative elements.

The application should look like a serious financial productivity tool.

---

# 18. Navigation

Use a simple navigation/sidebar where appropriate.

Suggested navigation:

```text
Trade Journal

Home
How It Works
Privacy
About
```

Do not create unnecessary pages.

The application should remain focused on the screenshot-to-Excel workflow.

---

# 19. Creator Branding

The application should visibly but professionally identify the creator.

Preferred wording:

> Built with ♥ by @symplyken

Use the credit primarily in:

* Footer/sidebar
* Home screen footer
* Final download screen

Do not make it dominate the product.

Make `@symplyken` a configurable link.

Create a single configuration value so the destination can be changed later without modifying multiple components.

---

# 20. Error Handling

Handle:

* Unsupported file types
* Corrupted images
* More than 15 images
* OCR failure
* Missing fields
* Invalid extracted values
* Browser memory issues
* Excel generation failure
* User cancelling processing

Examples:

```text
We couldn't read this image.
Try uploading a clearer screenshot.
```

```text
This image format isn't supported.
Please upload JPG, PNG or WEBP.
```

```text
Some trade information couldn't be identified.
Please review the highlighted fields.
```

Never crash the entire application because one image fails.

A failed image should be marked:

```text
⚠ Extraction failed
```

and allow the user to retry or manually enter the data.

---

# 21. Performance Requirements

The application must be designed for a maximum of 15 images.

Optimize images before OCR where appropriate.

Requirements:

* Do not process all 15 high-resolution images simultaneously.
* Use Web Workers for CPU-intensive OCR.
* Display processing progress.
* Keep the UI responsive.
* Release image/object memory after processing.
* Avoid unnecessary copies of large image blobs.
* Revoke object URLs when no longer required.

The application should work reasonably well on modern smartphones and laptops.

---

# 22. Privacy Architecture

The application should follow this data flow:

```text
User Device
    │
    ├── Screenshot
    │
    ├── OCR
    │
    ├── Extracted Trade Data
    │
    ├── Review
    │
    └── Excel Generation
            │
            ▼
       User Download
```

There should be **no arrow from the user's screenshot to an application server**.

Do not introduce external analytics that captures uploaded images or trade data.

If analytics are added in the future, they must be privacy-conscious and must not capture trade content.

---

# 23. Project Architecture

Use a clean modular structure:

```text
trade-journal/
│
├── public/
│
├── src/
│   ├── components/
│   │   ├── layout/
│   │   ├── upload/
│   │   ├── processing/
│   │   ├── trades/
│   │   └── export/
│   │
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Upload.tsx
│   │   ├── Processing.tsx
│   │   ├── Review.tsx
│   │   └── Download.tsx
│   │
│   ├── services/
│   │   ├── ocr/
│   │   ├── image/
│   │   ├── extraction/
│   │   └── excel/
│   │
│   ├── workers/
│   │   └── ocr.worker.ts
│   │
│   ├── types/
│   │   └── trade.ts
│   │
│   ├── utils/
│   │   ├── validation.ts
│   │   ├── calculations.ts
│   │   └── formatting.ts
│   │
│   ├── config/
│   │   └── app.ts
│   │
│   ├── App.tsx
│   └── main.tsx
│
├── tests/
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
└── .gitignore
```

Keep business logic separate from UI components.

---

# 24. State Management

Do not introduce Redux unless genuinely necessary.

Use React state/context or a lightweight state-management solution.

The current session should contain:

```text
Selected images
Processing status
Extracted trades
Review changes
Export status
```

Nothing should be persisted to a remote database.

Avoid `localStorage` for trade data unless explicitly required.

For the strongest privacy model, keep sensitive data in memory only.

---

# 25. Testing

Create tests for:

### Upload

* Accept valid image formats
* Reject invalid formats
* Reject >15 images

### Extraction

* Parse BUY/SELL
* Parse prices
* Parse P&L
* Handle missing fields
* Handle OCR errors

### Validation

* Invalid prices
* Missing instruments
* Invalid directions

### Excel

* Correct column headers
* Correct number of trades
* Correct calculated fields
* Workbook successfully downloads

### Privacy

Verify that no upload request containing screenshots is sent to an application backend.

---

# 26. Security Requirements

Even though there is no backend, follow secure frontend practices.

* Do not inject OCR output directly into HTML.
* Sanitize filenames before displaying them.
* Do not execute extracted text as code.
* Avoid unnecessary third-party scripts.
* Keep dependencies minimal.
* Keep dependencies updated.
* Do not expose API keys because V1 should not require any.

---

# 27. Future Architecture Compatibility

Do not build V1 in a way that makes future expansion difficult.

Future versions may introduce:

```text
V1
Browser-only
    ↓
OCR
    ↓
Excel
```

Then:

```text
V2
Browser
    ↓
Optional Python API
    ↓
Advanced extraction
```

Then potentially:

```text
V3
User Accounts
    ↓
Cloud Journal
    ↓
Historical Analytics
    ↓
AI Trade Analysis
    ↓
AI Trading Coach
```

Do NOT implement these future features now.

However, structure the extraction layer so that the OCR engine can later be replaced or supplemented by a Python/API-based extraction service without rewriting the entire UI.

---

# 28. Python Requirement

Python is not required in the production V1 because the zero-server requirement takes priority.

If Python is used during development, it may be used for:

* OCR experimentation
* Image preprocessing experiments
* Extraction algorithm testing
* Dataset generation
* Automated testing
* Future backend development

Do not create a Python FastAPI server simply to satisfy the use of Python.

The production V1 must prioritize:

> **Zero backend + client-side processing + zero persistent storage.**

---

# 29. Deployment

The application must be deployable to Vercel from GitHub.

Required deployment flow:

```text
Developer
   ↓
Git
   ↓
GitHub Repository
   ↓
Vercel
   ↓
Production URL
```

No database configuration should be required.

No environment variables should be required for the core V1.

The application should work after a standard Vercel deployment.

---

# 30. Definition of Done

The V1 is complete when a new user can:

1. Open the website.
2. Understand what the application does immediately.
3. Select up to 15 MT4, MT5 or TradingView screenshots.
4. See previews of the selected images.
5. Process the screenshots.
6. See extraction progress.
7. View extracted trade information.
8. Identify fields requiring review.
9. Edit incorrect information.
10. Delete an incorrect trade.
11. Generate an Excel workbook.
12. Download the Excel workbook.
13. Start over.
14. Complete the entire process without creating an account.
15. Complete the entire process without their screenshots being uploaded to a server.

The application should be functional, responsive, visually polished, modular, tested, and ready for deployment to Vercel.

---

# 31. Development Instructions for the AI Agent

Build the application incrementally.

### Phase 1

Set up:

* Vite
* React
* TypeScript
* Project structure
* Routing/state
* Base UI

### Phase 2

Implement:

* Home
* Image upload
* 15-image limit
* Preview grid
* Remove/clear functionality

### Phase 3

Implement:

* Client-side image processing
* Tesseract.js
* Web Worker OCR
* Extraction parser

### Phase 4

Implement:

* Extraction results
* Validation
* Review/edit interface

### Phase 5

Implement:

* SheetJS Excel generation
* Summary sheet
* Download

### Phase 6

Implement:

* Error handling
* Privacy messaging
* Creator branding
* Responsive design
* Performance optimization

### Phase 7

Implement:

* Unit tests
* End-to-end testing
* Production build
* Vercel deployment configuration
* README

At every stage, keep the application functional.

Do not add unnecessary dependencies or infrastructure.

Before adding any backend, database, authentication, API, or external service, verify whether it is actually required. For V1, the answer should normally be **no**.

The final product should feel like a polished, lightweight tool rather than a complex SaaS platform.

**Primary objective:**

> Build the simplest professional application that turns up to 15 trading screenshots into a clean downloadable Excel journal while keeping the user's data entirely on their device.
