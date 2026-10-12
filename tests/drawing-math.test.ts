import { describe, it, expect } from "vitest";
import {
  calculateFibLevels,
  calculatePositionMetrics,
  calculateRulerMetrics,
  isPointNearSegment,
  findNearestCandlePoint,
} from "@/lib/chart/drawing-math";
import { CandlestickBar } from "@/lib/mexc/types";

describe("Geometric Drawing Math Engine (DEC-040 to DEC-042)", () => {
  it("should calculate Fibonacci Retracement levels correctly", () => {
    const startPrice = 100;
    const endPrice = 200;
    const levels = calculateFibLevels(startPrice, endPrice);

    expect(levels.length).toBe(7);
    // 0.0 is at 200 (endPrice)
    const lvl0 = levels.find((l) => l.ratio === 0.0);
    expect(lvl0?.price).toBe(200);

    // 0.5 is at 150
    const lvl05 = levels.find((l) => l.ratio === 0.5);
    expect(lvl05?.price).toBe(150);

    // 1.0 is at 100 (startPrice)
    const lvl1 = levels.find((l) => l.ratio === 1.0);
    expect(lvl1?.price).toBe(100);

    // 0.618 golden ratio
    const lvl618 = levels.find((l) => l.ratio === 0.618);
    expect(lvl618?.price).toBeCloseTo(138.2, 1);
  });

  it("should calculate Long and Short Position Metrics with accurate Risk/Reward", () => {
    // Long trade: start 100, target 120 (+20%)
    const longPos = calculatePositionMetrics(100, 120);
    expect(longPos.isLong).toBe(true);
    expect(longPos.entryPrice).toBe(100);
    expect(longPos.targetPrice).toBe(120);
    expect(longPos.targetPercent).toBe(20);
    expect(longPos.stopPrice).toBe(90); // 50% stop default
    expect(longPos.riskRewardRatio).toBe(2.0);

    // Short trade: start 100, target 80 (-20%)
    const shortPos = calculatePositionMetrics(100, 80);
    expect(shortPos.isLong).toBe(false);
    expect(shortPos.entryPrice).toBe(100);
    expect(shortPos.targetPrice).toBe(80);
    expect(shortPos.stopPrice).toBe(110);
    expect(shortPos.riskRewardRatio).toBe(2.0);
  });

  it("should calculate Ruler measurement metrics across bars", () => {
    const bars: CandlestickBar[] = [
      { time: 1000, open: 100, high: 105, low: 95, close: 102, volume: 10 },
      { time: 2000, open: 102, high: 108, low: 101, close: 106, volume: 15 },
      { time: 3000, open: 106, high: 112, low: 104, close: 110, volume: 20 },
      { time: 4000, open: 110, high: 115, low: 108, close: 114, volume: 25 },
    ];

    const ruler = calculateRulerMetrics(100, 114, 1000, 4000, bars);
    expect(ruler.deltaPrice).toBe(14);
    expect(ruler.deltaPercent).toBeCloseTo(14, 1);
    expect(ruler.barCount).toBe(4);
    expect(ruler.durationMs).toBe(3000);
  });

  it("should detect point near line segment for hit testing", () => {
    // Line from (0, 0) to (100, 100)
    expect(isPointNearSegment(50, 50, 0, 0, 100, 100, 5)).toBe(true);
    expect(isPointNearSegment(50, 52, 0, 0, 100, 100, 5)).toBe(true);
    expect(isPointNearSegment(50, 60, 0, 0, 100, 100, 5)).toBe(false);
    // Point beyond segment ends
    expect(isPointNearSegment(110, 110, 0, 0, 100, 100, 5)).toBe(false);
  });

  it("should snap to nearest candle OHLC with smart magnet", () => {
    const bars: CandlestickBar[] = [
      { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 50 },
    ];

    // Mock coordinate functions: timeToCoord maps 1000 -> 50px, priceToCoord maps price -> price px
    const timeToCoord = (t: number) => (t === 1000 ? 50 : null);
    const priceToCoord = (p: number) => 500 - p;

    // Cursor at x: 52 (near x: 50), y: 392 (near high price 110 -> 390px)
    const snapped = findNearestCandlePoint(52, 392, bars, timeToCoord, priceToCoord, 20);
    expect(snapped).not.toBeNull();
    expect(snapped?.time).toBe(1000);
    expect(snapped?.price).toBe(110); // Snapped to high
  });
});
