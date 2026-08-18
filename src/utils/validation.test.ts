import { describe, expect, it } from 'vitest';
import { normalizeInstrument, parseNumber, validDirection } from './validation';
describe('trade validation', () => {
  it('normalizes common instruments', () => expect(normalizeInstrument('EUR/USD')).toBe('EURUSD'));
  it('parses signed P&L values', () => expect(parseNumber('-$18.20')).toBe(-18.2));
  it('accepts BUY and SELL only', () => { expect(validDirection('BUY')).toBe('BUY'); expect(validDirection('hold')).toBeUndefined(); });
});
