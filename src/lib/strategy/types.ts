/**
 * MOCHEX Strategy Backtesting & Simulation Types
 */

import { CandlestickBar } from "../mexc/types";

export type OrderDirection = "long" | "short";

export type ExitReason = "CLOSE" | "STOP_LOSS" | "TAKE_PROFIT" | "END_OF_DATA";

export interface StrategyOrderIntent {
  barIndex: number;
  time: number;
  type: "ENTRY" | "CLOSE" | "EXIT";
  orderId: string;
  direction?: OrderDirection;
  qtyPercent?: number; // e.g. 100 for 100% of equity
  qtyFixed?: number;   // e.g. 1000 USDT
  stopLossPrice?: number;
  takeProfitPrice?: number;
  limitPrice?: number;
}

export interface PositionState {
  isOpen: boolean;
  orderId: string;
  direction: OrderDirection | null;
  entryBarIndex: number;
  entryTime: number;
  entryPrice: number;
  size: number; // In base asset units (e.g. BTC)
  costBasis: number; // In quote USDT
  stopLossPrice?: number;
  takeProfitPrice?: number;
}

export interface StrategyContext {
  entry: (
    id: string,
    direction: OrderDirection,
    options?: { qty?: number; qtyPercent?: number }
  ) => void;
  close: (id: string) => void;
  exit: (
    id: string,
    options: { stopLoss?: number; takeProfit?: number; limit?: number }
  ) => void;
  position: {
    isOpen: boolean;
    direction: OrderDirection | null;
    entryPrice: number;
    size: number;
  };
}

export interface BacktestConfig {
  initialCapital: number; // Default 10000 USDT
  feeRate: number;        // Default 0.0005 (0.05% taker)
  defaultSizingPercent: number; // Default 100% of available equity
}

export interface BacktestTrade {
  tradeId: string;
  orderId: string;
  direction: OrderDirection;
  entryBarIndex: number;
  entryTime: number;
  entryPrice: number;
  exitBarIndex: number;
  exitTime: number;
  exitPrice: number;
  exitReason: ExitReason;
  size: number;
  grossPnL: number;
  netPnL: number;
  pnlPercent: number;
  feePaid: number;
  cumulativeEquity: number;
  barsHeld: number;
}

export interface EquityPoint {
  time: number;
  equity: number;
  drawdownPercent: number;
}

export interface BacktestPerformance {
  initialCapital: number;
  endingEquity: number;
  netProfit: number;
  netProfitPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;            // 0 - 100
  profitFactor: number;       // Gross Gains / Gross Losses
  maxDrawdown: number;        // Max peak-to-trough in USDT
  maxDrawdownPercent: number; // Max peak-to-trough in %
  sharpeRatio: number;        // Annualized risk-adjusted metric
  avgTradePnL: number;
  equityCurve: EquityPoint[];
  trades: BacktestTrade[];
}
