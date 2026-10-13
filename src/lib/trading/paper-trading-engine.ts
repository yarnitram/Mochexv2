import { ChartDrawing, calculatePositionMetrics } from "../chart/drawing-math";

export type OrderSide = "long" | "short";
export type OrderType = "market" | "limit";
export type TradeExitReason = "manual" | "take_profit" | "stop_loss";

export interface PaperPosition {
  id: string;
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  quantity: number;
  leverage: number;
  marginUsed: number;
  takeProfit?: number;
  stopLoss?: number;
  openedAt: number;
  sourceDrawingId?: string;
}

export interface PaperLimitOrder {
  id: string;
  symbol: string;
  side: OrderSide;
  limitPrice: number;
  quantity: number;
  leverage: number;
  marginReserved: number;
  takeProfit?: number;
  stopLoss?: number;
  createdAt: number;
  sourceDrawingId?: string;
}

export interface ClosedPaperTrade {
  id: string;
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  leverage: number;
  realizedPnl: number;
  realizedPnlPercent: number;
  exitReason: TradeExitReason;
  openedAt: number;
  closedAt: number;
}

export interface PaperAccountState {
  balance: number;
  positions: PaperPosition[];
  orders: PaperLimitOrder[];
  history: ClosedPaperTrade[];
}

export interface PaperOrderInput {
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  price?: number; // required for limit order
  marginAmountUsdt: number; // USDT collateral allocated to this trade
  leverage: number;
  takeProfit?: number;
  stopLoss?: number;
  sourceDrawingId?: string;
}

export interface PositionPnlMetrics {
  unrealizedPnl: number;
  roePercent: number;
  notionalValue: number;
  liquidationPrice: number;
}

export interface AccountEquitySummary {
  balance: number;
  unrealizedPnl: number;
  equity: number;
  usedMargin: number;
  reservedOrderMargin: number;
  freeMargin: number;
}

export const DEFAULT_PAPER_BALANCE = 100000;

export function createInitialPaperAccount(
  initialBalance: number = DEFAULT_PAPER_BALANCE
): PaperAccountState {
  return {
    balance: initialBalance,
    positions: [],
    orders: [],
    history: [],
  };
}

/**
 * Computes live Unrealized PnL ($), ROE (%), Notional Value, and estimated Liquidation Price
 * for an open paper position at a given markPrice.
 */
export function calculatePositionUnrealizedPnl(
  position: PaperPosition,
  markPrice: number
): PositionPnlMetrics {
  const safeMark = Number.isFinite(markPrice) && markPrice > 0 ? markPrice : position.entryPrice;
  const priceDiff =
    position.side === "long"
      ? safeMark - position.entryPrice
      : position.entryPrice - safeMark;
  const unrealizedPnl = priceDiff * position.quantity;
  const roePercent =
    position.marginUsed > 0 ? (unrealizedPnl / position.marginUsed) * 100 : 0;
  const notionalValue = safeMark * position.quantity;

  // Approximate isolated liquidation price (90% margin maintenance threshold)
  const maxLossPerUnit = (position.marginUsed * 0.9) / Math.max(position.quantity, 1e-9);
  const liquidationPrice =
    position.side === "long"
      ? Math.max(0, position.entryPrice - maxLossPerUnit)
      : position.entryPrice + maxLossPerUnit;

  return {
    unrealizedPnl,
    roePercent,
    notionalValue,
    liquidationPrice,
  };
}

/**
 * Computes aggregate account equity, used margin, reserved limit margin, and free margin.
 */
export function calculateAccountEquity(
  state: PaperAccountState,
  markPrices: Record<string, number>
): AccountEquitySummary {
  let unrealizedPnl = 0;
  let usedMargin = 0;

  for (const pos of state.positions) {
    const mark = markPrices[pos.symbol] ?? pos.entryPrice;
    const metrics = calculatePositionUnrealizedPnl(pos, mark);
    unrealizedPnl += metrics.unrealizedPnl;
    usedMargin += pos.marginUsed;
  }

  const reservedOrderMargin = state.orders.reduce(
    (acc, ord) => acc + ord.marginReserved,
    0
  );
  const equity = state.balance + unrealizedPnl;
  const freeMargin = Math.max(0, equity - usedMargin - reservedOrderMargin);

  return {
    balance: state.balance,
    unrealizedPnl,
    equity,
    usedMargin,
    reservedOrderMargin,
    freeMargin,
  };
}

/**
 * Places a Market or Limit paper order.
 * If a Limit order is immediately marketable (e.g. Long Limit >= currentMarkPrice), it executes immediately as a position.
 */
export function placePaperOrder(
  state: PaperAccountState,
  input: PaperOrderInput,
  currentMarkPrice: number,
  nowMs: number = Date.now()
): { state: PaperAccountState; status: "filled" | "placed" | "rejected"; message: string } {
  if (!Number.isFinite(currentMarkPrice) || currentMarkPrice <= 0) {
    return { state, status: "rejected", message: "Invalid mark price" };
  }

  const leverage = Math.max(1, Math.min(100, Math.round(input.leverage || 1)));
  const marginAmount = Number(input.marginAmountUsdt);
  if (!Number.isFinite(marginAmount) || marginAmount <= 0) {
    return { state, status: "rejected", message: "Margin amount must be greater than $0" };
  }

  const equitySummary = calculateAccountEquity(state, {
    [input.symbol]: currentMarkPrice,
  });

  if (marginAmount > equitySummary.freeMargin) {
    return {
      state,
      status: "rejected",
      message: `Insufficient free margin ($${equitySummary.freeMargin.toFixed(2)} available)`,
    };
  }

  const isLimit = input.orderType === "limit";
  const targetEntryPrice =
    isLimit && input.price && input.price > 0 ? input.price : currentMarkPrice;

  // Check if limit order is immediately marketable
  const isImmediatelyMarketable =
    !isLimit ||
    (input.side === "long" && targetEntryPrice >= currentMarkPrice) ||
    (input.side === "short" && targetEntryPrice <= currentMarkPrice);

  if (isImmediatelyMarketable) {
    const fillPrice = currentMarkPrice;
    const notional = marginAmount * leverage;
    const quantity = notional / fillPrice;

    const newPosition: PaperPosition = {
      id: `pos-${input.symbol}-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
      symbol: input.symbol,
      side: input.side,
      entryPrice: fillPrice,
      quantity,
      leverage,
      marginUsed: marginAmount,
      takeProfit:
        input.takeProfit && input.takeProfit > 0 ? input.takeProfit : undefined,
      stopLoss:
        input.stopLoss && input.stopLoss > 0 ? input.stopLoss : undefined,
      openedAt: nowMs,
      sourceDrawingId: input.sourceDrawingId,
    };

    return {
      state: {
        ...state,
        positions: [newPosition, ...state.positions],
      },
      status: "filled",
      message: `Opened ${input.side.toUpperCase()} ${quantity.toFixed(4)} ${input.symbol.replace("USDT", "")} @ $${fillPrice.toFixed(2)}`,
    };
  }

  // Otherwise place a resting Limit order
  const notional = marginAmount * leverage;
  const quantity = notional / targetEntryPrice;

  const newOrder: PaperLimitOrder = {
    id: `ord-${input.symbol}-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
    symbol: input.symbol,
    side: input.side,
    limitPrice: targetEntryPrice,
    quantity,
    leverage,
    marginReserved: marginAmount,
    takeProfit:
      input.takeProfit && input.takeProfit > 0 ? input.takeProfit : undefined,
    stopLoss: input.stopLoss && input.stopLoss > 0 ? input.stopLoss : undefined,
    createdAt: nowMs,
    sourceDrawingId: input.sourceDrawingId,
  };

  return {
    state: {
      ...state,
      orders: [newOrder, ...state.orders],
    },
    status: "placed",
    message: `Limit ${input.side.toUpperCase()} order placed @ $${targetEntryPrice.toFixed(2)}`,
  };
}

/**
 * Closes an open position at exitPrice and records a ClosedPaperTrade.
 */
export function closePaperPosition(
  state: PaperAccountState,
  positionId: string,
  exitPrice: number,
  exitReason: TradeExitReason = "manual",
  nowMs: number = Date.now()
): { state: PaperAccountState; closedTrade: ClosedPaperTrade | null } {
  const target = state.positions.find((p) => p.id === positionId);
  if (!target) {
    return { state, closedTrade: null };
  }

  const { unrealizedPnl, roePercent } = calculatePositionUnrealizedPnl(
    target,
    exitPrice
  );

  const closedTrade: ClosedPaperTrade = {
    id: `trd-${target.symbol}-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
    symbol: target.symbol,
    side: target.side,
    entryPrice: target.entryPrice,
    exitPrice,
    quantity: target.quantity,
    leverage: target.leverage,
    realizedPnl: unrealizedPnl,
    realizedPnlPercent: roePercent,
    exitReason,
    openedAt: target.openedAt,
    closedAt: nowMs,
  };

  const nextBalance = Math.max(0, state.balance + unrealizedPnl);
  const nextPositions = state.positions.filter((p) => p.id !== positionId);
  const nextHistory = [closedTrade, ...state.history].slice(0, 100);

  return {
    state: {
      ...state,
      balance: nextBalance,
      positions: nextPositions,
      history: nextHistory,
    },
    closedTrade,
  };
}

/**
 * Cancels a working limit order.
 */
export function cancelPaperOrder(
  state: PaperAccountState,
  orderId: string
): PaperAccountState {
  return {
    ...state,
    orders: state.orders.filter((o) => o.id !== orderId),
  };
}

/**
 * Evaluates a live price tick for a symbol:
 * 1. Fills any resting Limit orders whose limitPrice has been reached.
 * 2. Triggers any Take Profit or Stop Loss brackets on open positions for the symbol.
 */
export function evaluatePaperTick(
  state: PaperAccountState,
  symbol: string,
  markPrice: number,
  nowMs: number = Date.now()
): {
  state: PaperAccountState;
  filledOrders: PaperLimitOrder[];
  closedTrades: ClosedPaperTrade[];
} {
  if (!Number.isFinite(markPrice) || markPrice <= 0) {
    return { state, filledOrders: [], closedTrades: [] };
  }

  let nextState = state;
  const filledOrders: PaperLimitOrder[] = [];
  const closedTrades: ClosedPaperTrade[] = [];

  // 1. Check resting Limit orders for this symbol
  const remainingOrders: PaperLimitOrder[] = [];
  const newlyOpenedPositions: PaperPosition[] = [];

  for (const ord of nextState.orders) {
    if (ord.symbol !== symbol) {
      remainingOrders.push(ord);
      continue;
    }

    const shouldFill =
      (ord.side === "long" && markPrice <= ord.limitPrice) ||
      (ord.side === "short" && markPrice >= ord.limitPrice);

    if (shouldFill) {
      filledOrders.push(ord);
      newlyOpenedPositions.push({
        id: `pos-${ord.symbol}-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
        symbol: ord.symbol,
        side: ord.side,
        entryPrice: ord.limitPrice,
        quantity: ord.quantity,
        leverage: ord.leverage,
        marginUsed: ord.marginReserved,
        takeProfit: ord.takeProfit,
        stopLoss: ord.stopLoss,
        openedAt: nowMs,
        sourceDrawingId: ord.sourceDrawingId,
      });
    } else {
      remainingOrders.push(ord);
    }
  }

  if (filledOrders.length > 0) {
    nextState = {
      ...nextState,
      orders: remainingOrders,
      positions: [...newlyOpenedPositions, ...nextState.positions],
    };
  }

  // 2. Check open positions for TP / SL triggers on this symbol
  for (const pos of nextState.positions) {
    if (pos.symbol !== symbol) continue;

    let hitReason: TradeExitReason | null = null;
    let triggerExitPrice = markPrice;

    if (pos.side === "long") {
      if (pos.takeProfit && markPrice >= pos.takeProfit) {
        hitReason = "take_profit";
        triggerExitPrice = pos.takeProfit;
      } else if (pos.stopLoss && markPrice <= pos.stopLoss) {
        hitReason = "stop_loss";
        triggerExitPrice = pos.stopLoss;
      }
    } else {
      // short
      if (pos.takeProfit && markPrice <= pos.takeProfit) {
        hitReason = "take_profit";
        triggerExitPrice = pos.takeProfit;
      } else if (pos.stopLoss && markPrice >= pos.stopLoss) {
        hitReason = "stop_loss";
        triggerExitPrice = pos.stopLoss;
      }
    }

    if (hitReason) {
      const closedResult = closePaperPosition(
        nextState,
        pos.id,
        triggerExitPrice,
        hitReason,
        nowMs
      );
      nextState = closedResult.state;
      if (closedResult.closedTrade) {
        closedTrades.push(closedResult.closedTrade);
      }
    }
  }

  return {
    state: nextState,
    filledOrders,
    closedTrades,
  };
}

/**
 * Converts a Long Position or Short Position chart drawing into a pre-configured PaperOrderInput.
 * If the drawing's entry price is within 0.15% of currentMarkPrice, defaults to a Market order;
 * otherwise places a Limit order at the drawing's exact Entry Price.
 */
export function createOrderInputFromDrawing(
  drawing: ChartDrawing,
  symbol: string,
  currentMarkPrice: number,
  leverage: number = 5
): PaperOrderInput | null {
  if (drawing.type !== "long_position" && drawing.type !== "short_position") {
    return null;
  }

  const isLong = drawing.type === "long_position";
  const entryPrice = drawing.startPrice;
  const targetPrice =
    drawing.targetPrice !== undefined
      ? drawing.targetPrice
      : isLong
      ? entryPrice * 1.04
      : entryPrice * 0.96;
  const stopPrice =
    drawing.stopPrice !== undefined
      ? drawing.stopPrice
      : isLong
      ? entryPrice * 0.98
      : entryPrice * 1.02;

  const metrics = calculatePositionMetrics(
    entryPrice,
    targetPrice,
    stopPrice,
    isLong,
    drawing.accountSize || 10000,
    drawing.riskPercent || 1.0,
    drawing.riskAmount
  );

  const safeLeverage = Math.max(1, leverage);
  const notional = metrics.quantity * entryPrice;
  const computedMargin = Math.max(50, Math.min(25000, notional / safeLeverage));

  const priceDistanceRatio =
    currentMarkPrice > 0
      ? Math.abs(entryPrice - currentMarkPrice) / currentMarkPrice
      : 0;
  const orderType: OrderType = priceDistanceRatio <= 0.0015 ? "market" : "limit";

  return {
    symbol,
    side: isLong ? "long" : "short",
    orderType,
    price: entryPrice,
    marginAmountUsdt: Number(computedMargin.toFixed(2)),
    leverage: safeLeverage,
    takeProfit: Number(metrics.targetPrice.toFixed(4)),
    stopLoss: Number(metrics.stopPrice.toFixed(4)),
    sourceDrawingId: drawing.id,
  };
}
