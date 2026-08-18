import type { Direction, Trade } from '../types/trade';
export const normalizeInstrument = (value?: string) => {
  if (!value) return undefined;
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{6}$/.test(clean) || /^(XAU|XAG)[A-Z]{3}$/.test(clean) || /^[A-Z]{3,10}$/.test(clean) ? clean : undefined;
};
export const parseNumber = (raw?: string) => { if (!raw) return undefined; const match = raw.replace(/[$€£₦,\s]/g, '').match(/[+-]?\d+(?:\.\d+)?/); return match ? Number(match[0]) : undefined; };
export const validDirection = (value?: string): Direction | undefined => value?.toUpperCase().match(/\b(BUY|SELL)\b/)?.[1] as Direction | undefined;
export const needsReview = (trade: Partial<Trade>) => !trade.instrument || !trade.direction || trade.entryPrice === undefined || trade.profitLoss === undefined;
