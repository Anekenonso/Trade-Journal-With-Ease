export type Direction = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'BUY LIMIT' | 'SELL LIMIT' | 'BUY STOP' | 'SELL STOP';

export interface Confidence { instrument: number; direction: number; entryPrice: number; stopLoss: number; takeProfit: number; exitPrice: number; profitLoss: number; }
export interface Trade {
  id: string; sourceFileName: string; sourceUrl: string;
  date?: string; time?: string; instrument?: string; direction?: Direction; orderType?: OrderType; commission?: number;
  entryPrice?: number; stopLoss?: number; takeProfit?: number; exitPrice?: number;
  positionSize?: number; profitLoss?: number; confidence: Confidence; needsReview: boolean; notes?: string;
}
export interface SelectedImage { id: string; file: File; url: string; status: 'pending' | 'processing' | 'done' | 'failed'; error?: string; }
