import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import {
  computeMarketStructure,
  DEFAULT_MARKET_STRUCTURE_SETTINGS,
  getStoredMarketStructureSettings,
  saveMarketStructureSettings,
  MARKET_STRUCTURE_SETTINGS_STORAGE_KEY,
} from "../src/lib/indicators/market-structure";
import { CandlestickBar } from "../src/lib/mexc/types";

// Mock localStorage for node environment
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

describe("Market Structure Engine", () => {
  beforeAll(() => {
    (globalThis as any).window = globalThis;
    (globalThis as any).localStorage = localStorageMock;
  });

  beforeEach(() => {
    localStorageMock.clear();
  });

  it("handles empty bars array gracefully", () => {
    const res = computeMarketStructure([]);
    expect(res.majorSwings).toEqual([]);
    expect(res.subSwings).toEqual([]);
    expect(res.breakouts).toEqual([]);
  });

  it("detects swing highs, lows, and tags alternating swings (HH, HL, LH, LL)", () => {
    // Generate a synthetic wave of 50 bars with clear peaks and valleys
    const bars: CandlestickBar[] = [];
    let price = 100;
    const baseTime = 1700000000000;

    // Up wave to 150
    for (let i = 0; i < 15; i++) {
      price += 3;
      bars.push({
        time: baseTime + i * 60000,
        open: price - 1,
        high: price + 1,
        low: price - 2,
        close: price,
        volume: 100,
      });
    }
    // Pullback to 120
    for (let i = 15; i < 25; i++) {
      price -= 2.5;
      bars.push({
        time: baseTime + i * 60000,
        open: price + 1,
        high: price + 2,
        low: price - 1,
        close: price,
        volume: 100,
      });
    }
    // Strong expansion to 180
    for (let i = 25; i < 40; i++) {
      price += 4;
      bars.push({
        time: baseTime + i * 60000,
        open: price - 1,
        high: price + 1,
        low: price - 2,
        close: price,
        volume: 100,
      });
    }
    // Pullback to 160
    for (let i = 40; i < 50; i++) {
      price -= 2;
      bars.push({
        time: baseTime + i * 60000,
        open: price + 1,
        high: price + 2,
        low: price - 1,
        close: price,
        volume: 100,
      });
    }

    const result = computeMarketStructure(bars, {
      majorLength: 4,
      subLength: 2,
    });

    expect(result.majorSwings.length).toBeGreaterThan(0);
    // First high should be tagged
    const firstHigh = result.majorSwings.find((s) => s.type === "HIGH");
    expect(firstHigh).toBeDefined();
    expect(firstHigh?.tag).toBe("HH");
  });

  it("detects Break of Structure (BOS) when trend continues higher", () => {
    const bars: CandlestickBar[] = [];
    const baseTime = 1700000000000;

    // Peak at bar 5 with high 110
    for (let i = 0; i < 5; i++) {
      bars.push({
        time: baseTime + i * 60000,
        open: 100 + i * 2,
        high: 101 + i * 2,
        low: 99 + i * 2,
        close: 100 + i * 2,
        volume: 100,
      });
    }
    // Pivot High at bar 5
    bars.push({
      time: baseTime + 5 * 60000,
      open: 108,
      high: 115,
      low: 107,
      close: 109,
      volume: 150,
    });
    // Dip to 102
    for (let i = 6; i < 11; i++) {
      bars.push({
        time: baseTime + i * 60000,
        open: 107 - (i - 5),
        high: 108 - (i - 5),
        low: 106 - (i - 5),
        close: 106 - (i - 5),
        volume: 100,
      });
    }
    // Breakout above 115
    for (let i = 11; i < 16; i++) {
      bars.push({
        time: baseTime + i * 60000,
        open: 110 + (i - 10) * 3,
        high: 112 + (i - 10) * 3,
        low: 109 + (i - 10) * 3,
        close: 111 + (i - 10) * 3,
        volume: 200,
      });
    }

    const result = computeMarketStructure(bars, {
      subLength: 2,
      majorLength: 3,
      confirmation: "close",
    });

    const bullishBreakout = result.breakouts.find(
      (b) => b.direction === "BULLISH"
    );
    expect(bullishBreakout).toBeDefined();
    expect(bullishBreakout?.level).toBe(115);
  });

  it("differentiates between close and wick confirmation", () => {
    const bars: CandlestickBar[] = [
      { time: 1000, open: 100, high: 105, low: 95, close: 102, volume: 10 },
      { time: 2000, open: 102, high: 110, low: 100, close: 104, volume: 10 }, // High 110
      { time: 3000, open: 104, high: 106, low: 101, close: 102, volume: 10 },
      { time: 4000, open: 102, high: 105, low: 98, close: 99, volume: 10 },   // Low 98
      { time: 5000, open: 99, high: 103, low: 97, close: 101, volume: 10 },
      // Bar 6 has wick above 110 (high 112) but closes at 108 (below 110)
      { time: 6000, open: 101, high: 112, low: 100, close: 108, volume: 10 },
    ];

    // With "close" confirmation: bar 6 did NOT close above 110
    const closeRes = computeMarketStructure(bars, {
      majorLength: 1,
      subLength: 1,
      confirmation: "close",
    });
    const closeBreak = closeRes.breakouts.find(
      (b) => b.toTime === 6000 && b.direction === "BULLISH"
    );
    expect(closeBreak).toBeUndefined();

    // With "wick" confirmation: bar 6 pierced 110 with high 112
    const wickRes = computeMarketStructure(bars, {
      majorLength: 1,
      subLength: 1,
      confirmation: "wick",
    });
    const wickBreak = wickRes.breakouts.find(
      (b) => b.toTime === 6000 && b.direction === "BULLISH"
    );
    expect(wickBreak).toBeDefined();
  });

  it("persists and rehydrates settings from localStorage", () => {
    expect(getStoredMarketStructureSettings()).toEqual(
      DEFAULT_MARKET_STRUCTURE_SETTINGS
    );

    const custom = saveMarketStructureSettings({
      majorLength: 15,
      subLength: 5,
      confirmation: "wick",
      majorColor: "#00e676",
    });

    expect(custom.majorLength).toBe(15);
    expect(custom.subLength).toBe(5);
    expect(custom.confirmation).toBe("wick");
    expect(custom.majorColor).toBe("#00e676");

    const rehydrated = getStoredMarketStructureSettings();
    expect(rehydrated.majorLength).toBe(15);
    expect(rehydrated.majorColor).toBe("#00e676");
  });
});
