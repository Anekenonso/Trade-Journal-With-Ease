import type { Confidence, Trade } from '../../types/trade';
import { normalizeInstrument, parseNumber, validDirection, needsReview } from '../../utils/validation';
import { enhanceTradeWithAi, shouldUseAiReview } from './llm';
import { parseTrade } from './parser';

const confidence: Confidence = { instrument: .95, direction: .95, entryPrice: .9, stopLoss: .9, takeProfit: .9, exitPrice: .9, profitLoss: .9 };
const decimal = '(\\d{1,3}(?:[.,]\\d{3,8}))';
const labelledValue = (text: string, label: string) => parseNumber(text.match(new RegExp(`${label}\\s*[:=]?\\s*([+-]?${decimal})`, 'i'))?.[1]);
const makeTrade = (sourceFileName: string, sourceUrl: string, values: Partial<Trade>): Trade => ({ id: crypto.randomUUID(), sourceFileName, sourceUrl, confidence: { ...confidence, instrument: values.instrument ? .95 : 0, direction: values.direction ? .95 : 0, entryPrice: values.entryPrice === undefined ? 0 : .9, stopLoss: values.stopLoss === undefined ? 0 : .9, takeProfit: values.takeProfit === undefined ? 0 : .9, exitPrice: values.exitPrice === undefined ? 0 : .9, profitLoss: values.profitLoss === undefined ? 0 : .9 }, ...values, needsReview: values.orderType !== 'MARKET' || needsReview(values) });

export const parseMt5History = (text: string, sourceFileName: string, sourceUrl: string): Trade[] => {
  const starts = [...text.matchAll(/\b([A-Z]{3}\s*[/\\-]?\s*[A-Z]{3})\s*,?\s*(buy|sell)\s+(\d+(?:[.,]\d+)?)/gi)];
  return starts.map((match, index) => {
    const block = text.slice(match.index, starts[index + 1]?.index ?? text.length);
    const arrow = block.match(new RegExp(`(${decimal})\\s*(?:→|->|>)\\s*(${decimal})`));
    const date = block.match(/(\d{4}[./-]\d{2}[./-]\d{2})\s+(\d{2}:\d{2}:\d{2})/);
    const pnl = block.match(/\d{2}:\d{2}:\d{2}[\s\S]{0,35}?([+-]\s*\d+(?:[.,]\d+)?)/);
    return makeTrade(sourceFileName, sourceUrl, { instrument: normalizeInstrument(match[1]), direction: validDirection(match[2]), orderType: 'MARKET', positionSize: parseNumber(match[3]), entryPrice: parseNumber(arrow?.[1]), exitPrice: parseNumber(arrow?.[2]), stopLoss: labelledValue(block, 'S\\s*/?\\s*L'), takeProfit: labelledValue(block, 'T\\s*/?\\s*P'), commission: labelledValue(block, 'commission'), profitLoss: parseNumber(pnl?.[1]), date: date?.[1]?.replace(/\./g, '-'), time: date?.[2] });
  });
};

export const parseTrades = async (
  text: string,
  sourceFileName: string,
  sourceUrl: string,
  options: { aiReviewEnabled?: boolean } = {},
) => {
  const aiReviewEnabled = options.aiReviewEnabled ?? true;
  const history = parseMt5History(text, sourceFileName, sourceUrl);
  if (history.length) {
    const reviewed = await Promise.all(history.map(async (trade) => {
      if (!aiReviewEnabled || !shouldUseAiReview(trade)) return trade;
      return enhanceTradeWithAi(trade, text);
    }));
    return reviewed;
  }

  const trade = parseTrade(text, sourceFileName, sourceUrl);
  const pending = text.toUpperCase().match(/\b(BUY|SELL)\s+(LIMIT|STOP)\b/);
  if (pending) {
    trade.direction = pending[1] as 'BUY' | 'SELL';
    trade.orderType = `${pending[1]} ${pending[2]}` as Trade['orderType'];
    trade.needsReview = true;
  }

  if (!aiReviewEnabled || !shouldUseAiReview(trade)) return [trade];
  return [await enhanceTradeWithAi(trade, text)];
};
