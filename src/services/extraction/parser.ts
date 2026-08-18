import type { Confidence, Trade } from '../../types/trade';
import { normalizeInstrument, parseNumber, validDirection, needsReview } from '../../utils/validation';
const blankConfidence: Confidence = { instrument: 0, direction: 0, entryPrice: 0, stopLoss: 0, takeProfit: 0, exitPrice: 0, profitLoss: 0 };
const after = (text: string, patterns: RegExp[]) => { for (const p of patterns) { const m = text.match(p); if (m?.[1]) return m[1]; } return undefined; };
export const parseTrade = (text: string, sourceFileName: string, sourceUrl: string): Trade => {
  const instrumentRaw = after(text, [/\b([A-Z]{3}\s*[/\\-]?\s*[A-Z]{3})\b/i, /\b((?:XAU|XAG)\s*[/\\-]?\s*[A-Z]{3})\b/i]);
  const direction = validDirection(text);
  const field = (names: string[]) => parseNumber(after(text, names.map(n => new RegExp(`${n}\\s*[:=]?\\s*([+-]?[\\d,.]+)`, 'i'))));
  const entryPrice = field(['entry', 'open(?:\s*price)?', 'price']);
  const stopLoss = field(['stop\s*loss', '\\bsl\\b']); const takeProfit = field(['take\s*profit', '\\btp\\b']);
  const exitPrice = field(['exit', 'close(?:\s*price)?']); const positionSize = field(['volume', 'lot(?:\s*size)?', 'size']);
  const profitLoss = field(['profit(?:/loss)?', '\\bp\\s*&?\\s*l\\b', 'pnl']);
  const instrument = normalizeInstrument(instrumentRaw);
  const confidence = { ...blankConfidence, instrument: instrument ? 0.9 : 0, direction: direction ? 0.95 : 0, entryPrice: entryPrice === undefined ? 0 : 0.7, stopLoss: stopLoss === undefined ? 0 : 0.7, takeProfit: takeProfit === undefined ? 0 : 0.7, exitPrice: exitPrice === undefined ? 0 : 0.7, profitLoss: profitLoss === undefined ? 0 : 0.75 };
  const draft = { instrument, direction, entryPrice, stopLoss, takeProfit, exitPrice, positionSize, profitLoss };
  return { id: crypto.randomUUID(), sourceFileName, sourceUrl, ...draft, confidence, needsReview: needsReview(draft) };
};
