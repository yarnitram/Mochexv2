import { describe, it, expect } from "vitest";
import {
  createInitialPaperAccount,
  placePaperOrder,
  evaluatePaperTick,
  closePaperPosition,
  calculatePositionUnrealizedPnl,
  calculateAccountEquity,
  createOrderInputFromDrawing,
} from "../src/lib/trading/paper-trading-engine";
import { ChartDrawing } from "../src/lib/chart/drawing-math";

describe("Paper Trading & Order Execution Engine (DEC-072)", () => {
  it("executes a Market Long order immediately and calculates live Unrealized PnL & ROE%", () => {
    const initial = createInitialPaperAccount(100000);
    const result = placePaperOrder(
      initial,
      {
        symbol: "BTCUSDT",
        side: "long",
        orderType: "market",
        marginAmountUsdt: 2000,
        leverage: 5,
        takeProfit: 72000,
        stopLoss: 67000,
      },
      68000,
      1700000000000
    );

    expect(result.status).toBe("filled");
    expect(result.state.positions).toHaveLength(1);
    const pos = result.state.positions[0];
    expect(pos.entryPrice).toBe(68000);
    expect(pos.marginUsed).toBe(2000);
    expect(pos.leverage).toBe(5);
    // Notional = 10,000 -> Qty = 10,000 / 68,000
    expect(pos.quantity).toBeCloseTo(10000 / 68000, 6);

    // Price rises to $71,400 (+5% move -> +25% ROE at 5x leverage -> +$500 PnL)
    const pnl = calculatePositionUnrealizedPnl(pos, 71400);
    expect(pnl.unrealizedPnl).toBeCloseTo(500, 2);
    expect(pnl.roePercent).toBeCloseTo(25, 2);

    const equity = calculateAccountEquity(result.state, { BTCUSDT: 71400 });
    expect(equity.equity).toBeCloseTo(100500, 2);
    expect(equity.usedMargin).toBe(2000);
    expect(equity.freeMargin).toBeCloseTo(98500, 2);
  });

  it("places a resting Limit order and fills it automatically when price crosses on tick", () => {
    const initial = createInitialPaperAccount(100000);
    const placed = placePaperOrder(
      initial,
      {
        symbol: "ETHUSDT",
        side: "long",
        orderType: "limit",
        price: 3400,
        marginAmountUsdt: 1000,
        leverage: 10,
        takeProfit: 3600,
        stopLoss: 3300,
      },
      3500,
      1700000001000
    );

    expect(placed.status).toBe("placed");
    expect(placed.state.orders).toHaveLength(1);
    expect(placed.state.positions).toHaveLength(0);

    // Tick at 3450 -> still resting
    const tick1 = evaluatePaperTick(placed.state, "ETHUSDT", 3450, 1700000002000);
    expect(tick1.filledOrders).toHaveLength(0);
    expect(tick1.state.orders).toHaveLength(1);

    // Tick at 3395 -> crosses <= 3400 -> fills at 3400 limit price!
    const tick2 = evaluatePaperTick(tick1.state, "ETHUSDT", 3395, 1700000003000);
    expect(tick2.filledOrders).toHaveLength(1);
    expect(tick2.state.orders).toHaveLength(0);
    expect(tick2.state.positions).toHaveLength(1);
    expect(tick2.state.positions[0].entryPrice).toBe(3400);
  });

  it("automatically triggers Take Profit and Stop Loss brackets on open positions", () => {
    const initial = createInitialPaperAccount(100000);
    const opened = placePaperOrder(
      initial,
      {
        symbol: "SOLUSDT",
        side: "short",
        orderType: "market",
        marginAmountUsdt: 1000,
        leverage: 5,
        takeProfit: 180,
        stopLoss: 210,
      },
      200,
      1700000010000
    );

    expect(opened.state.positions).toHaveLength(1);
    // Short @ $200, notional $5000 -> 25 SOL. TP @ $180 -> +$20 * 25 = +$500 profit
    const tickTp = evaluatePaperTick(opened.state, "SOLUSDT", 179.5, 1700000020000);
    expect(tickTp.closedTrades).toHaveLength(1);
    expect(tickTp.closedTrades[0].exitReason).toBe("take_profit");
    expect(tickTp.closedTrades[0].realizedPnl).toBeCloseTo(500, 2);
    expect(tickTp.state.positions).toHaveLength(0);
    expect(tickTp.state.balance).toBeCloseTo(100500, 2);
  });

  it("converts a Long Position or Short Position chart drawing into a PaperOrderInput", () => {
    const drawing: ChartDrawing = {
      id: "draw-long-1",
      type: "long_position",
      startTime: 1700000000000,
      startPrice: 68000,
      endTime: 1700003600000,
      endPrice: 70000,
      targetPrice: 71400,
      stopPrice: 66640,
      accountSize: 10000,
      riskPercent: 1,
    };

    const orderInput = createOrderInputFromDrawing(drawing, "BTCUSDT", 68020, 5);
    expect(orderInput).not.toBeNull();
    expect(orderInput?.side).toBe("long");
    expect(orderInput?.orderType).toBe("market"); // within 0.15% of 68000
    expect(orderInput?.takeProfit).toBe(71400);
    expect(orderInput?.stopLoss).toBe(66640);
    expect(orderInput?.sourceDrawingId).toBe("draw-long-1");
  });

  it("manually closes an open position and updates account balance and history", () => {
    const initial = createInitialPaperAccount(100000);
    const opened = placePaperOrder(
      initial,
      {
        symbol: "BTCUSDT",
        side: "long",
        orderType: "market",
        marginAmountUsdt: 1000,
        leverage: 10,
      },
      50000,
      1700000000000
    );

    const posId = opened.state.positions[0].id;
    const closed = closePaperPosition(opened.state, posId, 51000, "manual", 1700000050000);
    expect(closed.closedTrade).not.toBeNull();
    expect(closed.closedTrade?.realizedPnl).toBeCloseTo(200, 2);
    expect(closed.state.balance).toBeCloseTo(100200, 2);
    expect(closed.state.history).toHaveLength(1);
  });
});
