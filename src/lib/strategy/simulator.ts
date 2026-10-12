/**
 * MOCHEX Strategy Backtest Simulation Engine
 * Implements Next-Bar Open fills, pessimistic SL/TP checking, and fee deductions.
 */

import { CandlestickBar } from "../mexc/types";
import {
  BacktestConfig,
  BacktestPerformance,
  BacktestTrade,
  EquityPoint,
  ExitReason,
  PositionState,
  StrategyOrderIntent,
} from "./types";
import { computePerformanceMetrics } from "./metrics";

export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  initialCapital: 10000,
  feeRate: 0.0005, // 0.05% MEXC Spot taker fee
  defaultSizingPercent: 100,
};

export class BacktestSimulationEngine {
  private config: BacktestConfig;

  constructor(config: Partial<BacktestConfig> = {}) {
    this.config = { ...DEFAULT_BACKTEST_CONFIG, ...config };
  }

  public simulate(
    bars: CandlestickBar[],
    orderIntents: StrategyOrderIntent[]
  ): BacktestPerformance {
    if (bars.length === 0) {
      return computePerformanceMetrics(this.config.initialCapital, [], []);
    }

    // Map order intents by barIndex
    const intentsByBar = new Map<number, StrategyOrderIntent[]>();
    for (const intent of orderIntents) {
      const list = intentsByBar.get(intent.barIndex) || [];
      list.push(intent);
      intentsByBar.set(intent.barIndex, list);
    }

    let cash = this.config.initialCapital;
    let position: PositionState | null = null;
    const trades: BacktestTrade[] = [];
    const equityCurve: EquityPoint[] = [];

    let pendingEntry: StrategyOrderIntent | null = null;
    let pendingClose: StrategyOrderIntent | null = null;
    let peakEquity = this.config.initialCapital;

    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];

      // 1. Process Pending Fills from Previous Bar (Next-Bar Open Execution)
      if (position) {
        // Check if previous bar signaled an explicit close
        if (pendingClose && pendingClose.orderId === position.orderId) {
          this.closePosition(
            position,
            bar.open,
            bar.time,
            i,
            "CLOSE",
            cash,
            trades
          );
          cash = trades[trades.length - 1].cumulativeEquity;
          position = null;
          pendingClose = null;
        }
      }

      // If no position and a pending entry was signaled from previous bar
      if (!position && pendingEntry) {
        const fillPrice = bar.open;
        if (fillPrice > 0) {
          const allocationPct = (pendingEntry.qtyPercent || this.config.defaultSizingPercent) / 100;
          const allocatedCapital = pendingEntry.qtyFixed || cash * allocationPct;
          const safeCapital = Math.max(0, Math.min(cash, allocatedCapital));
          const entryFee = safeCapital * this.config.feeRate;
          const investable = safeCapital - entryFee;
          const size = investable / fillPrice;

          position = {
            isOpen: true,
            orderId: pendingEntry.orderId,
            direction: pendingEntry.direction || "long",
            entryBarIndex: i,
            entryTime: bar.time,
            entryPrice: fillPrice,
            size,
            costBasis: safeCapital,
            stopLossPrice: pendingEntry.stopLossPrice,
            takeProfitPrice: pendingEntry.takeProfitPrice,
          };

          cash -= safeCapital;
        }
        pendingEntry = null;
      }

      // 2. Intrabar Stop-Loss & Take-Profit Evaluation (Pessimistic)
      if (position) {
        const exitEvent = this.evaluateIntrabarExits(position, bar);
        if (exitEvent) {
          this.closePosition(
            position,
            exitEvent.price,
            bar.time,
            i,
            exitEvent.reason,
            cash,
            trades
          );
          cash = trades[trades.length - 1].cumulativeEquity;
          position = null;
        }
      }

      // 3. Collect Intent Signals on Current Bar (to fill on Bar i + 1)
      const currentIntents = intentsByBar.get(i);
      if (currentIntents) {
        for (const intent of currentIntents) {
          if (intent.type === "ENTRY" && !position) {
            pendingEntry = intent;
          } else if (intent.type === "CLOSE" && position) {
            pendingClose = intent;
          } else if (intent.type === "EXIT" && position) {
            // Update stopLoss or takeProfit dynamic levels immediately
            if (intent.stopLossPrice !== undefined) {
              position.stopLossPrice = intent.stopLossPrice;
            }
            if (intent.takeProfitPrice !== undefined) {
              position.takeProfitPrice = intent.takeProfitPrice;
            }
          }
        }
      }

      // 4. Mark-to-Market Equity Calculation
      let currentEquity = cash;
      if (position) {
        const currentPrice = bar.close;
        const currentVal = position.direction === "long"
          ? position.size * currentPrice
          : position.costBasis + (position.costBasis - position.size * currentPrice);
        currentEquity = cash + currentVal;
      }

      if (currentEquity > peakEquity) peakEquity = currentEquity;
      const dd = peakEquity > 0 ? ((peakEquity - currentEquity) / peakEquity) * 100 : 0;

      equityCurve.push({
        time: bar.time,
        equity: parseFloat(currentEquity.toFixed(2)),
        drawdownPercent: parseFloat(dd.toFixed(2)),
      });
    }

    // 5. Close Any Open Position on Final Bar (END_OF_DATA)
    if (position && bars.length > 0) {
      const lastBar = bars[bars.length - 1];
      this.closePosition(
        position,
        lastBar.close,
        lastBar.time,
        bars.length - 1,
        "END_OF_DATA",
        cash,
        trades
      );
    }

    return computePerformanceMetrics(
      this.config.initialCapital,
      trades,
      equityCurve
    );
  }

  private evaluateIntrabarExits(
    position: PositionState,
    bar: CandlestickBar
  ): { price: number; reason: ExitReason } | null {
    const isLong = position.direction === "long";

    if (isLong) {
      const isSlHit = position.stopLossPrice !== undefined && bar.low <= position.stopLossPrice;
      const isTpHit = position.takeProfitPrice !== undefined && bar.high >= position.takeProfitPrice;

      // Pessimistic assumption: If both trigger, SL executed first
      if (isSlHit) {
        return { price: position.stopLossPrice!, reason: "STOP_LOSS" };
      }
      if (isTpHit) {
        return { price: position.takeProfitPrice!, reason: "TAKE_PROFIT" };
      }
    } else {
      // Short position
      const isSlHit = position.stopLossPrice !== undefined && bar.high >= position.stopLossPrice;
      const isTpHit = position.takeProfitPrice !== undefined && bar.low <= position.takeProfitPrice;

      if (isSlHit) {
        return { price: position.stopLossPrice!, reason: "STOP_LOSS" };
      }
      if (isTpHit) {
        return { price: position.takeProfitPrice!, reason: "TAKE_PROFIT" };
      }
    }

    return null;
  }

  private closePosition(
    position: PositionState,
    exitPrice: number,
    exitTime: number,
    exitBarIndex: number,
    exitReason: ExitReason,
    currentCash: number,
    trades: BacktestTrade[]
  ): void {
    const exitValue = position.size * exitPrice;
    const exitFee = exitValue * this.config.feeRate;
    const netProceeds = exitValue - exitFee;

    const isLong = position.direction === "long";
    const grossPnL = isLong
      ? exitValue - position.costBasis
      : position.costBasis - exitValue;

    const entryFee = position.costBasis * this.config.feeRate;
    const totalFees = entryFee + exitFee;
    const netPnL = grossPnL - totalFees;
    const pnlPercent = position.costBasis > 0 ? (netPnL / position.costBasis) * 100 : 0;

    const newCumulativeEquity = currentCash + netProceeds;

    trades.push({
      tradeId: `trade-${trades.length + 1}`,
      orderId: position.orderId,
      direction: position.direction || "long",
      entryBarIndex: position.entryBarIndex,
      entryTime: position.entryTime,
      entryPrice: parseFloat(position.entryPrice.toFixed(4)),
      exitBarIndex,
      exitTime,
      exitPrice: parseFloat(exitPrice.toFixed(4)),
      exitReason,
      size: parseFloat(position.size.toFixed(6)),
      grossPnL: parseFloat(grossPnL.toFixed(2)),
      netPnL: parseFloat(netPnL.toFixed(2)),
      pnlPercent: parseFloat(pnlPercent.toFixed(2)),
      feePaid: parseFloat(totalFees.toFixed(2)),
      cumulativeEquity: parseFloat(newCumulativeEquity.toFixed(2)),
      barsHeld: exitBarIndex - position.entryBarIndex,
    });
  }
}
