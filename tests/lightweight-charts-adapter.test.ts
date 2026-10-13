import { describe, it, expect } from "vitest";
import {
  toUtcTimestamp,
  formatCandlestickData,
  formatVolumeData,
  buildEmaLineData,
  buildTradeMarkers,
  mergeAndDeduplicateBars,
  buildBollingerBandsData,
  buildRsiData,
  buildMacdData,
  buildStrategyEquitySeriesData,
} from "@/lib/chart/lightweight-adapter";
import { CandlestickBar } from "@/lib/mexc/types";
import { BacktestTrade, EquityPoint } from "@/lib/strategy/types";

describe("Lightweight Charts Adapter Utilities", () => {
  const sampleBars: CandlestickBar[] = [
    { time: 1672531200000, open: 100, high: 110, low: 95, close: 105, volume: 1500 },
    { time: 1672531260000, open: 105, high: 115, low: 102, close: 112, volume: 2100 },
    { time: 1672531320000, open: 112, high: 114, low: 104, close: 106, volume: 1800 },
    { time: 1672531380000, open: 106, high: 108, low: 98, close: 100, volume: 1200 },
    { time: 1672531440000, open: 100, high: 120, low: 99, close: 118, volume: 3000 },
  ];

  it("should convert ms timestamps to lightweight-charts UTCTimestamp in seconds", () => {
    expect(toUtcTimestamp(1672531200000)).toBe(1672531200);
    expect(toUtcTimestamp(1672531200)).toBe(1672531200);
  });

  it("should format CandlestickBar data into valid sorted CandlestickData", () => {
    // Pass reverse sorted bars
    const reversed = [...sampleBars].reverse();
    const formatted = formatCandlestickData(reversed);

    expect(formatted.length).toBe(5);
    expect(formatted[0].time).toBe(1672531200);
    expect(formatted[4].time).toBe(1672531440);
    expect(formatted[0].open).toBe(100);
    expect(formatted[0].close).toBe(105);
  });

  it("should format volume histogram with bullish and bearish opacity colors", () => {
    const volumeData = formatVolumeData(sampleBars);

    expect(volumeData.length).toBe(5);
    // Bar 0: open 100, close 105 (Bullish) -> secondary color
    expect(volumeData[0].color).toBe("rgba(0, 192, 135, 0.35)");
    // Bar 2: open 112, close 106 (Bearish) -> tertiary color
    expect(volumeData[2].color).toBe("rgba(255, 59, 48, 0.35)");
  });

  it("should align EMA series properly with price bar timestamps", () => {
    // Generate 25 synthetic bars
    const extendedBars: CandlestickBar[] = Array.from({ length: 25 }, (_, i) => ({
      time: 1672531200000 + i * 60000,
      open: 100 + i,
      high: 105 + i,
      low: 95 + i,
      close: 102 + i,
      volume: 1000,
    }));

    const period = 5;
    const emaData = buildEmaLineData(extendedBars, period);

    // EMA with period 5 on 25 bars should have 25 - 5 + 1 = 21 points
    expect(emaData.length).toBe(21);
    // First EMA point must align with the 5th bar (index 4)
    expect(emaData[0].time).toBe(toUtcTimestamp(extendedBars[4].time));
    expect(emaData[20].time).toBe(toUtcTimestamp(extendedBars[24].time));
  });

  it("should generate sorted series markers for backtest trades", () => {
    const trades: BacktestTrade[] = [
      {
        tradeId: "t1",
        orderId: "ord-1",
        direction: "long",
        entryBarIndex: 0,
        entryTime: sampleBars[0].time,
        entryPrice: 100,
        exitBarIndex: 1,
        exitTime: sampleBars[1].time,
        exitPrice: 112,
        exitReason: "TAKE_PROFIT",
        size: 1,
        grossPnL: 12,
        netPnL: 11.5,
        pnlPercent: 11.5,
        feePaid: 0.5,
        cumulativeEquity: 10011.5,
        barsHeld: 1,
      },
      {
        tradeId: "t2",
        orderId: "ord-2",
        direction: "short",
        entryBarIndex: 2,
        entryTime: sampleBars[2].time,
        entryPrice: 112,
        exitBarIndex: 3,
        exitTime: sampleBars[3].time,
        exitPrice: 115,
        exitReason: "STOP_LOSS",
        size: 1,
        grossPnL: -3,
        netPnL: -3.5,
        pnlPercent: -3.1,
        feePaid: 0.5,
        cumulativeEquity: 10008,
        barsHeld: 1,
      },
    ];

    const markers = buildTradeMarkers(trades, sampleBars);

    expect(markers.length).toBe(4); // 2 entries + 2 exits
    // Trade 1 entry (Long)
    expect(markers[0].time).toBe(toUtcTimestamp(sampleBars[0].time));
    expect(markers[0].shape).toBe("arrowUp");
    expect(markers[0].position).toBe("belowBar");
    expect(markers[0].text).toBe("BUY");

    // Trade 1 exit (Win)
    expect(markers[1].time).toBe(toUtcTimestamp(sampleBars[1].time));
    expect(markers[1].shape).toBe("circle");
    expect(markers[1].text).toBe("+11.5%");

    // Trade 2 entry (Short)
    expect(markers[2].time).toBe(toUtcTimestamp(sampleBars[2].time));
    expect(markers[2].shape).toBe("arrowDown");
    expect(markers[2].position).toBe("aboveBar");
    expect(markers[2].text).toBe("SELL");

    // Trade 2 exit (Loss)
    expect(markers[3].time).toBe(toUtcTimestamp(sampleBars[3].time));
    expect(markers[3].shape).toBe("circle");
    expect(markers[3].text).toBe("-3.1%");

    // Markers must be chronologically sorted
    for (let i = 1; i < markers.length; i++) {
      expect(Number(markers[i].time)).toBeGreaterThanOrEqual(Number(markers[i - 1].time));
    }
  });

  it("should merge and deduplicate older bars with current bars", () => {
    const older: CandlestickBar[] = [
      { time: 1000, open: 1, high: 2, low: 1, close: 2, volume: 10 },
      { time: 2000, open: 2, high: 3, low: 2, close: 3, volume: 20 },
      { time: 3000, open: 3, high: 4, low: 3, close: 4, volume: 30 },
    ];

    const current: CandlestickBar[] = [
      { time: 3000, open: 3, high: 4, low: 3, close: 4, volume: 30 }, // duplicate overlapping
      { time: 4000, open: 4, high: 5, low: 4, close: 5, volume: 40 },
    ];

    const merged = mergeAndDeduplicateBars(older, current);

    expect(merged.length).toBe(4);
    expect(merged.map((b) => b.time)).toEqual([1000, 2000, 3000, 4000]);
  });

  it("should calculate Bollinger Bands series with correct offset alignment", () => {
    const bars: CandlestickBar[] = Array.from({ length: 30 }, (_, i) => ({
      time: 1672531200000 + i * 60000,
      open: 100 + i,
      high: 105 + i,
      low: 95 + i,
      close: 102 + i,
      volume: 1000,
    }));

    const bb = buildBollingerBandsData(bars, 20, 2);
    // 30 bars with period 20 -> 30 - 20 + 1 = 11 data points
    expect(bb.upper.length).toBe(11);
    expect(bb.middle.length).toBe(11);
    expect(bb.lower.length).toBe(11);

    // First point aligns with bar index 19 (20th bar)
    expect(bb.upper[0].time).toBe(toUtcTimestamp(bars[19].time));
    expect(bb.upper[0].value).toBeGreaterThan(bb.middle[0].value);
    expect(bb.middle[0].value).toBeGreaterThan(bb.lower[0].value);
  });

  it("should calculate RSI series with correct offset alignment", () => {
    const bars: CandlestickBar[] = Array.from({ length: 30 }, (_, i) => ({
      time: 1672531200000 + i * 60000,
      open: 100 + i,
      high: 105 + i,
      low: 95 + i,
      close: 102 + i,
      volume: 1000,
    }));

    const rsi = buildRsiData(bars, 14);
    // 30 bars with period 14 -> 30 - 14 = 16 data points
    expect(rsi.length).toBe(16);
    expect(rsi[0].time).toBe(toUtcTimestamp(bars[14].time));
    expect(rsi[0].value).toBeGreaterThanOrEqual(0);
    expect(rsi[0].value).toBeLessThanOrEqual(100);
  });

  it("should calculate MACD line, signal line, and histogram series", () => {
    const bars: CandlestickBar[] = Array.from({ length: 40 }, (_, i) => ({
      time: 1672531200000 + i * 60000,
      open: 100 + i,
      high: 105 + i,
      low: 95 + i,
      close: 102 + i,
      volume: 1000,
    }));

    const macd = buildMacdData(bars, 12, 26, 9);
    // 40 bars with slow 26 and signal 9 -> 40 - (25 + 8) = 7 complete points
    expect(macd.macd.length).toBe(7);
    expect(macd.signal.length).toBe(7);
    expect(macd.histogram.length).toBe(7);
    expect(macd.macd[0].time).toBe(toUtcTimestamp(bars[33].time));
    expect(macd.histogram[0].color).toBeDefined();
  });

  it("should build Strategy Equity, Buy & Hold Benchmark, and Underwater Drawdown series (DEC-074)", () => {
    const equityCurve: EquityPoint[] = [
      { time: sampleBars[0].time, equity: 10000, drawdownPercent: 0 },
      { time: sampleBars[1].time, equity: 11000, drawdownPercent: 0 },
      { time: sampleBars[2].time, equity: 10670, drawdownPercent: 3.0 },
      { time: sampleBars[3].time, equity: 10120, drawdownPercent: 8.0 },
      { time: sampleBars[4].time, equity: 12500, drawdownPercent: 0 },
    ];

    const series = buildStrategyEquitySeriesData(equityCurve, sampleBars, 10000);

    expect(series.equityLine.length).toBe(5);
    expect(series.buyAndHoldLine.length).toBe(5);
    expect(series.underwaterDrawdownHistogram.length).toBe(5);

    // Underwater drawdown values are negative
    expect(series.underwaterDrawdownHistogram[2].value).toBe(-3.0);
    expect(series.underwaterDrawdownHistogram[2].color).toBe("rgba(255, 59, 48, 0.42)");
    expect(series.underwaterDrawdownHistogram[3].value).toBe(-8.0);
    expect(series.underwaterDrawdownHistogram[3].color).toBe("rgba(255, 59, 48, 0.75)");

    // Buy & Hold on sampleBars: open=100 at bar 0, close=118 at bar 4 -> +18% ($11,800)
    expect(series.buyAndHoldLine[4].value).toBe(11800);
    expect(series.buyAndHoldReturnPercent).toBe(18);
    // Strategy return is +25% ($12,500) -> Alpha is +7%
    expect(series.alphaPercent).toBe(7);
  });
});


