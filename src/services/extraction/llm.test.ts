import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Trade } from '../../types/trade';
import { enhanceTradeWithAi } from './llm';

const blankConfidence = { instrument: 0, direction: 0, entryPrice: 0, stopLoss: 0, takeProfit: 0, exitPrice: 0, profitLoss: 0 };

const lowConfidenceTrade = (): Trade => ({
  id: '1',
  sourceFileName: 'x.png',
  sourceUrl: 'blob:x',
  instrument: 'EURUSD',
  direction: 'BUY',
  entryPrice: 1.234,
  confidence: { ...blankConfidence, instrument: 0.9, direction: 0.9, entryPrice: 0.6 },
  needsReview: true,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('enhanceTradeWithAi', () => {
  it('merges only valid AI fields and clears needsReview', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      // entryPrice is a non-number and must be ignored in favour of the local value
      json: async () => ({ instrument: 'XAUUSD', profitLoss: 12.3, entryPrice: 'oops' }),
    }));

    const result = await enhanceTradeWithAi(lowConfidenceTrade(), 'some ocr text');

    expect(result.instrument).toBe('XAUUSD');
    expect(result.profitLoss).toBe(12.3);
    expect(result.entryPrice).toBe(1.234);
    expect(result.direction).toBe('BUY');
    expect(result.needsReview).toBe(false);
  });

  it('returns the trade unchanged when the backend responds with an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));

    const original = lowConfidenceTrade();
    const result = await enhanceTradeWithAi(original, 'some ocr text');

    expect(result).toEqual(original);
  });

  it('returns the trade unchanged when the request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const original = lowConfidenceTrade();
    const result = await enhanceTradeWithAi(original, 'some ocr text');

    expect(result).toEqual(original);
  });

  it('does not hit the network for high-confidence complete trades', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const highConfidence: Trade = {
      id: '2',
      sourceFileName: 'x.png',
      sourceUrl: 'blob:x',
      instrument: 'EURUSD',
      direction: 'BUY',
      entryPrice: 1.1,
      stopLoss: 1.09,
      takeProfit: 1.12,
      exitPrice: 1.11,
      profitLoss: 10,
      confidence: { instrument: 0.95, direction: 0.95, entryPrice: 0.9, stopLoss: 0.9, takeProfit: 0.9, exitPrice: 0.9, profitLoss: 0.9 },
      needsReview: false,
    };

    const result = await enhanceTradeWithAi(highConfidence, 'text');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toBe(highConfidence);
  });
});
