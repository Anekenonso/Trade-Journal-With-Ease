import type { Direction, Trade } from '../types/trade';

export const normalizeInstrument = (value?: string) => {
  if (!value) return undefined;
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{6}$/.test(clean) || /^(XAU|XAG)[A-Z]{3}$/.test(clean) || /^[A-Z]{3,10}$/.test(clean) ? clean : undefined;
};

export const parseNumber = (raw?: string | number) => {
  if (raw === undefined || raw === null) return undefined;

  const text = String(raw).trim();
  if (!text) return undefined;

  let normalized = text
    .replace(/[$€£₦¥\s]/g, '')
    .replace(/[\u2012\u2013\u2014]/g, '-')
    .replace(/−/g, '-')
    .replace(/\+/g, '');

  if (normalized.includes(',') && normalized.includes('.')) {
    const lastComma = normalized.lastIndexOf(',');
    const lastDot = normalized.lastIndexOf('.');
    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, '').replace(/,/g, '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (normalized.includes(',') && !normalized.includes('.')) {
    normalized = normalized.replace(/,/g, '.');
  }

  const match = normalized.match(/[+-]?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : undefined;
};

export const validDirection = (value?: string): Direction | undefined => value?.toUpperCase().match(/\b(BUY|SELL)\b/)?.[1] as Direction | undefined;
export const needsReview = (trade: Partial<Trade>) => !trade.instrument || !trade.direction || trade.entryPrice === undefined || trade.profitLoss === undefined;
