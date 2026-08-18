import * as XLSX from 'xlsx';
import type { Trade } from '../../types/trade';
import { rMultipleFor, resultFor, tradeSummary } from '../../utils/calculations';
export const exportWorkbook = (trades: Trade[]) => {
  const rows = trades.map((t, i) => ({ 'Trade #': i + 1, Date: t.date ?? '', Time: t.time ?? '', Instrument: t.instrument ?? '', Direction: t.direction ?? '', 'Entry Price': t.entryPrice ?? '', 'Stop Loss': t.stopLoss ?? '', 'Take Profit': t.takeProfit ?? '', 'Exit Price': t.exitPrice ?? '', 'Position Size': t.positionSize ?? '', 'Profit/Loss': t.profitLoss ?? '', 'R-Multiple': rMultipleFor(t) ?? '', Result: resultFor(t.profitLoss), 'Source Image': t.sourceFileName }));
  const s = tradeSummary(trades);
  const summary = [
    ['Metric', 'Value'],
    ['Total Trades', trades.length],
    ['Winning Trades', s.wins],
    ['Losing Trades', s.losses],
    ['Breakeven Trades', s.breakeven],
    ['Win Rate', s.winRate ?? ''],
    ['Total P&L', s.total],
    ['Average Win', s.avgWin ?? ''],
    ['Average Loss', s.avgLoss ?? ''],
    ['Profit Factor', s.profitFactor ?? ''],
    ['Average R-Multiple', s.avgR ?? ''],
  ];
  const book = XLSX.utils.book_new(); const sheet = XLSX.utils.json_to_sheet(rows); sheet['!cols'] = Array(14).fill({ wch: 16 }); XLSX.utils.book_append_sheet(book, sheet, 'Trades'); XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(summary), 'Summary');
  XLSX.writeFile(book, `trade_journal_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
