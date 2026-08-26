import { describe, expect, it } from 'vitest';
import type { Trade } from '../types/trade';
import { resultFor, rMultipleFor, tradeSummary } from './calculations';

const blankConfidence = { instrument: 0, direction: 0, entryPrice: 0, stopLoss: 0, takeProfit: 0, exitPrice: 0, profitLoss: 0 };
const trade = (values: Partial<Trade>): Trade => ({
  id: values.id ?? 't',
  sourceFileName: 'x.png',
  sourceUrl: 'blob:x',
  confidence: blankConfidence,
  needsReview: false,
  ...values,
});

describe('resultFor', () => {
  it('classifies WIN, LOSS, BREAKEVEN and blank', () => {
    expect(resultFor(10)).toBe('WIN');
    expect(resultFor(-5)).toBe('LOSS');
    expect(resultFor(0)).toBe('BREAKEVEN');
    expect(resultFor(undefined)).toBe('');
  });
});

describe('rMultipleFor', () => {
  it('computes P&L divided by risk (|entry - stop| * size)', () => {
    expect(rMultipleFor(trade({ profitLoss: 20, entryPrice: 100, stopLoss: 90, positionSize: 1 }))).toBe(2);
  });

  it('returns undefined when a required field is missing', () => {
    expect(rMultipleFor(trade({ profitLoss: 20, entryPrice: 100, stopLoss: 90 }))).toBeUndefined();
    expect(rMultipleFor(trade({ profitLoss: 20, entryPrice: 100, positionSize: 1 }))).toBeUndefined();
    expect(rMultipleFor(trade({ entryPrice: 100, stopLoss: 90, positionSize: 1 }))).toBeUndefined();
  });

  it('returns undefined when risk is zero (entry equals stop)', () => {
    expect(rMultipleFor(trade({ profitLoss: 20, entryPrice: 100, stopLoss: 100, positionSize: 1 }))).toBeUndefined();
  });
});

describe('tradeSummary', () => {
  it('aggregates wins, losses, breakeven and derived statistics', () => {
    const s = tradeSummary([
      trade({ profitLoss: 20, entryPrice: 100, stopLoss: 90, positionSize: 1 }),
      trade({ profitLoss: -10 }),
      trade({ profitLoss: 0 }),
      trade({}), // no P&L -> excluded from stats
    ]);

    expect(s.wins).toBe(1);
    expect(s.losses).toBe(1);
    expect(s.breakeven).toBe(1);
    expect(s.total).toBe(10);
    expect(s.winRate).toBeCloseTo(1 / 3);
    expect(s.avgWin).toBe(20);
    expect(s.avgLoss).toBe(-10);
    expect(s.profitFactor).toBe(2);
    expect(s.avgR).toBe(2);
  });

  it('leaves statistics undefined when there is no data to compute them from', () => {
    const s = tradeSummary([]);
    expect(s.total).toBe(0);
    expect(s.winRate).toBeUndefined();
    expect(s.avgWin).toBeUndefined();
    expect(s.avgLoss).toBeUndefined();
    expect(s.profitFactor).toBeUndefined();
    expect(s.avgR).toBeUndefined();
  });
});
