import type { Confidence, Trade } from '../../types/trade';
import { normalizeInstrument, parseNumber, validDirection, needsReview } from '../../utils/validation';

const blankConfidence: Confidence = { instrument: 0, direction: 0, entryPrice: 0, stopLoss: 0, takeProfit: 0, exitPrice: 0, profitLoss: 0 };

const normalizeOcrText = (text: string) =>
  text
    .replace(/[\u2012\u2013\u2014]/g, '-')
    .replace(/[\u2192]/g, '>')
    .replace(/\r/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();

const matchFirst = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1];
  }
  return undefined;
};

const splitTradeBlocks = (text: string) => {
  const candidates = [...text.matchAll(/\b([A-Z]{3,10}(?:\s*[/\\-]?\s*[A-Z]{3,10})?)\s*(?:,|\s+)\s*(BUY|SELL)\s+([0-9][0-9.,]+)/gi)];
  if (!candidates.length) return [text];

  const blocks: string[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const start = candidates[i].index ?? 0;
    const end = candidates[i + 1]?.index ?? text.length;
    blocks.push(text.slice(start, end).trim());
  }
  return blocks;
};

const scoreTradeBlock = (text: string) => {
  let score = 0;
  if (/\b(BUY|SELL)\b/i.test(text)) score += 3;
  if (/\b[A-Z]{3,10}\s*[/\\-]?\s*[A-Z]{3,10}\b/i.test(text)) score += 3;
  if (/([0-9][0-9.,]+)\s*(?:>|->|→|~)\s*([0-9][0-9.,]+)/i.test(text)) score += 4;
  if (/S\s*[/\\-]?\s*L\s*[:=]?\s*[0-9]/i.test(text)) score += 2;
  if (/T\s*[/\\-]?\s*P\s*[:=]?\s*[0-9]/i.test(text)) score += 2;
  if (/[+-]\s*[0-9][0-9.,]+/.test(text)) score += 2;
  return score;
};

const parseTradeBlock = (text: string) => {
  const symbolMatch = text.match(/\b([A-Z]{3,6}(?:\s*[/\\-]?\s*[A-Z]{3,6})?)\b(?=(?:\s*[,/\\-]?\s*|\s+)(?:BUY|SELL)\b)/i);
  const directionMatch = text.match(/\b(BUY|SELL)\b/i);
  const priceLine = text.match(/([0-9]+(?:[.,]\d{3,}))\s*(?:>|->|→|~)\s*([0-9]+(?:[.,]\d{3,}))\s*([+-]?\s*[0-9]+(?:[.,]\d+)?)/i)
    ?? text.match(/([0-9]+(?:[.,]\d{3,}))\s+([0-9]+(?:[.,]\d{3,}))\s+([+-]?\s*[0-9]+(?:[.,]\d+)?)/i)
    ?? text.match(/([0-9]+(?:[.,]\d{2,}))\s+([0-9]+(?:[.,]\d{2,}))\s+([+-]?\s*[0-9]+(?:[.,]\d+)?)/i);
  const stopMatch = text.match(/S\s*[/\\-]?\s*L\s*[:=]?\s*([0-9][0-9.,]+)/i);
  const takeMatch = text.match(/T\s*[/\\-]?\s*P\s*[:=]?\s*([0-9][0-9.,]+)/i);

  const fallbackPriceCandidates = (() => {
    const rawText = priceLine ? text.slice((priceLine.index ?? 0) + priceLine[0].length) : text;
    const prices = [...rawText.matchAll(/\b\d+(?:[.,]\d{4,})\b/g)]
      .map(match => parseNumber(match[0]))
      .filter((value): value is number => value !== undefined)
      .filter(value => value >= 0.0001 && value <= 9999);
    return prices;
  })();

  const stopLoss = stopMatch ? parseNumber(stopMatch[1]) : fallbackPriceCandidates[0];
  const takeProfit = takeMatch ? parseNumber(takeMatch[1]) : fallbackPriceCandidates[1];

  return {
    instrument: symbolMatch ? normalizeInstrument(symbolMatch[1]) : undefined,
    direction: directionMatch ? validDirection(directionMatch[1]) : undefined,
    entryPrice: priceLine ? parseNumber(priceLine[1]) : undefined,
    exitPrice: priceLine ? parseNumber(priceLine[2]) : undefined,
    stopLoss,
    takeProfit,
    profitLoss: priceLine ? parseNumber(priceLine[3]) : undefined,
    positionSize: parseNumber(matchFirst(text, [/\bvolume\s*[:=]?\s*([0-9][0-9.,]+)/i, /\blot(?:\s*size)?\s*[:=]?\s*([0-9][0-9.,]+)/i])),
  };
};

export const parseTrade = (text: string, sourceFileName: string, sourceUrl: string): Trade => {
  const normalized = normalizeOcrText(text);
  const blocks = splitTradeBlocks(normalized);
  const blockText = blocks
    .map(block => ({ block, score: scoreTradeBlock(block) }))
    .sort((a, b) => b.score - a.score)[0]?.block ?? normalized;

  const parsed = parseTradeBlock(blockText);
  const instrument = parsed.instrument;
  const direction = parsed.direction;
  const entryPrice = parsed.entryPrice;
  const exitPrice = parsed.exitPrice;
  const stopLoss = parsed.stopLoss;
  const takeProfit = parsed.takeProfit;
  const positionSize = parsed.positionSize;
  const profitLoss = parsed.profitLoss;

  const confidence = {
    ...blankConfidence,
    instrument: instrument ? 0.9 : 0,
    direction: direction ? 0.95 : 0,
    entryPrice: entryPrice === undefined ? 0 : 0.7,
    stopLoss: stopLoss === undefined ? 0 : 0.7,
    takeProfit: takeProfit === undefined ? 0 : 0.7,
    exitPrice: exitPrice === undefined ? 0 : 0.7,
    profitLoss: profitLoss === undefined ? 0 : 0.75,
  };

  const draft = {
    instrument,
    direction,
    entryPrice,
    stopLoss,
    takeProfit,
    exitPrice,
    positionSize,
    profitLoss,
  };

  return {
    id: crypto.randomUUID(),
    sourceFileName,
    sourceUrl,
    ...draft,
    confidence,
    needsReview: needsReview(draft),
  };
};
