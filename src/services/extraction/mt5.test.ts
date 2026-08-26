import { describe, expect, it } from 'vitest';
import { parseMt5History, parseTrades } from './mt5';

describe('parseMt5History', () => {
  it('parses multiple MT5 history rows (entry/exit, SL/TP, P&L, datetime)', () => {
    const text = [
      'EURUSD, buy 0.25  2026.08.10 11:13:43  -21.00',
      '1.15592 -> 1.15508',
      'S/L: 1.15511  T/P: 1.15837',
      'GBPUSD, sell 0.50  2026.08.11 09:00:00  +42.50',
      '1.27000 -> 1.26800',
      'S/L: 1.27200  T/P: 1.26500',
    ].join('\n');

    const trades = parseMt5History(text, 'hist.png', 'blob:hist');
    expect(trades).toHaveLength(2);

    const [first, second] = trades;
    expect(first.instrument).toBe('EURUSD');
    expect(first.direction).toBe('BUY');
    expect(first.positionSize).toBe(0.25);
    expect(first.entryPrice).toBe(1.15592);
    expect(first.exitPrice).toBe(1.15508);
    expect(first.stopLoss).toBe(1.15511);
    expect(first.takeProfit).toBe(1.15837);
    expect(first.profitLoss).toBe(-21);
    expect(first.date).toBe('2026-08-10');
    expect(first.time).toBe('11:13:43');
    expect(first.needsReview).toBe(false);

    expect(second.instrument).toBe('GBPUSD');
    expect(second.direction).toBe('SELL');
    expect(second.positionSize).toBe(0.5);
    expect(second.entryPrice).toBe(1.27);
    expect(second.exitPrice).toBe(1.268);
    expect(second.profitLoss).toBe(42.5);
  });

  it('returns an empty list when no history rows are present', () => {
    expect(parseMt5History('no trades here', 'x.png', 'blob:x')).toEqual([]);
  });
});

describe('parseTrades', () => {
  it('returns MT5 history trades and does not call AI when review is disabled', async () => {
    const text = 'EURUSD, buy 0.25  2026.08.10 11:13:43  -21.00\n1.15592 -> 1.15508\nS/L: 1.15511  T/P: 1.15837';
    const trades = await parseTrades(text, 'hist.png', 'blob:hist', { aiReviewEnabled: false });
    expect(trades).toHaveLength(1);
    expect(trades[0].instrument).toBe('EURUSD');
    expect(trades[0].direction).toBe('BUY');
  });

  it('flags pending limit/stop orders detected in the single-trade fallback', async () => {
    const text = 'EURUSD\nBUY LIMIT\nEntry 1.10500';
    const trades = await parseTrades(text, 'pending.png', 'blob:pending', { aiReviewEnabled: false });
    expect(trades).toHaveLength(1);
    expect(trades[0].direction).toBe('BUY');
    expect(trades[0].orderType).toBe('BUY LIMIT');
    expect(trades[0].needsReview).toBe(true);
  });
});
