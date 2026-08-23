import { describe, expect, it } from 'vitest';
import { parseTrade } from '../services/extraction/parser';
import { normalizeInstrument, parseNumber, validDirection } from './validation';
describe('trade validation', () => {
  it('normalizes common instruments', () => expect(normalizeInstrument('EUR/USD')).toBe('EURUSD'));
  it('parses signed P&L values', () => expect(parseNumber('-$18.20')).toBe(-18.2));
  it('accepts BUY and SELL only', () => { expect(validDirection('BUY')).toBe('BUY'); expect(validDirection('hold')).toBeUndefined(); });
});

describe('ocr extraction robustness', () => {
  it('extracts values from a trade block with OCR spacing and arrow noise', () => {
    const text = [
      'EURUSD, BUY 0.25',
      '1,15592 > 1,15508  -21.00',
      'S/L: 1,15511',
      'T/P: 1,15837',
    ].join('\n');

    const trade = parseTrade(text, 'example.png', 'blob:example');

    expect(trade.instrument).toBe('EURUSD');
    expect(trade.direction).toBe('BUY');
    expect(trade.entryPrice).toBe(1.15592);
    expect(trade.exitPrice).toBe(1.15508);
    expect(trade.stopLoss).toBe(1.15511);
    expect(trade.takeProfit).toBe(1.15837);
    expect(trade.profitLoss).toBe(-21);
  });

  it('prefers the most trade-like block when multiple blocks are present', () => {
    const text = [
      'EURUSD, BUY 0.25',
      '1.10450 > 1.10580  +12.50',
      'S/L: 1.10380',
      'T/P: 1.10750',
      'AUDUSD, SELL 0.50',
      '0.66010 > 0.66240  -18.00',
    ].join('\n');

    const trade = parseTrade(text, 'example.png', 'blob:example');
    expect(trade.instrument).toBe('EURUSD');
    expect(trade.direction).toBe('BUY');
    expect(trade.entryPrice).toBe(1.1045);
    expect(trade.profitLoss).toBe(12.5);
  });

  it('reads realistic MT4/MT5 trade-history blocks', () => {
    const text = [
      'EURUSD, buy 0.25                    2026.08.10 11:13:43',
      '1.15592 -> 1.15508                   -21.00',
      '#33890516            Open:          2026.08.10 07:54:38',
      'S/L:      1.15511    Swap:          0.00',
      'T/P:      1.15837    Commission:    -1.00',
    ].join('\n');

    const trade = parseTrade(text, 'example.png', 'blob:example');
    expect(trade.instrument).toBe('EURUSD');
    expect(trade.direction).toBe('BUY');
    expect(trade.entryPrice).toBe(1.15592);
    expect(trade.exitPrice).toBe(1.15508);
    expect(trade.stopLoss).toBe(1.15511);
    expect(trade.takeProfit).toBe(1.15837);
    expect(trade.profitLoss).toBe(-21);
  });

  it('handles broker-style price lines without an arrow separator', () => {
    const text = [
      'EURUSD BUY 0.25',
      '1.15592 1.15508 -21.00',
      '1.15511 1.15837',
      'Open 2026.08.10 07:54:38',
    ].join('\n');

    const trade = parseTrade(text, 'example.png', 'blob:example');
    expect(trade.instrument).toBe('EURUSD');
    expect(trade.direction).toBe('BUY');
    expect(trade.entryPrice).toBe(1.15592);
    expect(trade.exitPrice).toBe(1.15508);
    expect(trade.stopLoss).toBe(1.15511);
    expect(trade.takeProfit).toBe(1.15837);
    expect(trade.profitLoss).toBe(-21);
  });

  it('keeps decimal commas as decimals, not thousands, when OCR uses European formatting', () => {
    expect(parseNumber('1,15592')).toBe(1.15592);
    expect(parseNumber('1.155,92')).toBe(1155.92);
    expect(parseNumber('1,234.56')).toBe(1234.56);
  });
});
