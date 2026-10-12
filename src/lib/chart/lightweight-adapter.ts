import {
  CandlestickData,
  HistogramData,
  LineData,
  SeriesMarker,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { CandlestickBar } from "../mexc/types";
import { BacktestTrade } from "../strategy/types";
import { ta } from "../indicators/ta-math";

/**
 * Converts a millisecond or second timestamp to a lightweight-charts UTCTimestamp (in seconds).
 */
export function toUtcTimestamp(timeMsOrSec: number): UTCTimestamp {
  return (timeMsOrSec > 1e11 ? Math.floor(timeMsOrSec / 1000) : Math.floor(timeMsOrSec)) as UTCTimestamp;
}

/**
 * Formats CandlestickBar array into lightweight-charts CandlestickData sorted by time ascending.
 */
export function formatCandlestickData(bars: CandlestickBar[]): CandlestickData<Time>[] {
  const sorted = [...bars].sort((a, b) => a.time - b.time);
  return sorted.map((bar) => ({
    time: toUtcTimestamp(bar.time),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  }));
}

/**
 * Formats CandlestickBar array into low-opacity volume histogram data:
 * Bull candles: rgba(0, 192, 135, 0.35)
 * Bear candles: rgba(255, 59, 48, 0.35)
 */
export function formatVolumeData(bars: CandlestickBar[]): HistogramData<Time>[] {
  const sorted = [...bars].sort((a, b) => a.time - b.time);
  return sorted.map((bar) => ({
    time: toUtcTimestamp(bar.time),
    value: bar.volume,
    color: bar.close >= bar.open ? "rgba(0, 192, 135, 0.35)" : "rgba(255, 59, 48, 0.35)",
  }));
}

/**
 * Calculates EMA series aligned accurately with candlestick timestamps.
 * Preserves the period offset (period - 1) so EMA values match their respective candle times.
 */
export function buildEmaLineData(bars: CandlestickBar[], period: number): LineData<Time>[] {
  if (bars.length < period) return [];
  const sorted = [...bars].sort((a, b) => a.time - b.time);
  const closes = sorted.map((b) => b.close);
  const emaValues = ta.ema(closes, period);
  const offset = period - 1;
  const lineData: LineData<Time>[] = [];

  for (let i = 0; i < emaValues.length; i++) {
    const bar = sorted[i + offset];
    if (bar && !isNaN(emaValues[i])) {
      lineData.push({
        time: toUtcTimestamp(bar.time),
        value: emaValues[i],
      });
    }
  }

  return lineData;
}

/**
 * Maps BacktestTrade executions to native lightweight-charts SeriesMarkers:
 * - Long Entry: Green arrowUp below bar
 * - Short Entry: Red arrowDown above bar
 * - Exits: Circle with return percentage tag
 * Strictly sorted in chronological order as required by lightweight-charts.
 */
export function buildTradeMarkers(
  trades: BacktestTrade[],
  bars: CandlestickBar[]
): SeriesMarker<Time>[] {
  if (!trades || trades.length === 0 || !bars || bars.length === 0) return [];

  const markers: SeriesMarker<Time>[] = [];
  const barTimes = new Set(bars.map((b) => toUtcTimestamp(b.time)));

  trades.forEach((trade, idx) => {
    // 1. Entry Marker
    let entryTime: UTCTimestamp | null = null;
    if (trade.entryTime) {
      entryTime = toUtcTimestamp(trade.entryTime);
    } else if (trade.entryBarIndex >= 0 && trade.entryBarIndex < bars.length) {
      entryTime = toUtcTimestamp(bars[trade.entryBarIndex].time);
    }

    if (entryTime && barTimes.has(entryTime)) {
      const isLong = trade.direction === "long";
      markers.push({
        time: entryTime,
        position: isLong ? "belowBar" : "aboveBar",
        shape: isLong ? "arrowUp" : "arrowDown",
        color: isLong ? "#00c087" : "#ff3b30",
        text: isLong ? "BUY" : "SELL",
        id: `entry-${trade.tradeId || idx}`,
      });
    }

    // 2. Exit Marker
    let exitTime: UTCTimestamp | null = null;
    if (trade.exitTime) {
      exitTime = toUtcTimestamp(trade.exitTime);
    } else if (trade.exitBarIndex >= 0 && trade.exitBarIndex < bars.length) {
      exitTime = toUtcTimestamp(bars[trade.exitBarIndex].time);
    }

    if (exitTime && barTimes.has(exitTime)) {
      const isProfitable = trade.netPnL >= 0;
      markers.push({
        time: exitTime,
        position: trade.direction === "long" ? "aboveBar" : "belowBar",
        shape: "circle",
        color: isProfitable ? "#00c087" : "#ff3b30",
        text: `${isProfitable ? "+" : ""}${trade.pnlPercent.toFixed(1)}%`,
        id: `exit-${trade.tradeId || idx}`,
      });
    }
  });

  // lightweight-charts strictly requires markers sorted ascending by time
  markers.sort((a, b) => Number(a.time) - Number(b.time));
  return markers;
}

/**
 * Merges older paginated bars with current bars, removing duplicates and sorting chronologically.
 */
export function mergeAndDeduplicateBars(
  olderBars: CandlestickBar[],
  currentBars: CandlestickBar[]
): CandlestickBar[] {
  const mergedMap = new Map<number, CandlestickBar>();
  for (const bar of olderBars) {
    mergedMap.set(bar.time, bar);
  }
  for (const bar of currentBars) {
    mergedMap.set(bar.time, bar);
  }
  return Array.from(mergedMap.values()).sort((a, b) => a.time - b.time);
}
