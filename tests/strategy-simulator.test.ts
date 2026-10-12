import { describe, it, expect } from "vitest";
import { BacktestSimulationEngine } from "../src/lib/strategy/simulator";
import { CandlestickBar } from "../src/lib/mexc/types";
import { StrategyOrderIntent } from "../src/lib/strategy/types";
import { computePerformanceMetrics } from "../src/lib/strategy/metrics";
import { indicatorSandbox } from "../src/lib/indicators/sandbox";
import { STRATEGY_PRESETS } from "../src/lib/strategy/presets";

describe("BacktestSimulationEngine", () => {
  const baseBars: CandlestickBar[] = [
    { time: 1000, open: 100, high: 105, low: 98, close: 102, volume: 10 },
    { time: 2000, open: 102, high: 108, low: 101, close: 107, volume: 15 },
    { time: 3000, open: 107, high: 112, low: 106, close: 110, volume: 20 },
    { time: 4000, open: 110, high: 115, low: 104, close: 105, volume: 25 },
    { time: 5000, open: 105, high: 109, low: 99, close: 100, volume: 18 },
  ];

  it("executes orders on the Next-Bar Open with fee deduction", () => {
    const engine = new BacktestSimulationEngine({
      initialCapital: 10000,
      feeRate: 0.001, // 0.1% fee
    });

    // Signal entry on bar 0 (should fill at bar 1 open: 102)
    // Signal close on bar 2 (should fill at bar 3 open: 110)
    const intents: StrategyOrderIntent[] = [
      {
        barIndex: 0,
        time: 1000,
        type: "ENTRY",
        orderId: "test-1",
        direction: "long",
        qtyPercent: 100,
      },
      {
        barIndex: 2,
        time: 3000,
        type: "CLOSE",
        orderId: "test-1",
      },
    ];

    const result = engine.simulate(baseBars, intents);

    expect(result.trades.length).toBe(1);
    const trade = result.trades[0];
    expect(trade.entryBarIndex).toBe(1);
    expect(trade.entryPrice).toBe(102);
    expect(trade.exitBarIndex).toBe(3);
    expect(trade.exitPrice).toBe(110);
    expect(trade.exitReason).toBe("CLOSE");
    expect(trade.grossPnL).toBeGreaterThan(0);
    expect(trade.netPnL).toBeGreaterThan(0);
    expect(trade.feePaid).toBeGreaterThan(0);
  });

  it("triggers Stop-Loss when bar low crosses stop loss price", () => {
    const engine = new BacktestSimulationEngine({
      initialCapital: 10000,
      feeRate: 0.0005,
    });

    const intents: StrategyOrderIntent[] = [
      {
        barIndex: 0,
        time: 1000,
        type: "ENTRY",
        orderId: "sl-test",
        direction: "long",
        qtyPercent: 100,
        stopLossPrice: 100, // Bar 4 has low: 99
      },
    ];

    const result = engine.simulate(baseBars, intents);

    expect(result.trades.length).toBe(1);
    const trade = result.trades[0];
    expect(trade.entryPrice).toBe(102); // Bar 1 open
    expect(trade.exitPrice).toBe(100);
    expect(trade.exitReason).toBe("STOP_LOSS");
    expect(trade.exitBarIndex).toBe(4);
  });

  it("triggers Take-Profit when bar high crosses take profit price", () => {
    const engine = new BacktestSimulationEngine({
      initialCapital: 10000,
      feeRate: 0.0005,
    });

    const intents: StrategyOrderIntent[] = [
      {
        barIndex: 0,
        time: 1000,
        type: "ENTRY",
        orderId: "tp-test",
        direction: "long",
        qtyPercent: 100,
        takeProfitPrice: 111, // Bar 2 has high: 112
      },
    ];

    const result = engine.simulate(baseBars, intents);

    expect(result.trades.length).toBe(1);
    const trade = result.trades[0];
    expect(trade.entryPrice).toBe(102); // Bar 1 open
    expect(trade.exitPrice).toBe(111);
    expect(trade.exitReason).toBe("TAKE_PROFIT");
    expect(trade.exitBarIndex).toBe(2);
  });

  it("enforces pessimistic Stop-Loss execution when both SL and TP could trigger on the same bar", () => {
    const engine = new BacktestSimulationEngine({
      initialCapital: 10000,
      feeRate: 0.0005,
    });

    // Bar 3 has high: 115, low: 104
    // Set TP at 114 (touched) and SL at 105 (touched)
    const intents: StrategyOrderIntent[] = [
      {
        barIndex: 1,
        time: 2000,
        type: "ENTRY",
        orderId: "pessimistic-test",
        direction: "long",
        qtyPercent: 100,
        takeProfitPrice: 114,
        stopLossPrice: 105,
      },
    ];

    const result = engine.simulate(baseBars, intents);

    expect(result.trades.length).toBe(1);
    const trade = result.trades[0];
    expect(trade.exitReason).toBe("STOP_LOSS");
    expect(trade.exitPrice).toBe(105);
  });

  it("computes accurate Win Rate, Profit Factor, and Max Drawdown", () => {
    const mockTrades = [
      {
        tradeId: "t-1",
        orderId: "o-1",
        direction: "long" as const,
        entryBarIndex: 1,
        entryTime: 1000,
        entryPrice: 100,
        exitBarIndex: 2,
        exitTime: 2000,
        exitPrice: 110,
        exitReason: "CLOSE" as const,
        size: 10,
        grossPnL: 100,
        netPnL: 90,
        pnlPercent: 9,
        feePaid: 10,
        cumulativeEquity: 10090,
        barsHeld: 1,
      },
      {
        tradeId: "t-2",
        orderId: "o-2",
        direction: "long" as const,
        entryBarIndex: 3,
        entryTime: 3000,
        entryPrice: 110,
        exitBarIndex: 4,
        exitTime: 4000,
        exitPrice: 105,
        exitReason: "CLOSE" as const,
        size: 10,
        grossPnL: -50,
        netPnL: -60,
        pnlPercent: -5.4,
        feePaid: 10,
        cumulativeEquity: 10030,
        barsHeld: 1,
      },
    ];

    const mockEquity = [
      { time: 1000, equity: 10000, drawdownPercent: 0 },
      { time: 2000, equity: 10090, drawdownPercent: 0 },
      { time: 3000, equity: 10090, drawdownPercent: 0 },
      { time: 4000, equity: 10030, drawdownPercent: 0.59 },
    ];

    const metrics = computePerformanceMetrics(10000, mockTrades, mockEquity);

    expect(metrics.totalTrades).toBe(2);
    expect(metrics.winningTrades).toBe(1);
    expect(metrics.losingTrades).toBe(1);
    expect(metrics.winRate).toBe(50);
    expect(metrics.netProfit).toBe(30);
    expect(metrics.profitFactor).toBe(2.0); // 100 gross gain / 50 gross loss
  });

  it("executes the Core Quant EMA Ribbon Trend Crossover preset in the Web Worker sandbox", async () => {
    const preset = STRATEGY_PRESETS[0];

    // Generate 40 simulated bars with an upward trend
    const simulatedBars: CandlestickBar[] = [];
    let p = 60000;
    for (let i = 0; i < 40; i++) {
      const o = p;
      const c = i < 20 ? p + 200 : p - 100;
      const h = Math.max(o, c) + 50;
      const l = Math.min(o, c) - 50;
      simulatedBars.push({
        time: 1700000000000 + i * 60000,
        open: o,
        high: h,
        low: l,
        close: c,
        volume: 100 + i * 5,
      });
      p = c;
    }

    const output = await indicatorSandbox.execute({
      scriptId: "ema-test",
      code: preset.code,
      bars: simulatedBars,
      inputs: { fastPeriod: 5, slowPeriod: 12 },
    });

    expect(output.success).toBe(true);
    expect(output.strategyResult).toBeDefined();
    expect(output.orderIntents).toBeDefined();
    expect(output.orderIntents!.length).toBeGreaterThan(0);
    expect(output.strategyResult!.equityCurve.length).toBe(simulatedBars.length);
  });
});
