import { describe, expect, it } from 'vitest';
import type { Trade } from '../../types/trade';
import { buildWorkbook } from './export';

const blankConfidence = { instrument: 0, direction: 0, entryPrice: 0, stopLoss: 0, takeProfit: 0, exitPrice: 0, profitLoss: 0 };
const trade = (values: Partial<Trade>): Trade => ({
  id: values.id ?? 't',
  sourceFileName: 'shot.png',
  sourceUrl: 'blob:x',
  confidence: blankConfidence,
  needsReview: false,
  ...values,
});

const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());
// The ZIP is written with the "stored" method (no compression), so every part's
// text appears verbatim in the bytes and can be searched as a latin1 string.
const asLatin1 = (bytes: Uint8Array) => {
  let out = '';
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
};

describe('buildWorkbook', () => {
  it('produces a ZIP with the correct local-header and end-of-central-directory signatures', async () => {
    const bytes = await bytesOf(buildWorkbook([trade({ instrument: 'EURUSD', direction: 'BUY', profitLoss: 12.5 })]));

    // Local file header: "PK\x03\x04"
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    // End of central directory record: "PK\x05\x06"
    expect(asLatin1(bytes).includes('PK\x05\x06')).toBe(true);
  });

  it('records one central-directory entry per OOXML package part', async () => {
    const bytes = await bytesOf(buildWorkbook([trade({ profitLoss: 1 })]));
    const text = asLatin1(bytes);
    const eocd = text.lastIndexOf('PK\x05\x06');
    // Total-entries field is a little-endian uint16 at EOCD offset 10.
    const totalEntries = bytes[eocd + 10] | (bytes[eocd + 11] << 8);
    expect(totalEntries).toBe(11);
  });

  it('embeds trade rows, summary metrics, sheet names and the chart title', async () => {
    const bytes = await bytesOf(buildWorkbook([
      trade({ instrument: 'EURUSD', direction: 'BUY', profitLoss: 12.5, entryPrice: 1.1 }),
      trade({ id: 't2', instrument: 'GBPUSD', direction: 'SELL', profitLoss: -8 }),
    ]));
    const text = asLatin1(bytes);

    expect(text).toContain('Trade #');
    expect(text).toContain('EURUSD');
    expect(text).toContain('GBPUSD');
    expect(text).toContain('Win Rate');
    expect(text).toContain('Trades');
    expect(text).toContain('Summary');
    expect(text).toContain('Trade P/L');
  });

  it('always produces a valid workbook even with no trades', async () => {
    const bytes = await bytesOf(buildWorkbook([]));
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(asLatin1(bytes)).toContain('Total Trades');
  });
});
