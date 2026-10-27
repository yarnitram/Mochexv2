import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import {
  computeCandleMarketStructure,
  DEFAULT_CANDLE_STRUCTURE_SETTINGS,
  getStoredCandleStructureSettings,
  saveCandleStructureSettings,
} from "../src/lib/indicators/candle-structure";
import { CandlestickBar } from "../src/lib/mexc/types";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

describe("Candle-Stick Based Market Structure Engine", () => {
  beforeAll(() => {
    (globalThis as any).window = globalThis;
    (globalThis as any).localStorage = localStorageMock;
  });

  beforeEach(() => {
    localStorageMock.clear();
  });

  it("handles empty bars array gracefully", () => {
    const res = computeCandleMarketStructure([]);
    expect(res.swings).toEqual([]);
    expect(res.breaks).toEqual([]);
  });

  it("detects 3-bar candlestick Swing Highs and Swing Lows", () => {
    const bars: CandlestickBar[] = [
      { time: 1000, open: 100, high: 105, low: 95, close: 102, volume: 10 },
      { time: 2000, open: 102, high: 115, low: 100, close: 110, volume: 20 }, // Swing High: flanked by 105 and 108
      { time: 3000, open: 110, high: 108, low: 92, close: 94, volume: 15 },   // Swing Low: flanked by 100 and 96
      { time: 4000, open: 94, high: 106, low: 96, close: 104, volume: 12 },
    ];

    const res = computeCandleMarketStructure(bars, { flankBars: 1 });
    expect(res.swings.length).toBe(2);

    const sh = res.swings.find((s) => s.type === "HIGH");
    expect(sh).toBeDefined();
    expect(sh?.price).toBe(115);
    expect(sh?.tag).toBe("SH");

    const sl = res.swings.find((s) => s.type === "LOW");
    expect(sl).toBeDefined();
    expect(sl?.price).toBe(92);
    expect(sl?.tag).toBe("SL");
  });

  it("detects Market Structure Shift (MSS) on candle-close breakout", () => {
    const bars: CandlestickBar[] = [
      { time: 1000, open: 100, high: 105, low: 95, close: 102, volume: 10 },
      { time: 2000, open: 102, high: 115, low: 100, close: 110, volume: 20 }, // Swing High 115
      { time: 3000, open: 110, high: 108, low: 92, close: 94, volume: 15 },
      { time: 4000, open: 94, high: 106, low: 93, close: 104, volume: 12 },
      { time: 5000, open: 104, high: 118, low: 103, close: 117, volume: 30 }, // Closes above 115 -> Bullish MSS
    ];

    const res = computeCandleMarketStructure(bars, {
      flankBars: 1,
      breakoutConfirmation: "close",
    });

    expect(res.breaks.length).toBeGreaterThan(0);
    const mss = res.breaks[0];
    expect(mss.direction).toBe("BULLISH");
    expect(mss.level).toBe(115);
    expect(mss.type).toBe("MSS");
  });

  it("differentiates between close and wick confirmation", () => {
    const bars: CandlestickBar[] = [
      { time: 1000, open: 100, high: 105, low: 95, close: 102, volume: 10 },
      { time: 2000, open: 102, high: 110, low: 100, close: 105, volume: 10 }, // High 110
      { time: 3000, open: 105, high: 107, low: 98, close: 100, volume: 10 },
      { time: 4000, open: 100, high: 104, low: 96, close: 99, volume: 10 },
      // Bar 5 has high 112 (wick above 110) but closes at 108 (below 110)
      { time: 5000, open: 99, high: 112, low: 98, close: 108, volume: 10 },
    ];

    const closeRes = computeCandleMarketStructure(bars, {
      flankBars: 1,
      breakoutConfirmation: "close",
    });
    expect(closeRes.breaks.length).toBe(0);

    const wickRes = computeCandleMarketStructure(bars, {
      flankBars: 1,
      breakoutConfirmation: "wick",
    });
    expect(wickRes.breaks.length).toBe(1);
    expect(wickRes.breaks[0].level).toBe(110);
  });

  it("persists and rehydrates settings from localStorage", () => {
    expect(getStoredCandleStructureSettings()).toEqual(
      DEFAULT_CANDLE_STRUCTURE_SETTINGS
    );

    const updated = saveCandleStructureSettings({
      flankBars: 2,
      labelType: "HH_LL",
      swingHighColor: "#00e676",
    });

    expect(updated.flankBars).toBe(2);
    expect(updated.labelType).toBe("HH_LL");
    expect(updated.swingHighColor).toBe("#00e676");

    const rehydrated = getStoredCandleStructureSettings();
    expect(rehydrated.flankBars).toBe(2);
    expect(rehydrated.labelType).toBe("HH_LL");
  });
});
