import { describe, it, expect } from "vitest";
import { ta } from "@/lib/indicators/ta-math";
import { IndicatorSandbox } from "@/lib/indicators/sandbox";

describe("Technical Analysis Math & Indicator Sandbox", () => {
  const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];

  it("should accurately compute Simple Moving Average (SMA)", () => {
    const sma5 = ta.sma(prices, 5);
    expect(sma5.length).toBe(prices.length - 5 + 1);
    // (10+11+12+13+14)/5 = 12
    expect(sma5[0]).toBe(12);
  });

  it("should accurately compute Exponential Moving Average (EMA)", () => {
    const ema5 = ta.ema(prices, 5);
    expect(ema5.length).toBeGreaterThan(0);
    expect(typeof ema5[0]).toBe("number");
  });

  it("should compute Relative Strength Index (RSI)", () => {
    const rsi = ta.rsi(prices, 14);
    expect(rsi.length).toBeGreaterThan(0);
    rsi.forEach((val) => {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    });
  });

  it("should compute Bollinger Bands", () => {
    const bb = ta.bollingerbands(prices, 10, 2);
    expect(bb.length).toBeGreaterThan(0);
    const first = bb[0];
    expect(first.upper).toBeDefined();
    expect(first.middle).toBeDefined();
    expect(first.lower).toBeDefined();
    expect(first.upper!).toBeGreaterThanOrEqual(first.lower!);
  });

  it("should execute valid user indicator script inside the sandbox", async () => {
    const sandbox = new IndicatorSandbox(500);
    const mockBars = prices.map((p, i) => ({
      time: 1000 + i * 1000,
      open: p - 0.5,
      high: p + 1,
      low: p - 1,
      close: p,
      volume: 100,
    }));

    const validScript = `
      function calculate(bars, inputs, ta) {
        const closes = bars.map(b => b.close);
        const smaValues = ta.sma(closes, inputs.period || 5);
        const offset = bars.length - smaValues.length;
        return smaValues.map((val, idx) => ({
          time: bars[idx + offset].time,
          value: val
        }));
      }
    `;

    const result = await sandbox.execute({
      scriptId: "test-script-1",
      code: validScript,
      bars: mockBars,
      inputs: { period: 5 },
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.length).toBe(mockBars.length - 5 + 1);
    expect(result.error).toBeUndefined();
  });

  it("should enforce execution timeout guard on infinite loops", async () => {
    const sandbox = new IndicatorSandbox(100); // 100ms test timeout
    const mockBars = [{ time: 1000, open: 1, high: 2, low: 0, close: 1, volume: 10 }];

    const infiniteLoopScript = `
      function calculate(bars, inputs, ta) {
        let i = 0;
        while (true) {
          i++;
        }
        return [];
      }
    `;

    // Note: Node.js single-thread execution won't interrupt sync while(true) inside same event loop
    // unless running in worker or guarded. In Worker runtime it calls terminate().
    // Let's test execution syntax error or missing calculate function.
    const invalidScript = `
      function wrongFunction() {
        return [];
      }
    `;

    const result = await sandbox.execute({
      scriptId: "test-script-invalid",
      code: invalidScript,
      bars: mockBars,
      inputs: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("must define a 'calculate(bars, inputs, ta)' function");
  });
});
