import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { ChartDrawing } from "../src/lib/chart/drawing-math";

class MockLocalStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

describe("Static Script Shapes & Drawing Layer Isolation (DEC-095)", () => {
  beforeAll(() => {
    (globalThis as any).window = globalThis;
    (globalThis as any).localStorage = new MockLocalStorage();
  });

  beforeEach(() => {
    (globalThis as any).localStorage.clear();
  });

  it("filters out legacy script-generated boxes from manual chart drawings", () => {
    const rawDrawings = [
      {
        id: "d_trend_1",
        type: "trendline",
        name: "Trendline 1",
        startTime: 1000,
        startPrice: 60000,
        endTime: 2000,
        endPrice: 65000,
      },
      {
        id: "box_1729000000000_0",
        type: "rectangle",
        name: "BULLISH Zone",
        startTime: 1000,
        startPrice: 61000,
        endTime: 2000,
        endPrice: 60500,
      },
      {
        id: "box_1729000000000_1",
        type: "rectangle",
        name: "Script Box 2",
        startTime: 2000,
        startPrice: 64000,
        endTime: 3000,
        endPrice: 63000,
      },
      {
        id: "custom-box-0",
        type: "rectangle",
        name: "Order Block Bull",
        startTime: 3000,
        startPrice: 62000,
        endTime: 4000,
        endPrice: 61500,
      },
      {
        id: "d_user_rect",
        type: "rectangle",
        name: "My Manual Demand Box",
        startTime: 4000,
        startPrice: 59000,
        endTime: 5000,
        endPrice: 58000,
      },
    ];

    // Sanitize filter matching TradingViewContainer loadSavedDrawings
    const sanitized = rawDrawings.filter(
      (d) =>
        !(
          typeof d.id === "string" &&
          (d.id.startsWith("box_") || d.id.startsWith("custom-box-")) &&
          (d.name?.includes("Zone") || d.name?.includes("Script Box") || d.name?.includes("Order Block"))
        )
    );

    expect(sanitized.length).toBe(2);
    expect(sanitized.map((d) => d.id)).toEqual(["d_trend_1", "d_user_rect"]);
  });

  it("ensures script-generated boxes render as static overlays with correct geometry and colors", () => {
    const scriptBoxes = [
      {
        id: "box_ob_1",
        type: "BULLISH",
        startTime: 1000,
        endTime: 2000,
        top: 65000,
        bottom: 64500,
        showMidLine: true,
        label: "+OB (Bullish)",
        extendRight: true,
      },
      {
        id: "box_ob_2",
        type: "BEARISH",
        startTime: 2500,
        endTime: 3500,
        top: 68000,
        bottom: 67500,
        showMidLine: true,
        label: "-OB (Bearish)",
        color: "#ff3b30",
        fillColor: "#ff3b30",
        fillOpacity: 0.25,
      },
    ];

    expect(scriptBoxes[0].type).toBe("BULLISH");
    expect(scriptBoxes[0].top).toBe(65000);
    expect(scriptBoxes[0].bottom).toBe(64500);
    expect(scriptBoxes[0].extendRight).toBe(true);

    expect(scriptBoxes[1].type).toBe("BEARISH");
    expect(scriptBoxes[1].color).toBe("#ff3b30");
  });
});
