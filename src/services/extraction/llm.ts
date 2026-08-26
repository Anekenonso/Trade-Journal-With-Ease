import type { Trade } from '../../types/trade';

export type AiReviewResult = Partial<Pick<Trade, 'instrument' | 'direction' | 'entryPrice' | 'stopLoss' | 'takeProfit' | 'exitPrice' | 'profitLoss' | 'positionSize'>> & {
  notes?: string;
};

export const shouldUseAiReview = (trade: Partial<Trade>) => {
  const scores = [
    trade.instrument ? 1 : 0,
    trade.direction ? 1 : 0,
    trade.entryPrice !== undefined ? 1 : 0,
    trade.stopLoss !== undefined ? 1 : 0,
    trade.takeProfit !== undefined ? 1 : 0,
    trade.exitPrice !== undefined ? 1 : 0,
    trade.profitLoss !== undefined ? 1 : 0,
  ];

  const filled = scores.filter(Boolean).length;
  const averageConfidence = [
    trade.confidence?.instrument ?? 0,
    trade.confidence?.direction ?? 0,
    trade.confidence?.entryPrice ?? 0,
    trade.confidence?.stopLoss ?? 0,
    trade.confidence?.takeProfit ?? 0,
    trade.confidence?.exitPrice ?? 0,
    trade.confidence?.profitLoss ?? 0,
  ].reduce((sum, value) => sum + value, 0) / 7;

  return trade.needsReview || filled < 5 || averageConfidence < 0.7;
};

export const enhanceTradeWithAi = async (trade: Trade, rawOcrText: string, imageDataUrl?: string): Promise<Trade> => {
  const candidateText = rawOcrText.trim();
  if ((!candidateText && !imageDataUrl) || !shouldUseAiReview(trade)) return trade;

  try {
    const response = await fetch('/api/ai-review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: candidateText, image: imageDataUrl }),
    });

    if (!response.ok) return trade;

    const parsed = await response.json();
    return {
      ...trade,
      instrument: parsed.instrument ?? trade.instrument,
      direction: parsed.direction ?? trade.direction,
      entryPrice: typeof parsed.entryPrice === 'number' ? parsed.entryPrice : trade.entryPrice,
      stopLoss: typeof parsed.stopLoss === 'number' ? parsed.stopLoss : trade.stopLoss,
      takeProfit: typeof parsed.takeProfit === 'number' ? parsed.takeProfit : trade.takeProfit,
      exitPrice: typeof parsed.exitPrice === 'number' ? parsed.exitPrice : trade.exitPrice,
      profitLoss: typeof parsed.profitLoss === 'number' ? parsed.profitLoss : trade.profitLoss,
      positionSize: typeof parsed.positionSize === 'number' ? parsed.positionSize : trade.positionSize,
      notes: parsed.notes ?? trade.notes,
      needsReview: false,
    };
  } catch {
    return trade;
  }
};
