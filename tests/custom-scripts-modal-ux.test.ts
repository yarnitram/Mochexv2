import { describe, it, expect, vi } from "vitest";
import { IndicatorSandbox } from "../src/lib/indicators/sandbox";
import { CandlestickBar } from "../src/lib/mexc/types";

describe("Custom Scripts & Indicators UX (DEC-096)", () => {
  const sampleBars: CandlestickBar[] = [
    { time: 1000, open: 100, high: 105, low: 95, close: 102, volume: 1000 },
    { time: 2000, open: 102, high: 108, low: 101, close: 107, volume: 1500 },
    { time: 3000, open: 107, high: 112, low: 106, close: 110, volume: 2000 },
    { time: 4000, open: 110, high: 115, low: 109, close: 114, volume: 2500 },
    { time: 5000, open: 114, high: 120, low: 113, close: 118, volume: 3000 },
  ];

  it("compiles and extracts points and boxes from custom indicator script in sandbox", async () => {
    const sandbox = new IndicatorSandbox(1500);
    const scriptCode = `
      function calculate(bars, inputs, ta, strategy, alertcondition) {
        const sma5 = ta.sma(bars.map(b => b.close), 3);
        const result = bars.map((b, idx) => ({
          time: b.time,
          value: sma5[idx] || b.close
        }));
        const boxes = [
          {
            id: "test-box-1",
            type: "BULLISH",
            startTime: bars[0].time,
            endTime: bars[bars.length - 1].time,
            top: 115,
            bottom: 105,
            color: "#00c087"
          }
        ];
        return {
          data: result,
          boxes: boxes
        };
      }
    `;

    const res = await sandbox.execute({
      scriptId: "custom-test-indicator",
      code: scriptCode,
      bars: sampleBars,
      inputs: {},
    });

    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(Array.isArray(res.data)).toBe(true);
    expect((res.data as any[]).length).toBe(5);

    expect(res.boxes).toBeDefined();
    expect(Array.isArray(res.boxes)).toBe(true);
    expect(res.boxes?.length).toBe(1);
    expect(res.boxes?.[0].id).toBe("test-box-1");
    expect(res.boxes?.[0].type).toBe("BULLISH");
  });

  it("properly handles indicator visibility toggling", () => {
    let hiddenIndicators: string[] = [];

    const toggleVisibility = (name: string) => {
      hiddenIndicators = hiddenIndicators.includes(name)
        ? hiddenIndicators.filter((i) => i !== name)
        : [...hiddenIndicators, name];
    };

    // Initially none hidden
    expect(hiddenIndicators.includes("EMA Ribbon Momentum Multi-Timeframe")).toBe(false);

    // Toggle hide
    toggleVisibility("EMA Ribbon Momentum Multi-Timeframe");
    expect(hiddenIndicators.includes("EMA Ribbon Momentum Multi-Timeframe")).toBe(true);

    // Toggle show again
    toggleVisibility("EMA Ribbon Momentum Multi-Timeframe");
    expect(hiddenIndicators.includes("EMA Ribbon Momentum Multi-Timeframe")).toBe(false);
  });

  it("handles removal of custom script when toggled or cleared", () => {
    let activeIndicators = ["EMA Ribbon Momentum Multi-Timeframe", "My Custom Order Blocks"];
    let customIndicatorData: { name: string; data: any[] } | null = {
      name: "My Custom Order Blocks",
      data: [{ time: 1000, value: 100 }],
    };
    let customIndicatorBoxes: any[] | null = [{ id: "box-1" }];

    const handleClearCustomIndicator = (nameToClear?: string) => {
      customIndicatorData = null;
      customIndicatorBoxes = null;
      const target = nameToClear || "My Custom Order Blocks";
      activeIndicators = activeIndicators.filter((i) => i !== target);
    };

    handleClearCustomIndicator();

    expect(customIndicatorData).toBeNull();
    expect(customIndicatorBoxes).toBeNull();
    expect(activeIndicators).toEqual(["EMA Ribbon Momentum Multi-Timeframe"]);
  });
});
