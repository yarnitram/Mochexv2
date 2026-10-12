import { DrawingToolType } from "@/components/terminal/DrawingRail";
import { CandlestickBar } from "@/lib/mexc/types";

export interface ChartDrawing {
  id: string;
  type: DrawingToolType;
  startTime: number; // UTC millisecond timestamp
  startPrice: number;
  endTime: number; // UTC millisecond timestamp
  endPrice: number;
  color?: string;
  isLocked?: boolean;
  text?: string;
}

export interface FibLevel {
  ratio: number;
  price: number;
  color: string;
  bg: string;
}

export const FIB_CONFIG = [
  { ratio: 0.0, color: "rgba(141, 144, 162, 0.9)", bg: "rgba(141, 144, 162, 0.08)" },
  { ratio: 0.236, color: "rgba(245, 172, 55, 0.9)", bg: "rgba(245, 172, 55, 0.08)" },
  { ratio: 0.382, color: "rgba(255, 213, 79, 0.9)", bg: "rgba(255, 213, 79, 0.08)" },
  { ratio: 0.5, color: "rgba(144, 202, 249, 0.9)", bg: "rgba(144, 202, 249, 0.08)" },
  { ratio: 0.618, color: "rgba(0, 216, 255, 0.95)", bg: "rgba(0, 216, 255, 0.12)" },
  { ratio: 0.786, color: "rgba(147, 83, 211, 0.9)", bg: "rgba(147, 83, 211, 0.08)" },
  { ratio: 1.0, color: "rgba(141, 144, 162, 0.9)", bg: "rgba(141, 144, 162, 0.08)" },
];

/**
 * Calculates standard Fibonacci Retracement levels from start price to end price.
 */
export function calculateFibLevels(startPrice: number, endPrice: number): FibLevel[] {
  const diff = endPrice - startPrice;
  return FIB_CONFIG.map((lvl) => ({
    ratio: lvl.ratio,
    price: startPrice + diff * (1 - lvl.ratio),
    color: lvl.color,
    bg: lvl.bg,
  }));
}

export interface PositionMetrics {
  isLong: boolean;
  entryPrice: number;
  targetPrice: number;
  stopPrice: number;
  riskRewardRatio: number;
  targetPercent: number;
  stopPercent: number;
}

/**
 * Computes Risk/Reward metrics and stop/target price zones for Long/Short positions.
 */
export function calculatePositionMetrics(startPrice: number, endPrice: number): PositionMetrics {
  const isLong = endPrice >= startPrice;
  const entryPrice = startPrice;
  const targetPrice = endPrice;

  // Default stop distance: 50% of target distance or 1.5% minimum
  const targetDiff = Math.abs(targetPrice - entryPrice);
  const stopDiff = targetDiff > 0 ? targetDiff * 0.5 : entryPrice * 0.015;
  const stopPrice = isLong ? entryPrice - stopDiff : entryPrice + stopDiff;

  const targetPercent = entryPrice > 0 ? ((targetPrice - entryPrice) / entryPrice) * 100 : 0;
  const stopPercent = entryPrice > 0 ? ((stopPrice - entryPrice) / entryPrice) * 100 : 0;
  const riskRewardRatio = stopDiff > 0 ? targetDiff / stopDiff : 0;

  return {
    isLong,
    entryPrice,
    targetPrice,
    stopPrice,
    riskRewardRatio,
    targetPercent,
    stopPercent,
  };
}

export interface RulerMetrics {
  deltaPrice: number;
  deltaPercent: number;
  barCount: number;
  durationMs: number;
}

/**
 * Calculates Price and Bar count measurement between two points.
 */
export function calculateRulerMetrics(
  startPrice: number,
  endPrice: number,
  startTime: number,
  endTime: number,
  bars: CandlestickBar[]
): RulerMetrics {
  const deltaPrice = endPrice - startPrice;
  const deltaPercent = startPrice > 0 ? Number(((deltaPrice / startPrice) * 100).toFixed(4)) : 0;
  const minTime = Math.min(startTime, endTime);
  const maxTime = Math.max(startTime, endTime);
  const durationMs = maxTime - minTime;

  const barsInRange = bars.filter((b) => b.time >= minTime && b.time <= maxTime);
  const barCount = Math.max(1, barsInRange.length);

  return {
    deltaPrice,
    deltaPercent,
    barCount,
    durationMs,
  };
}

/**
 * Smart OHLC candle magnet snapping (DEC-042).
 * Searches for nearest candle and snaps to closest OHLC point within thresholdPx.
 */
export function findNearestCandlePoint(
  cursorX: number,
  cursorY: number,
  bars: CandlestickBar[],
  timeToCoordinate: (timeMs: number) => number | null,
  priceToCoordinate: (price: number) => number | null,
  thresholdPx = 25
): { time: number; price: number; x: number; y: number } | null {
  if (bars.length === 0) return null;

  let bestMatch: { time: number; price: number; x: number; y: number; dist: number } | null = null;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const barX = timeToCoordinate(bar.time);
    if (barX === null) continue;

    const dx = Math.abs(cursorX - barX);
    if (dx > thresholdPx) continue;

    // Test Open, High, Low, Close
    const levels = [
      { price: bar.high, y: priceToCoordinate(bar.high) },
      { price: bar.low, y: priceToCoordinate(bar.low) },
      { price: bar.open, y: priceToCoordinate(bar.open) },
      { price: bar.close, y: priceToCoordinate(bar.close) },
    ];

    for (const lvl of levels) {
      if (lvl.y === null) continue;
      const dy = Math.abs(cursorY - lvl.y);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= thresholdPx && (!bestMatch || dist < bestMatch.dist)) {
        bestMatch = {
          time: bar.time,
          price: lvl.price,
          x: barX,
          y: lvl.y,
          dist,
        };
      }
    }
  }

  return bestMatch ? { time: bestMatch.time, price: bestMatch.price, x: bestMatch.x, y: bestMatch.y } : null;
}

/**
 * Distance between point (px, py) and segment (x1, y1) - (x2, y2).
 */
export function isPointNearSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  maxDistance = 8
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const d = Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    return d <= maxDistance;
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  const dist = Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));

  return dist <= maxDistance;
}
