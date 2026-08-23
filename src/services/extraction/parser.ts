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
  const directionMatch = text.match(/\b(BUY|SELL)\b/i);
  const symbolMatch = text.match(/\b([A-Z]{3,6}(?:\s*[/\\-]?\s*[A-Z]{3,6})?)(?=\s*(?:,|\s+)?\s*(?:BUY|SELL)\b)/i) ??
    (directionMatch && directionMatch.index !== undefined ? text.slice(0, directionMatch.index).match(/([A-Z]{3,6}(?:\s*[/\\-]?\s*[A-Z]{3,6})?)$/i) : undefined);
  const stopMatch = text.match(/S\s*[/\\-]?\s*L\s*[:=]?\s*([0-9][0-9.,]+)/i);
  const takeMatch = text.match(/T\s*[/\\-]?\s*P\s*[:=]?\s*([0-9][0-9.,]+)/i);

  const numberTokens = [...text.matchAll(/[+-]?\d+(?:[.,]\d+)?/g)].map(match => ({
    value: parseNumber(match[0]),
    index: match.index ?? 0,
    text: match[0],
  })).filter(entry => entry.value !== undefined);

  const selectBestPriceSequence = () => {
    let best: { first: number; second: number; third: number; score: number } | undefined;

    for (let i = 0; i + 2 < numberTokens.length; i++) {
      const first = numberTokens[i].value as number;
      const second = numberTokens[i + 1].value as number;
      const third = numberTokens[i + 2].value as number;

      if (first <= 0.5 || second <= 0.5) continue;
      if (first > 10000 || second > 10000 || third > 10000) continue;

      const hasArrow = />|->|→|~/i.test(text.slice(numberTokens[i].index, numberTokens[i + 2].index + numberTokens[i + 2].text.length));
      const hasPnlSignal = /[+-]/.test(numberTokens[i + 2].text) || /P&L|P\/L|profit|loss/i.test(text);
      const score = (first >= 0.8 && second >= 0.8 ? 5 : 0) + (hasArrow ? 3 : 0) + (hasPnlSignal ? 3 : 0) + (Math.abs(third) <= 500 ? 2 : 0);

      if (!best || score > best.score) {
        best = { first, second, third, score };
      }
    }

    return best;
  };

  const priceSequence = selectBestPriceSequence();

  return {
    instrument: symbolMatch ? normalizeInstrument(symbolMatch[1]) : undefined,
    direction: directionMatch ? validDirection(directionMatch[1]) : undefined,
    entryPrice: priceSequence ? priceSequence.first : undefined,
    exitPrice: priceSequence ? priceSequence.second : undefined,
    stopLoss: stopMatch ? parseNumber(stopMatch[1]) : undefined,
    takeProfit: takeMatch ? parseNumber(takeMatch[1]) : undefined,
    profitLoss: priceSequence ? priceSequence.third : undefined,
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
