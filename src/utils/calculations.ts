import type { Trade } from '../types/trade';
export const resultFor = (p?: number) => p === undefined ? '' : p > 0 ? 'WIN' : p < 0 ? 'LOSS' : 'BREAKEVEN';
export const rMultipleFor = (t: Trade) => {
  if (t.profitLoss === undefined || t.entryPrice === undefined || t.stopLoss === undefined || t.positionSize === undefined) return undefined;
  const risk = Math.abs(t.entryPrice - t.stopLoss) * t.positionSize;
  return risk > 0 ? t.profitLoss / risk : undefined;
};
export const tradeSummary = (trades: Trade[]) => {
  const values = trades.map(t => t.profitLoss).filter((p): p is number => p !== undefined);
  const wins = values.filter(p => p > 0), losses = values.filter(p => p < 0);
  const total = values.reduce((a, b) => a + b, 0);
  const profitFactor = losses.length ? wins.reduce((a,b)=>a+b,0) / Math.abs(losses.reduce((a,b)=>a+b,0)) : undefined;
  const rValues = trades.map(rMultipleFor).filter((r): r is number => r !== undefined);
  return { total, wins: wins.length, losses: losses.length, breakeven: values.filter(p=>p===0).length, winRate: values.length ? wins.length / values.length : undefined, avgWin: wins.length ? wins.reduce((a,b)=>a+b,0)/wins.length : undefined, avgLoss: losses.length ? losses.reduce((a,b)=>a+b,0)/losses.length : undefined, profitFactor, avgR: rValues.length ? rValues.reduce((a,b)=>a+b,0)/rValues.length : undefined };
};
