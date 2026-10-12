/**
 * Strategy Performance Metrics Math
 */

import { BacktestTrade, EquityPoint, BacktestPerformance } from "./types";

export function computePerformanceMetrics(
  initialCapital: number,
  trades: BacktestTrade[],
  equityCurve: EquityPoint[]
): BacktestPerformance {
  const endingEquity = equityCurve.length > 0
    ? equityCurve[equityCurve.length - 1].equity
    : initialCapital;

  const netProfit = endingEquity - initialCapital;
  const netProfitPercent = initialCapital > 0 ? (netProfit / initialCapital) * 100 : 0;

  const totalTrades = trades.length;
  const winningTrades = trades.filter((t) => t.netPnL > 0).length;
  const losingTrades = trades.filter((t) => t.netPnL < 0).length;

  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  const grossGains = trades
    .filter((t) => t.grossPnL > 0)
    .reduce((acc, t) => acc + t.grossPnL, 0);

  const grossLosses = Math.abs(
    trades
      .filter((t) => t.grossPnL < 0)
      .reduce((acc, t) => acc + t.grossPnL, 0)
  );

  const profitFactor = grossLosses > 0
    ? grossGains / grossLosses
    : grossGains > 0
    ? 999 // Infinite edge if zero losses
    : 0;

  // Max Drawdown calculation
  let peakEquity = initialCapital;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  for (const point of equityCurve) {
    if (point.equity > peakEquity) {
      peakEquity = point.equity;
    }
    const dd = peakEquity - point.equity;
    const ddPct = peakEquity > 0 ? (dd / peakEquity) * 100 : 0;

    if (dd > maxDrawdown) maxDrawdown = dd;
    if (ddPct > maxDrawdownPercent) maxDrawdownPercent = ddPct;
  }

  // Sharpe Ratio estimation based on trade return distribution
  let sharpeRatio = 0;
  if (totalTrades >= 2) {
    const returns = trades.map((t) => t.pnlPercent);
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((acc, r) => acc + Math.pow(r - meanReturn, 2), 0) /
      (returns.length - 1);
    const stdDev = Math.sqrt(variance);

    if (stdDev > 0) {
      // Annualized assuming ~250 trading periods
      sharpeRatio = (meanReturn / stdDev) * Math.sqrt(Math.min(totalTrades, 252));
    }
  }

  const avgTradePnL = totalTrades > 0 ? netProfit / totalTrades : 0;

  return {
    initialCapital,
    endingEquity: parseFloat(endingEquity.toFixed(2)),
    netProfit: parseFloat(netProfit.toFixed(2)),
    netProfitPercent: parseFloat(netProfitPercent.toFixed(2)),
    totalTrades,
    winningTrades,
    losingTrades,
    winRate: parseFloat(winRate.toFixed(1)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    maxDrawdownPercent: parseFloat(maxDrawdownPercent.toFixed(2)),
    sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
    avgTradePnL: parseFloat(avgTradePnL.toFixed(2)),
    equityCurve,
    trades,
  };
}
