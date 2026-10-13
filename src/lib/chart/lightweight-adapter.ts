import {
  CandlestickData,
  HistogramData,
  LineData,
  SeriesMarker,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { CandlestickBar } from "../mexc/types";
import { BacktestTrade, EquityPoint } from "../strategy/types";
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

export interface BollingerBandsSeriesData {
  upper: LineData<Time>[];
  middle: LineData<Time>[];
  lower: LineData<Time>[];
}

/**
 * Calculates Bollinger Bands series (Upper, Middle, Lower) aligned with bar timestamps.
 */
export function buildBollingerBandsData(
  bars: CandlestickBar[],
  period = 20,
  stdDev = 2
): BollingerBandsSeriesData {
  if (bars.length < period) return { upper: [], middle: [], lower: [] };
  const sorted = [...bars].sort((a, b) => a.time - b.time);
  const closes = sorted.map((b) => b.close);
  const bb = ta.bollingerbands(closes, period, stdDev);
  const offset = period - 1;

  const upper: LineData<Time>[] = [];
  const middle: LineData<Time>[] = [];
  const lower: LineData<Time>[] = [];

  for (let i = 0; i < bb.length; i++) {
    const bar = sorted[i + offset];
    if (bar && bb[i].upper !== undefined && bb[i].middle !== undefined && bb[i].lower !== undefined) {
      const time = toUtcTimestamp(bar.time);
      upper.push({ time, value: bb[i].upper! });
      middle.push({ time, value: bb[i].middle! });
      lower.push({ time, value: bb[i].lower! });
    }
  }

  return { upper, middle, lower };
}

/**
 * Calculates RSI line series aligned with bar timestamps.
 */
export function buildRsiData(bars: CandlestickBar[], period = 14): LineData<Time>[] {
  if (bars.length <= period) return [];
  const sorted = [...bars].sort((a, b) => a.time - b.time);
  const closes = sorted.map((b) => b.close);
  const rsi = ta.rsi(closes, period);
  const offset = period;
  const lineData: LineData<Time>[] = [];

  for (let i = 0; i < rsi.length; i++) {
    const bar = sorted[i + offset];
    if (bar && !isNaN(rsi[i])) {
      lineData.push({
        time: toUtcTimestamp(bar.time),
        value: rsi[i],
      });
    }
  }

  return lineData;
}

export interface MacdSeriesData {
  macd: LineData<Time>[];
  signal: LineData<Time>[];
  histogram: HistogramData<Time>[];
}

/**
 * Calculates MACD line, signal line, and histogram series aligned with bar timestamps.
 */
export function buildMacdData(
  bars: CandlestickBar[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MacdSeriesData {
  if (bars.length <= slowPeriod) return { macd: [], signal: [], histogram: [] };
  const sorted = [...bars].sort((a, b) => a.time - b.time);
  const closes = sorted.map((b) => b.close);
  const macdResults = ta.macd(closes, fastPeriod, slowPeriod, signalPeriod);
  const offset = slowPeriod - 1;

  const macd: LineData<Time>[] = [];
  const signal: LineData<Time>[] = [];
  const histogram: HistogramData<Time>[] = [];

  for (let i = 0; i < macdResults.length; i++) {
    const bar = sorted[i + offset];
    const item = macdResults[i];
    if (bar && item.macd !== undefined && item.signal !== undefined && item.histogram !== undefined) {
      const time = toUtcTimestamp(bar.time);
      macd.push({ time, value: item.macd });
      signal.push({ time, value: item.signal });
      histogram.push({
        time,
        value: item.histogram,
        color: item.histogram >= 0 ? "rgba(0, 192, 135, 0.65)" : "rgba(255, 59, 48, 0.65)",
      });
    }
  }

  return { macd, signal, histogram };
}

export interface StrategyEquitySeriesData {
  equityLine: LineData<Time>[];
  buyAndHoldLine: LineData<Time>[];
  underwaterDrawdownHistogram: HistogramData<Time>[];
  buyAndHoldReturnPercent: number;
  alphaPercent: number;
}

/**
 * Builds Strategy Equity Curve, Buy & Hold Benchmark, and Underwater Drawdown % Histogram
 * series aligned with Lightweight Charts timestamps (DEC-074).
 */
export function buildStrategyEquitySeriesData(
  equityCurve: EquityPoint[],
  bars: CandlestickBar[],
  initialCapital = 10000
): StrategyEquitySeriesData {
  if (!equityCurve || equityCurve.length === 0) {
    return {
      equityLine: [],
      buyAndHoldLine: [],
      underwaterDrawdownHistogram: [],
      buyAndHoldReturnPercent: 0,
      alphaPercent: 0,
    };
  }

  const sortedEquity = [...equityCurve].sort((a, b) => a.time - b.time);
  const sortedBars = [...bars].sort((a, b) => a.time - b.time);
  const barByUtcTime = new Map<number, CandlestickBar>();
  for (const bar of sortedBars) {
    barByUtcTime.set(Number(toUtcTimestamp(bar.time)), bar);
  }

  const firstBar = sortedBars[0];
  const basePrice = firstBar && firstBar.open > 0 ? firstBar.open : 1;

  const equityLine: LineData<Time>[] = [];
  const buyAndHoldLine: LineData<Time>[] = [];
  const underwaterDrawdownHistogram: HistogramData<Time>[] = [];
  const seenTimes = new Set<number>();

  for (const pt of sortedEquity) {
    const utcSec = Number(toUtcTimestamp(pt.time));
    if (seenTimes.has(utcSec)) continue;
    seenTimes.add(utcSec);

    const time = utcSec as UTCTimestamp;
    equityLine.push({
      time,
      value: pt.equity,
    });

    const ddVal = -Math.abs(pt.drawdownPercent || 0);
    underwaterDrawdownHistogram.push({
      time,
      value: ddVal,
      color:
        Math.abs(pt.drawdownPercent) > 5
          ? "rgba(255, 59, 48, 0.75)"
          : "rgba(255, 59, 48, 0.42)",
    });

    const matchingBar = barByUtcTime.get(utcSec);
    if (matchingBar && firstBar && firstBar.open > 0) {
      const bhEquity = parseFloat(
        (initialCapital * (matchingBar.close / basePrice)).toFixed(2)
      );
      buyAndHoldLine.push({
        time,
        value: bhEquity,
      });
    }
  }

  const lastEquity = sortedEquity[sortedEquity.length - 1]?.equity ?? initialCapital;
  const strategyReturnPct =
    initialCapital > 0 ? ((lastEquity - initialCapital) / initialCapital) * 100 : 0;

  const lastBar = sortedBars[sortedBars.length - 1];
  const buyAndHoldReturnPercent =
    firstBar && lastBar && firstBar.open > 0
      ? parseFloat((((lastBar.close - firstBar.open) / firstBar.open) * 100).toFixed(2))
      : 0;

  const alphaPercent = parseFloat((strategyReturnPct - buyAndHoldReturnPercent).toFixed(2));

  return {
    equityLine,
    buyAndHoldLine,
    underwaterDrawdownHistogram,
    buyAndHoldReturnPercent,
    alphaPercent,
  };
}


