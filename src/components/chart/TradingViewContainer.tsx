"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { CandlestickBar } from "@/lib/mexc/types";
import { mexcClient } from "@/lib/mexc/client";
import { mexcWsManager } from "@/lib/mexc/websocket";
import { replayEngine } from "@/lib/replay/replay-engine";
import { Bar } from "@/types/tradingview";
import { ta } from "@/lib/indicators/ta-math";
import { Activity, ShieldCheck, Layers, Settings, X, Trash2, Lock, Unlock } from "lucide-react";
import { DrawingToolType } from "../terminal/DrawingRail";
import { BacktestTrade } from "@/lib/strategy/types";
import {
  ChartDrawing,
  calculateFibLevels,
  calculatePositionMetrics,
  calculateRulerMetrics,
  findNearestCandlePoint,
  isPointNearSegment,
} from "@/lib/chart/drawing-math";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Time,
  type BarData,
  type HistogramData,
  type LineData,
  type LogicalRange,
} from "lightweight-charts";
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
} from "@/lib/chart/lightweight-adapter";

interface TradingViewContainerProps {
  symbol: string;
  resolution: string;
  activeDrawingTool?: DrawingToolType;
  onSelectDrawingTool?: (tool: DrawingToolType) => void;
  isMagnetActive?: boolean;
  isDrawingsLocked?: boolean;
  isDrawingsHidden?: boolean;
  activeIndicators?: string[];
  onToggleIndicator?: (name: string) => void;
  trades?: BacktestTrade[];
  onBarsLoaded?: (bars: CandlestickBar[]) => void;
  onPriceUpdate?: (stats: {
    price: number;
    change: number;
    high: number;
    low: number;
    volume: number;
  }) => void;
}

declare global {
  interface Window {
    TradingView?: any;
  }
}

interface HoveredStats {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  ema20?: number;
  ema50?: number;
  bbUpper?: number;
  bbMiddle?: number;
  bbLower?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
}

export function TradingViewContainer({
  symbol,
  resolution,
  activeDrawingTool = "none",
  onSelectDrawingTool,
  isMagnetActive = true,
  isDrawingsLocked = false,
  isDrawingsHidden = false,
  activeIndicators = ["EMA Ribbon Momentum Multi-Timeframe"],
  onToggleIndicator,
  trades = [],
  onBarsLoaded,
  onPriceUpdate,
}: TradingViewContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartMountRef = useRef<HTMLDivElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);

  // Lightweight Charts engine refs
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbMiddleSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdLineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  // Sub-pane configurable parameters (DEC-037 & DEC-038)
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [rsiOverbought, setRsiOverbought] = useState(70);
  const [rsiOversold, setRsiOversold] = useState(30);

  const [macdFast, setMacdFast] = useState(12);
  const [macdSlow, setMacdSlow] = useState(26);
  const [macdSignal, setMacdSignal] = useState(9);

  // Quick settings tuning modal state
  const [activeSettingsModal, setActiveSettingsModal] = useState<"rsi" | "macd" | null>(null);

  // Synchronous state refs for callbacks
  const barsRef = useRef<CandlestickBar[]>([]);
  const isFetchingOlderBars = useRef(false);
  const hasMoreHistory = useRef(true);
  const isInitialLoadDone = useRef(false);
  const lastBackfillTime = useRef(0);

  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;

  const resolutionRef = useRef(resolution);
  resolutionRef.current = resolution;

  const onBarsLoadedRef = useRef(onBarsLoaded);
  onBarsLoadedRef.current = onBarsLoaded;

  const onPriceUpdateRef = useRef(onPriceUpdate);
  onPriceUpdateRef.current = onPriceUpdate;

  // Component React states
  const [hasLibrary, setHasLibrary] = useState(false);
  const [bars, setBars] = useState<CandlestickBar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [hoveredStats, setHoveredStats] = useState<HoveredStats | null>(null);

  // Geometric drawing tools state (DEC-040 to DEC-044)
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [inFlightDrawing, setInFlightDrawing] = useState<ChartDrawing | null>(null);
  const [drawingStep, setDrawingStep] = useState<0 | 1>(0);
  const [draggedHandle, setDraggedHandle] = useState<"start" | "end" | "body" | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{
    x: number;
    y: number;
    startTime: number;
    endTime: number;
    startPrice: number;
    endPrice: number;
  } | null>(null);
  const [snappedPoint, setSnappedPoint] = useState<{
    time: number;
    price: number;
    x: number;
    y: number;
  } | null>(null);
  const [isHoveringDrawing, setIsHoveringDrawing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  // 1. Check for proprietary TradingView library drop-in
  useEffect(() => {
    if (typeof window !== "undefined" && window.TradingView) {
      setHasLibrary(true);
    }
  }, []);

  // 2. Initialize Lightweight-Charts Instance on Mount
  useEffect(() => {
    if (hasLibrary || !chartMountRef.current) return;

    // Stitch Tactical Dark Palette Layout
    const chart = createChart(chartMountRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0a141f" },
        textColor: "#8d90a2",
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
        panes: {
          enableResize: true,
          separatorColor: "#17202b",
          separatorHoverColor: "#2962ff",
        },
      },
      grid: {
        vertLines: { color: "#131c27" },
        horzLines: { color: "#131c27" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(141, 144, 162, 0.4)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#2962ff",
        },
        horzLine: {
          color: "rgba(141, 144, 162, 0.4)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#2962ff",
        },
      },
      rightPriceScale: {
        borderColor: "#17202b",
        visible: true,
        scaleMargins: {
          top: 0.08,
          bottom: 0.18,
        },
      },
      timeScale: {
        borderColor: "#17202b",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 8,
        minBarSpacing: 2,
      },
      autoSize: true,
    });

    chartRef.current = chart;

    // 2.1 Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00c087",
      downColor: "#ff3b30",
      borderVisible: true,
      borderUpColor: "#00c087",
      borderDownColor: "#ff3b30",
      wickUpColor: "#00c087",
      wickDownColor: "#ff3b30",
    });
    candleSeriesRef.current = candleSeries;

    // 2.2 Volume Histogram Series (Independent Price Scale)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    volumeSeriesRef.current = volumeSeries;

    // Unified Series Topology: Volume Sub-Pane Scale Margins (margins 80% top / 0% bottom)
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // 2.3 Gold EMA 20 & Cyan EMA 50 Overlays
    const ema20Series = chart.addSeries(LineSeries, {
      color: "#f5ac37",
      lineWidth: 2,
      priceScaleId: "right",
      title: "EMA 20",
    });
    ema20SeriesRef.current = ema20Series;

    const ema50Series = chart.addSeries(LineSeries, {
      color: "#00d8ff",
      lineWidth: 2,
      priceScaleId: "right",
      title: "EMA 50",
    });
    ema50SeriesRef.current = ema50Series;

    // 2.3b Bollinger Bands Overlays
    const bbUpperSeries = chart.addSeries(LineSeries, {
      color: "rgba(41, 98, 255, 0.75)",
      lineWidth: 1,
      priceScaleId: "right",
      title: "BB Upper",
      visible: false,
    });
    bbUpperSeriesRef.current = bbUpperSeries;

    const bbMiddleSeries = chart.addSeries(LineSeries, {
      color: "rgba(245, 172, 55, 0.75)",
      lineWidth: 1,
      priceScaleId: "right",
      title: "BB Basis",
      visible: false,
    });
    bbMiddleSeriesRef.current = bbMiddleSeries;

    const bbLowerSeries = chart.addSeries(LineSeries, {
      color: "rgba(41, 98, 255, 0.75)",
      lineWidth: 1,
      priceScaleId: "right",
      title: "BB Lower",
      visible: false,
    });
    bbLowerSeriesRef.current = bbLowerSeries;

    // 2.4 Trade Markers Plugin (Native Lightweight-Charts Markers)
    const markersPlugin = createSeriesMarkers(candleSeries, []);
    markersPluginRef.current = markersPlugin;

    // 2.5 Crosshair Hover Telemetry Synchronization (DEC-034)
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        setHoveredStats(null);
        return;
      }

      const candleData = param.seriesData.get(candleSeries) as BarData<Time> | undefined;
      const volData = param.seriesData.get(volumeSeries) as HistogramData<Time> | undefined;
      const ema20Data = param.seriesData.get(ema20Series) as LineData<Time> | undefined;
      const ema50Data = param.seriesData.get(ema50Series) as LineData<Time> | undefined;
      const bbUpperData = param.seriesData.get(bbUpperSeries) as LineData<Time> | undefined;
      const bbMiddleData = param.seriesData.get(bbMiddleSeries) as LineData<Time> | undefined;
      const bbLowerData = param.seriesData.get(bbLowerSeries) as LineData<Time> | undefined;
      const rsiData = rsiSeriesRef.current
        ? (param.seriesData.get(rsiSeriesRef.current) as LineData<Time> | undefined)
        : undefined;
      const macdLineData = macdLineSeriesRef.current
        ? (param.seriesData.get(macdLineSeriesRef.current) as LineData<Time> | undefined)
        : undefined;
      const macdSigData = macdSignalSeriesRef.current
        ? (param.seriesData.get(macdSignalSeriesRef.current) as LineData<Time> | undefined)
        : undefined;
      const macdHistData = macdHistSeriesRef.current
        ? (param.seriesData.get(macdHistSeriesRef.current) as HistogramData<Time> | undefined)
        : undefined;

      if (candleData && "open" in candleData) {
        setHoveredStats({
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volData?.value,
          ema20: ema20Data?.value,
          ema50: ema50Data?.value,
          bbUpper: bbUpperData?.value,
          bbMiddle: bbMiddleData?.value,
          bbLower: bbLowerData?.value,
          rsi: rsiData?.value,
          macd: macdLineData?.value,
          macdSignal: macdSigData?.value,
          macdHist: macdHistData?.value,
        });
      } else {
        setHoveredStats(null);
      }
    });

    // 2.6 Infinite Scroll Pagination on Left Boundary Panning (DEC-033)
    const onLogicalRangeChange = async (newRange: LogicalRange | null) => {
      if (!newRange) return;
      const now = Date.now();
      // Only trigger when initial data load is complete and cooldown has passed
      if (!isInitialLoadDone.current) return;
      if (now - lastBackfillTime.current < 2000) return;

      if (newRange.from < 5 && !isFetchingOlderBars.current && hasMoreHistory.current) {
        const currentBars = barsRef.current;
        if (currentBars.length < 50) return;
        const oldestBar = currentBars[0];

        lastBackfillTime.current = now;
        isFetchingOlderBars.current = true;
        try {
          const olderBars = await mexcClient.getKlines({
            symbol: symbolRef.current,
            resolution: resolutionRef.current,
            limit: 300,
            endTime: oldestBar.time - 1,
          });

          if (!olderBars || olderBars.length < 2) {
            hasMoreHistory.current = false;
            return;
          }

          const merged = mergeAndDeduplicateBars(olderBars, currentBars);
          const addedCount = merged.length - currentBars.length;

          if (addedCount > 0) {
            barsRef.current = merged;
            setBars(merged);
            onBarsLoadedRef.current?.(merged);

            // Re-populate series with merged dataset
            candleSeries.setData(formatCandlestickData(merged));
            volumeSeries.setData(formatVolumeData(merged));
            ema20Series.setData(buildEmaLineData(merged, 20));
            ema50Series.setData(buildEmaLineData(merged, 50));
            const bbData = buildBollingerBandsData(merged, 20, 2);
            bbUpperSeries.setData(bbData.upper);
            bbMiddleSeries.setData(bbData.middle);
            bbLowerSeries.setData(bbData.lower);

            if (rsiSeriesRef.current) {
              rsiSeriesRef.current.setData(buildRsiData(merged, rsiPeriod));
            }
            if (macdLineSeriesRef.current && macdSignalSeriesRef.current && macdHistSeriesRef.current) {
              const macdData = buildMacdData(merged, macdFast, macdSlow, macdSignal);
              macdLineSeriesRef.current.setData(macdData.macd);
              macdSignalSeriesRef.current.setData(macdData.signal);
              macdHistSeriesRef.current.setData(macdData.histogram);
            }

            // Maintain viewport offset seamlessly without jump
            const curRange = chart.timeScale().getVisibleLogicalRange();
            if (curRange) {
              chart.timeScale().setVisibleLogicalRange({
                from: curRange.from + addedCount,
                to: curRange.to + addedCount,
              });
            }
          } else {
            hasMoreHistory.current = false;
          }
        } catch (err) {
          console.error("Failed to backfill historical bars:", err);
        } finally {
          isFetchingOlderBars.current = false;
        }
      }
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(onLogicalRangeChange);

    // 2.7 Responsive Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !chartRef.current) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        chartRef.current.resize(width, height);
      }
    });
    resizeObserver.observe(chartMountRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onLogicalRangeChange);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ema20SeriesRef.current = null;
      ema50SeriesRef.current = null;
      bbUpperSeriesRef.current = null;
      bbMiddleSeriesRef.current = null;
      bbLowerSeriesRef.current = null;
      rsiSeriesRef.current = null;
      macdLineSeriesRef.current = null;
      macdSignalSeriesRef.current = null;
      macdHistSeriesRef.current = null;
      markersPluginRef.current = null;
    };
  }, [hasLibrary]);

  // 3. Load historical klines and attach real-time MEXC feed
  useEffect(() => {
    let isCancelled = false;
    hasMoreHistory.current = true;
    isInitialLoadDone.current = false;
    setIsLoading(true);

    const loadData = async () => {
      try {
        const fetchedBars = await mexcClient.getKlines({
          symbol,
          resolution,
          limit: 300,
        });

        if (!isCancelled) {
          const sorted = [...fetchedBars].sort((a, b) => a.time - b.time);
          barsRef.current = sorted;
          setBars(sorted);
          replayEngine.loadHistory(sorted as Bar[]);
          onBarsLoadedRef.current?.(sorted);

          // Populate Lightweight Charts series
          if (
            candleSeriesRef.current &&
            volumeSeriesRef.current &&
            ema20SeriesRef.current &&
            ema50SeriesRef.current
          ) {
            candleSeriesRef.current.setData(formatCandlestickData(sorted));
            volumeSeriesRef.current.setData(formatVolumeData(sorted));
            ema20SeriesRef.current.setData(buildEmaLineData(sorted, 20));
            ema50SeriesRef.current.setData(buildEmaLineData(sorted, 50));
            const bbData = buildBollingerBandsData(sorted, 20, 2);
            bbUpperSeriesRef.current?.setData(bbData.upper);
            bbMiddleSeriesRef.current?.setData(bbData.middle);
            bbLowerSeriesRef.current?.setData(bbData.lower);

            if (rsiSeriesRef.current) {
              rsiSeriesRef.current.setData(buildRsiData(sorted, rsiPeriod));
            }
            if (macdLineSeriesRef.current && macdSignalSeriesRef.current && macdHistSeriesRef.current) {
              const macdData = buildMacdData(sorted, macdFast, macdSlow, macdSignal);
              macdLineSeriesRef.current.setData(macdData.macd);
              macdSignalSeriesRef.current.setData(macdData.signal);
              macdHistSeriesRef.current.setData(macdData.histogram);
            }
            chartRef.current?.timeScale().scrollToRealTime();
            setTimeout(() => {
              isInitialLoadDone.current = true;
            }, 1000);
          }

          if (sorted.length > 0) {
            const lastBar = sorted[sorted.length - 1];
            const firstBar = sorted[0];
            const change =
              firstBar.open > 0
                ? ((lastBar.close - firstBar.open) / firstBar.open) * 100
                : 0;
            const high = Math.max(...sorted.map((b) => b.high));
            const low = Math.min(...sorted.map((b) => b.low));
            const volume = sorted.reduce((acc, b) => acc + b.volume, 0);

            setCurrentPrice(lastBar.close);
            onPriceUpdateRef.current?.({
              price: lastBar.close,
              change,
              high,
              low,
              volume,
            });
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to load bars:", err);
        if (!isCancelled) setIsLoading(false);
      }
    };

    loadData();

    // Subscribe to live WebSocket updates
    mexcWsManager.connect();
    const intervalStr = mexcClient.toMexcInterval(resolution);
    const channel = mexcWsManager.subscribeKline(symbol, intervalStr, (newBar) => {
      if (replayEngine.getState() !== "IDLE") return; // Replay overrides live feed

      setCurrentPrice(newBar.close);

      // Fast-path GPU series update (60 FPS without React re-render bottleneck)
      const barTime = toUtcTimestamp(newBar.time);
      candleSeriesRef.current?.update({
        time: barTime,
        open: newBar.open,
        high: newBar.high,
        low: newBar.low,
        close: newBar.close,
      });

      volumeSeriesRef.current?.update({
        time: barTime,
        value: newBar.volume,
        color:
          newBar.close >= newBar.open
            ? "rgba(0, 192, 135, 0.35)"
            : "rgba(255, 59, 48, 0.35)",
      });

      // Update state & calculate dynamic EMA tick
      const current = barsRef.current;
      if (current.length === 0) {
        barsRef.current = [newBar];
        setBars([newBar]);
      } else {
        const last = current[current.length - 1];
        let updated: CandlestickBar[];
        if (last.time === newBar.time) {
          updated = [...current];
          updated[updated.length - 1] = newBar;
        } else {
          updated = [...current, newBar];
        }
        barsRef.current = updated;
        setBars(updated);

        // Update latest EMA & Bollinger point
        const closes = updated.map((b) => b.close);
        if (closes.length >= 20) {
          const ema20Vals = ta.ema(closes, 20);
          const latestEma20 = ema20Vals[ema20Vals.length - 1];
          if (!isNaN(latestEma20)) {
            ema20SeriesRef.current?.update({ time: barTime, value: latestEma20 });
          }
          const bbVals = ta.bollingerbands(closes, 20, 2);
          const latestBb = bbVals[bbVals.length - 1];
          if (latestBb) {
            if (latestBb.upper !== undefined) {
              bbUpperSeriesRef.current?.update({ time: barTime, value: latestBb.upper });
            }
            if (latestBb.middle !== undefined) {
              bbMiddleSeriesRef.current?.update({ time: barTime, value: latestBb.middle });
            }
            if (latestBb.lower !== undefined) {
              bbLowerSeriesRef.current?.update({ time: barTime, value: latestBb.lower });
            }
          }
        }
        if (closes.length >= 50) {
          const ema50Vals = ta.ema(closes, 50);
          const latestEma50 = ema50Vals[ema50Vals.length - 1];
          if (!isNaN(latestEma50)) {
            ema50SeriesRef.current?.update({ time: barTime, value: latestEma50 });
          }
        }

        // Update latest RSI point
        if (closes.length >= rsiPeriod + 1 && rsiSeriesRef.current) {
          const rsiList = ta.rsi(closes, rsiPeriod);
          const lastRsi = rsiList[rsiList.length - 1];
          if (!isNaN(lastRsi)) {
            rsiSeriesRef.current.update({ time: barTime, value: lastRsi });
          }
        }

        // Update latest MACD point
        if (
          closes.length >= macdSlow + macdSignal &&
          macdLineSeriesRef.current &&
          macdSignalSeriesRef.current &&
          macdHistSeriesRef.current
        ) {
          const macdList = ta.macd(closes, macdFast, macdSlow, macdSignal);
          const lastMacd = macdList[macdList.length - 1];
          if (
            lastMacd &&
            lastMacd.macd !== undefined &&
            lastMacd.signal !== undefined &&
            lastMacd.histogram !== undefined
          ) {
            macdLineSeriesRef.current.update({ time: barTime, value: lastMacd.macd });
            macdSignalSeriesRef.current.update({ time: barTime, value: lastMacd.signal });
            macdHistSeriesRef.current.update({
              time: barTime,
              value: lastMacd.histogram,
              color:
                lastMacd.histogram >= 0
                  ? "rgba(0, 192, 135, 0.65)"
                  : "rgba(255, 59, 48, 0.65)",
            });
          }
        }
      }
    });

    // Replay Engine Listener
    const unsubscribeReplay = replayEngine.subscribe({
      onTick: (replayBar) => {
        setCurrentPrice(replayBar.close);
        const visibleBars = replayEngine.getVisibleBars() as CandlestickBar[];
        barsRef.current = visibleBars;
        setBars(visibleBars);
        if (
          candleSeriesRef.current &&
          volumeSeriesRef.current &&
          ema20SeriesRef.current &&
          ema50SeriesRef.current
        ) {
          candleSeriesRef.current.setData(formatCandlestickData(visibleBars));
          volumeSeriesRef.current.setData(formatVolumeData(visibleBars));
          ema20SeriesRef.current.setData(buildEmaLineData(visibleBars, 20));
          ema50SeriesRef.current.setData(buildEmaLineData(visibleBars, 50));
          const bbData = buildBollingerBandsData(visibleBars, 20, 2);
          bbUpperSeriesRef.current?.setData(bbData.upper);
          bbMiddleSeriesRef.current?.setData(bbData.middle);
          bbLowerSeriesRef.current?.setData(bbData.lower);

          if (rsiSeriesRef.current) {
            rsiSeriesRef.current.setData(buildRsiData(visibleBars, rsiPeriod));
          }
          if (macdLineSeriesRef.current && macdSignalSeriesRef.current && macdHistSeriesRef.current) {
            const macdData = buildMacdData(visibleBars, macdFast, macdSlow, macdSignal);
            macdLineSeriesRef.current.setData(macdData.macd);
            macdSignalSeriesRef.current.setData(macdData.signal);
            macdHistSeriesRef.current.setData(macdData.histogram);
          }
        }
      },
    });

    return () => {
      isCancelled = true;
      mexcWsManager.unsubscribeKline(channel);
      unsubscribeReplay();
    };
  }, [symbol, resolution]);

  // 4. Trade Markers Synchronization (DEC-032)
  useEffect(() => {
    if (!markersPluginRef.current) return;
    const markers = buildTradeMarkers(trades, barsRef.current);
    markersPluginRef.current.setMarkers(markers);
  }, [trades, bars]);

  // 5. Indicator & Sub-Pane Lifecycle Management (DEC-035 to DEC-039)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // 5.1 Main Pane 0 Overlays (EMA & Bollinger)
    const hasRibbonOrEma =
      activeIndicators.includes("EMA Ribbon Momentum Multi-Timeframe") ||
      activeIndicators.some((ind) => ind.toLowerCase().includes("ema"));

    const hasBollinger =
      activeIndicators.includes("Bollinger Bands Squeeze Breakout") ||
      activeIndicators.some((ind) => ind.toLowerCase().includes("bollinger"));

    ema20SeriesRef.current?.applyOptions({ visible: hasRibbonOrEma });
    ema50SeriesRef.current?.applyOptions({ visible: hasRibbonOrEma });
    bbUpperSeriesRef.current?.applyOptions({ visible: hasBollinger });
    bbMiddleSeriesRef.current?.applyOptions({ visible: hasBollinger });
    bbLowerSeriesRef.current?.applyOptions({ visible: hasBollinger });

    // 5.2 Dynamic Sub-Pane Allocations
    const hasRsi =
      activeIndicators.includes("RSI Divergence Engine Pro") ||
      activeIndicators.some((ind) => ind.toLowerCase().includes("rsi"));

    const hasMacd =
      activeIndicators.includes("Zero-Lag MACD Histogram") ||
      activeIndicators.some((ind) => ind.toLowerCase().includes("macd"));

    // Tear down any existing sub-pane series to ensure deterministic pane order & clean disposal
    if (rsiSeriesRef.current) {
      try {
        chart.removeSeries(rsiSeriesRef.current);
      } catch {}
      rsiSeriesRef.current = null;
    }
    if (macdLineSeriesRef.current) {
      try {
        chart.removeSeries(macdLineSeriesRef.current);
      } catch {}
      macdLineSeriesRef.current = null;
    }
    if (macdSignalSeriesRef.current) {
      try {
        chart.removeSeries(macdSignalSeriesRef.current);
      } catch {}
      macdSignalSeriesRef.current = null;
    }
    if (macdHistSeriesRef.current) {
      try {
        chart.removeSeries(macdHistSeriesRef.current);
      } catch {}
      macdHistSeriesRef.current = null;
    }

    let nextPaneIndex = 1;

    // Allocate RSI Sub-Pane
    if (hasRsi) {
      const rsiPaneIndex = nextPaneIndex++;
      const rsiSeries = chart.addSeries(
        LineSeries,
        {
          color: "#9353d3",
          lineWidth: 2,
          priceScaleId: "right",
          title: `RSI ${rsiPeriod}`,
          autoscaleInfoProvider: () => ({
            priceRange: {
              minValue: 0,
              maxValue: 100,
            },
          }),
        },
        rsiPaneIndex
      );

      rsiSeries.createPriceLine({
        price: rsiOverbought,
        color: "rgba(255, 59, 48, 0.45)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${rsiOverbought}`,
      });
      rsiSeries.createPriceLine({
        price: 50,
        color: "rgba(67, 70, 86, 0.6)",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: false,
      });
      rsiSeries.createPriceLine({
        price: rsiOversold,
        color: "rgba(0, 192, 135, 0.45)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${rsiOversold}`,
      });

      rsiSeriesRef.current = rsiSeries;

      // Populate current data
      if (barsRef.current.length > 0) {
        rsiSeries.setData(buildRsiData(barsRef.current, rsiPeriod));
      }

      // Configure fixed 130px height
      const panes = chart.panes();
      if (panes[rsiPaneIndex]) {
        panes[rsiPaneIndex].setHeight(130);
      }
    }

    // Allocate MACD Sub-Pane
    if (hasMacd) {
      const macdPaneIndex = nextPaneIndex++;

      const macdHistSeries = chart.addSeries(
        HistogramSeries,
        {
          priceScaleId: "right",
          title: "Histogram",
        },
        macdPaneIndex
      );

      const macdLineSeries = chart.addSeries(
        LineSeries,
        {
          color: "#2962ff",
          lineWidth: 2,
          priceScaleId: "right",
          title: "MACD",
        },
        macdPaneIndex
      );

      const macdSignalSeries = chart.addSeries(
        LineSeries,
        {
          color: "#f5ac37",
          lineWidth: 1,
          priceScaleId: "right",
          title: "Signal",
        },
        macdPaneIndex
      );

      macdLineSeries.createPriceLine({
        price: 0,
        color: "rgba(67, 70, 86, 0.6)",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: "0",
      });

      macdHistSeriesRef.current = macdHistSeries;
      macdLineSeriesRef.current = macdLineSeries;
      macdSignalSeriesRef.current = macdSignalSeries;

      // Populate current data
      if (barsRef.current.length > 0) {
        const macdData = buildMacdData(barsRef.current, macdFast, macdSlow, macdSignal);
        macdHistSeries.setData(macdData.histogram);
        macdLineSeries.setData(macdData.macd);
        macdSignalSeries.setData(macdData.signal);
      }

      // Configure fixed 130px height
      const panes = chart.panes();
      if (panes[macdPaneIndex]) {
        panes[macdPaneIndex].setHeight(130);
      }
    }
  }, [
    activeIndicators,
    rsiPeriod,
    rsiOverbought,
    rsiOversold,
    macdFast,
    macdSlow,
    macdSignal,
  ]);

  // 6. Geometric Drawing Engine (DEC-040 to DEC-044)
  const DRAWING_COLORS = [
    "#2962ff",
    "#00c087",
    "#ff3b30",
    "#f5ac37",
    "#9353d3",
    "#00d8ff",
    "#ffffff",
  ];

  // Coordinate Projection Helpers (DEC-040)
  const timeToCoordinate = useCallback((timeMs: number): number | null => {
    if (!chartRef.current) return null;
    const utcSec = toUtcTimestamp(timeMs);
    const coord = chartRef.current.timeScale().timeToCoordinate(utcSec);
    return coord !== null ? Number(coord) : null;
  }, []);

  const coordinateToTime = useCallback((x: number): number | null => {
    if (!chartRef.current) return null;
    const t = chartRef.current.timeScale().coordinateToTime(x);
    if (t !== null && typeof t === "number") {
      return t * 1000;
    }
    if (barsRef.current.length > 0) {
      if (x <= 0) return barsRef.current[0].time;
      return barsRef.current[barsRef.current.length - 1].time;
    }
    return null;
  }, []);

  const priceToCoordinate = useCallback((price: number): number | null => {
    if (!candleSeriesRef.current) return null;
    const coord = candleSeriesRef.current.priceToCoordinate(price);
    return coord !== null ? Number(coord) : null;
  }, []);

  const coordinateToPrice = useCallback((y: number): number | null => {
    if (!candleSeriesRef.current) return null;
    const p = candleSeriesRef.current.coordinateToPrice(y);
    return p !== null ? Number(p) : null;
  }, []);

  const getSafeScreenX = useCallback(
    (timeMs: number): number | null => {
      const coord = timeToCoordinate(timeMs);
      if (coord !== null) return coord;
      if (barsRef.current.length > 1) {
        const firstBar = barsRef.current[0];
        const lastBar = barsRef.current[barsRef.current.length - 1];
        const firstX = timeToCoordinate(firstBar.time);
        const lastX = timeToCoordinate(lastBar.time);
        if (firstX !== null && lastX !== null && lastBar.time > firstBar.time) {
          const pxPerMs = (lastX - firstX) / (lastBar.time - firstBar.time);
          if (timeMs < firstBar.time) return firstX + (timeMs - firstBar.time) * pxPerMs;
          if (timeMs > lastBar.time) return lastX + (timeMs - lastBar.time) * pxPerMs;
        }
      }
      return null;
    },
    [timeToCoordinate]
  );

  const getSafeScreenY = useCallback(
    (price: number): number | null => {
      const coord = priceToCoordinate(price);
      return coord !== null ? coord : null;
    },
    [priceToCoordinate]
  );

  // Symbol-Scoped Persistence (DEC-044)
  useEffect(() => {
    if (!symbol) return;
    const storageKey = `mochex:drawings:${symbol}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setDrawings(parsed);
        } else {
          setDrawings([]);
        }
      } else {
        setDrawings([]);
      }
    } catch {
      setDrawings([]);
    }
    setSelectedDrawingId(null);
    setInFlightDrawing(null);
    setDrawingStep(0);
  }, [symbol]);

  const saveDrawings = useCallback((newDrawings: ChartDrawing[]) => {
    setDrawings(newDrawings);
    if (!symbolRef.current) return;
    try {
      localStorage.setItem(`mochex:drawings:${symbolRef.current}`, JSON.stringify(newDrawings));
    } catch {}
  }, []);

  useEffect(() => {
    const handleClearDrawings = () => {
      saveDrawings([]);
      setSelectedDrawingId(null);
      setInFlightDrawing(null);
      setDrawingStep(0);
    };
    window.addEventListener("mochex:clear-drawings", handleClearDrawings);
    return () => window.removeEventListener("mochex:clear-drawings", handleClearDrawings);
  }, [saveDrawings]);

  // Specialized Geometric Renderers (DEC-041)
  const renderTrendline = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      color: string,
      startPrice: number,
      endPrice: number,
      startTime: number,
      endTime: number
    ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      const deltaPrice = endPrice - startPrice;
      const deltaPercent = startPrice > 0 ? ((deltaPrice / startPrice) * 100).toFixed(2) : "0.00";
      const minTime = Math.min(startTime, endTime);
      const maxTime = Math.max(startTime, endTime);
      const barCount = Math.max(
        1,
        barsRef.current.filter((b) => b.time >= minTime && b.time <= maxTime).length
      );
      const badgeText = `${deltaPrice >= 0 ? "+" : ""}${deltaPrice.toFixed(2)} (${deltaPrice >= 0 ? "+" : ""}${deltaPercent}%) · ${barCount}b`;

      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      ctx.font = "10px monospace";
      const textWidth = ctx.measureText(badgeText).width;
      const padX = 6;
      const padY = 3;

      ctx.fillStyle = "rgba(10, 20, 31, 0.85)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(midX - textWidth / 2 - padX, midY - 9 - padY, textWidth + padX * 2, 16 + padY * 2, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = deltaPrice >= 0 ? "#00c087" : "#ff3b30";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(badgeText, midX, midY);
    },
    []
  );

  const renderFibonacci = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      startPrice: number,
      endPrice: number
    ) => {
      const levels = calculateFibLevels(startPrice, endPrice);
      const leftX = Math.min(x1, x2);
      const rightX = Math.max(x1, x2) + 60;

      for (let i = 0; i < levels.length - 1; i++) {
        const lvlA = levels[i];
        const lvlB = levels[i + 1];
        const yA = getSafeScreenY(lvlA.price);
        const yB = getSafeScreenY(lvlB.price);
        if (yA !== null && yB !== null) {
          ctx.fillStyle = lvlB.bg;
          ctx.fillRect(leftX, Math.min(yA, yB), rightX - leftX, Math.abs(yB - yA));
        }
      }

      levels.forEach((lvl) => {
        const y = getSafeScreenY(lvl.price);
        if (y === null) return;

        ctx.strokeStyle = lvl.color;
        ctx.lineWidth = lvl.ratio === 0 || lvl.ratio === 1 || lvl.ratio === 0.618 ? 1.5 : 1;
        if (lvl.ratio !== 0 && lvl.ratio !== 1 && lvl.ratio !== 0.618) {
          ctx.setLineDash([4, 4]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.moveTo(leftX, y);
        ctx.lineTo(rightX, y);
        ctx.stroke();
        ctx.setLineDash([]);

        const label = `${lvl.ratio} ($${lvl.price.toFixed(2)})`;
        ctx.font = "10px monospace";
        ctx.fillStyle = lvl.color;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(label, leftX + 4, y - 2);
      });
    },
    [getSafeScreenY]
  );

  const renderPosition = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      startPrice: number,
      endPrice: number
    ) => {
      const metrics = calculatePositionMetrics(startPrice, endPrice);
      const yEntry = getSafeScreenY(metrics.entryPrice);
      const yTarget = getSafeScreenY(metrics.targetPrice);
      const yStop = getSafeScreenY(metrics.stopPrice);

      if (yEntry === null || yTarget === null || yStop === null) return;

      const leftX = Math.min(x1, x2);
      const boxWidth = Math.max(80, Math.abs(x2 - x1));
      const rightX = leftX + boxWidth;

      // Profit Zone
      const profitTop = Math.min(yEntry, yTarget);
      const profitHeight = Math.abs(yTarget - yEntry);
      ctx.fillStyle = "rgba(0, 192, 135, 0.15)";
      ctx.fillRect(leftX, profitTop, boxWidth, profitHeight);
      ctx.strokeStyle = "rgba(0, 192, 135, 0.85)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(leftX, profitTop, boxWidth, profitHeight);

      ctx.font = "10px monospace";
      ctx.fillStyle = "#00c087";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(
        `Target: +${Math.abs(metrics.targetPercent).toFixed(2)}% ($${metrics.targetPrice.toFixed(2)})`,
        leftX + 6,
        profitTop + 4
      );

      // Stop Zone
      const stopTop = Math.min(yEntry, yStop);
      const stopHeight = Math.abs(yStop - yEntry);
      ctx.fillStyle = "rgba(255, 59, 48, 0.15)";
      ctx.fillRect(leftX, stopTop, boxWidth, stopHeight);
      ctx.strokeStyle = "rgba(255, 59, 48, 0.85)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(leftX, stopTop, boxWidth, stopHeight);

      ctx.fillStyle = "#ff3b30";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(
        `Stop: -${Math.abs(metrics.stopPercent).toFixed(2)}% ($${metrics.stopPrice.toFixed(2)})`,
        leftX + 6,
        stopTop + stopHeight - 4
      );

      // Entry line & R:R badge
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(leftX, yEntry);
      ctx.lineTo(rightX, yEntry);
      ctx.stroke();

      const rrText = `R:R ${metrics.riskRewardRatio.toFixed(2)}`;
      ctx.font = "10px monospace";
      const badgeW = ctx.measureText(rrText).width + 12;
      ctx.fillStyle = "#0a141f";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(leftX + (boxWidth - badgeW) / 2, yEntry - 9, badgeW, 18, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(rrText, leftX + boxWidth / 2, yEntry);
    },
    [getSafeScreenY]
  );

  const renderRuler = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      startPrice: number,
      endPrice: number,
      startTime: number,
      endTime: number
    ) => {
      const metrics = calculateRulerMetrics(
        startPrice,
        endPrice,
        startTime,
        endTime,
        barsRef.current
      );
      const rx = Math.min(x1, x2);
      const ry = Math.min(y1, y2);
      const rw = Math.abs(x2 - x1);
      const rh = Math.abs(y2 - y1);

      ctx.fillStyle = "rgba(41, 98, 255, 0.08)";
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = "rgba(41, 98, 255, 0.75)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);

      ctx.strokeStyle = "#2962ff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      const mins = Math.round(metrics.durationMs / 60000);
      const durStr = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
      const badgeText = `${metrics.deltaPrice >= 0 ? "+" : ""}${metrics.deltaPrice.toFixed(2)} (${metrics.deltaPercent >= 0 ? "+" : ""}${metrics.deltaPercent.toFixed(2)}%) · ${metrics.barCount} bars · ${durStr}`;

      ctx.font = "10px monospace";
      const textW = ctx.measureText(badgeText).width;
      const midX = rx + rw / 2;
      const midY = ry + rh / 2;

      ctx.fillStyle = "rgba(10, 20, 31, 0.88)";
      ctx.strokeStyle = "rgba(41, 98, 255, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(midX - textW / 2 - 8, midY - 10, textW + 16, 20, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = metrics.deltaPrice >= 0 ? "#00c087" : "#ff3b30";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(badgeText, midX, midY);
    },
    []
  );

  const renderBrush = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      color: string
    ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    },
    []
  );

  const renderText = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x1: number,
      y1: number,
      text: string,
      color: string
    ) => {
      ctx.font = "12px monospace";
      const textW = ctx.measureText(text).width;
      ctx.fillStyle = "rgba(10, 20, 31, 0.85)";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x1 - 4, y1 - 16, textW + 8, 22, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x1, y1 - 5);
    },
    []
  );

  const renderHandles = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x1: number,
      y1: number,
      x2: number,
      y2: number
    ) => {
      const handles = [
        { x: x1, y: y1, r: 4.5, fill: "#ffffff", stroke: "#2962ff" },
        { x: x2, y: y2, r: 4.5, fill: "#ffffff", stroke: "#2962ff" },
        { x: (x1 + x2) / 2, y: (y1 + y2) / 2, r: 3.5, fill: "#2962ff", stroke: "#ffffff" },
      ];

      handles.forEach((h) => {
        ctx.fillStyle = h.fill;
        ctx.strokeStyle = h.stroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    },
    []
  );

  // Hit-Testing for Selection & Handle Dragging (DEC-043)
  const getHitTestResult = useCallback(
    (x: number, y: number) => {
      if (isDrawingsHidden || drawings.length === 0) return null;

      for (let i = drawings.length - 1; i >= 0; i--) {
        const d = drawings[i];
        const x1 = getSafeScreenX(d.startTime);
        const y1 = getSafeScreenY(d.startPrice);
        const x2 = getSafeScreenX(d.endTime);
        const y2 = getSafeScreenY(d.endPrice);
        if (x1 === null || y1 === null || x2 === null || y2 === null) continue;

        if (Math.hypot(x - x1, y - y1) <= 9) {
          return { drawing: d, handle: "start" as const };
        }
        if (Math.hypot(x - x2, y - y2) <= 9) {
          return { drawing: d, handle: "end" as const };
        }
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        if (Math.hypot(x - midX, y - midY) <= 8) {
          return { drawing: d, handle: "body" as const };
        }

        if (d.type === "position") {
          const metrics = calculatePositionMetrics(d.startPrice, d.endPrice);
          const yTarget = getSafeScreenY(metrics.targetPrice);
          const yStop = getSafeScreenY(metrics.stopPrice);
          if (yTarget !== null && yStop !== null) {
            const minY = Math.min(y1, yTarget, yStop);
            const maxY = Math.max(y1, yTarget, yStop);
            const minX = Math.min(x1, x2);
            const maxX = minX + Math.max(80, Math.abs(x2 - x1));
            if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
              return { drawing: d, handle: "body" as const };
            }
          }
        } else if (d.type === "ruler") {
          const minX = Math.min(x1, x2);
          const maxX = Math.max(x1, x2);
          const minY = Math.min(y1, y2);
          const maxY = Math.max(y1, y2);
          if (x >= minX - 4 && x <= maxX + 4 && y >= minY - 4 && y <= maxY + 4) {
            return { drawing: d, handle: "body" as const };
          }
        } else if (d.type === "fibonacci") {
          const levels = calculateFibLevels(d.startPrice, d.endPrice);
          const minX = Math.min(x1, x2);
          const maxX = Math.max(x1, x2) + 60;
          if (x >= minX - 4 && x <= maxX + 4) {
            for (const lvl of levels) {
              const ly = getSafeScreenY(lvl.price);
              if (ly !== null && Math.abs(y - ly) <= 6) {
                return { drawing: d, handle: "body" as const };
              }
            }
          }
        } else {
          if (isPointNearSegment(x, y, x1, y1, x2, y2, 8)) {
            return { drawing: d, handle: "body" as const };
          }
        }
      }

      return null;
    },
    [isDrawingsHidden, drawings, getSafeScreenX, getSafeScreenY]
  );

  const renderDrawingCanvas = useCallback(() => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.floor(rect.width * dpr);
    const targetH = Math.floor(rect.height * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // 1. Render all persistent drawings if not hidden (DEC-040 & DEC-044)
    if (!isDrawingsHidden) {
      drawings.forEach((d) => {
        const x1 = getSafeScreenX(d.startTime);
        const y1 = getSafeScreenY(d.startPrice);
        const x2 = getSafeScreenX(d.endTime);
        const y2 = getSafeScreenY(d.endPrice);
        if (x1 === null || y1 === null || x2 === null || y2 === null) return;

        const color = d.color || "#2962ff";
        if (d.type === "trendline") {
          renderTrendline(ctx, x1, y1, x2, y2, color, d.startPrice, d.endPrice, d.startTime, d.endTime);
        } else if (d.type === "fibonacci") {
          renderFibonacci(ctx, x1, y1, x2, y2, d.startPrice, d.endPrice);
        } else if (d.type === "position") {
          renderPosition(ctx, x1, y1, x2, y2, d.startPrice, d.endPrice);
        } else if (d.type === "ruler") {
          renderRuler(ctx, x1, y1, x2, y2, d.startPrice, d.endPrice, d.startTime, d.endTime);
        } else if (d.type === "brush") {
          renderBrush(ctx, x1, y1, x2, y2, color);
        } else if (d.type === "text") {
          renderText(ctx, x1, y1, d.text || "Note", color);
        }

        if (d.id === selectedDrawingId) {
          renderHandles(ctx, x1, y1, x2, y2);
        }
      });
    }

    // 2. Render in-flight active drawing tool preview
    if (inFlightDrawing && !isDrawingsHidden) {
      const x1 = getSafeScreenX(inFlightDrawing.startTime);
      const y1 = getSafeScreenY(inFlightDrawing.startPrice);
      const x2 = getSafeScreenX(inFlightDrawing.endTime);
      const y2 = getSafeScreenY(inFlightDrawing.endPrice);

      if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
        const color = inFlightDrawing.color || "#b6c4ff";
        ctx.save();
        ctx.globalAlpha = 0.85;

        if (inFlightDrawing.type === "trendline") {
          ctx.setLineDash([4, 4]);
          renderTrendline(ctx, x1, y1, x2, y2, color, inFlightDrawing.startPrice, inFlightDrawing.endPrice, inFlightDrawing.startTime, inFlightDrawing.endTime);
        } else if (inFlightDrawing.type === "fibonacci") {
          renderFibonacci(ctx, x1, y1, x2, y2, inFlightDrawing.startPrice, inFlightDrawing.endPrice);
        } else if (inFlightDrawing.type === "position") {
          renderPosition(ctx, x1, y1, x2, y2, inFlightDrawing.startPrice, inFlightDrawing.endPrice);
        } else if (inFlightDrawing.type === "ruler") {
          renderRuler(ctx, x1, y1, x2, y2, inFlightDrawing.startPrice, inFlightDrawing.endPrice, inFlightDrawing.startTime, inFlightDrawing.endTime);
        } else if (inFlightDrawing.type === "brush") {
          renderBrush(ctx, x1, y1, x2, y2, color);
        } else if (inFlightDrawing.type === "text") {
          renderText(ctx, x1, y1, "Note", color);
        }
        ctx.restore();
      }
    }

    // 3. Smart Magnet Snapping Indicator (DEC-042)
    if (snappedPoint && isMagnetActive && (isDrawing || drawingStep === 1 || activeDrawingTool !== "none")) {
      ctx.save();
      ctx.strokeStyle = "#00d8ff";
      ctx.fillStyle = "rgba(0, 216, 255, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(snappedPoint.x, snappedPoint.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(snappedPoint.x - 9, snappedPoint.y);
      ctx.lineTo(snappedPoint.x + 9, snappedPoint.y);
      ctx.moveTo(snappedPoint.x, snappedPoint.y - 9);
      ctx.lineTo(snappedPoint.x, snappedPoint.y + 9);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }, [
    drawings,
    selectedDrawingId,
    inFlightDrawing,
    isDrawingsHidden,
    snappedPoint,
    isMagnetActive,
    isDrawing,
    drawingStep,
    activeDrawingTool,
    getSafeScreenX,
    getSafeScreenY,
    renderTrendline,
    renderFibonacci,
    renderPosition,
    renderRuler,
    renderBrush,
    renderText,
    renderHandles,
  ]);

  // Subscribe to Pan & Zoom events to re-project drawings seamlessly
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const handleRangeChange = () => {
      renderDrawingCanvas();
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleRangeChange);
    chart.timeScale().subscribeVisibleTimeRangeChange(handleRangeChange);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeChange);
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handleRangeChange);
    };
  }, [renderDrawingCanvas]);

  useEffect(() => {
    renderDrawingCanvas();
  }, [renderDrawingCanvas]);

  // Keyboard shortcut listener (Delete/Backspace to remove, Escape to cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedDrawingId) {
          const drawingToDelete = drawings.find((d) => d.id === selectedDrawingId);
          if (drawingToDelete && !drawingToDelete.isLocked) {
            saveDrawings(drawings.filter((d) => d.id !== selectedDrawingId));
            setSelectedDrawingId(null);
          }
        }
      } else if (e.key === "Escape") {
        if (inFlightDrawing) {
          setInFlightDrawing(null);
          setDrawingStep(0);
          setIsDrawing(false);
          setDragStartPos(null);
        } else if (selectedDrawingId) {
          setSelectedDrawingId(null);
        } else if (activeDrawingTool !== "none" && activeDrawingTool !== "crosshair") {
          onSelectDrawingTool?.("none");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedDrawingId,
    drawings,
    inFlightDrawing,
    activeDrawingTool,
    onSelectDrawingTool,
    saveDrawings,
  ]);

  // Mouse handlers for drawing overlay (DEC-042)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = drawingCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let effectiveTime =
      coordinateToTime(x) ||
      (barsRef.current.length > 0
        ? barsRef.current[barsRef.current.length - 1].time
        : Date.now());
    let effectivePrice = coordinateToPrice(y) || currentPrice || 0;

    if (isMagnetActive) {
      const snap = findNearestCandlePoint(
        x,
        y,
        barsRef.current,
        timeToCoordinate,
        priceToCoordinate,
        25
      );
      if (snap) {
        effectiveTime = snap.time;
        effectivePrice = snap.price;
      }
    }

    // 1. Tool placement workflow
    if (activeDrawingTool !== "none" && activeDrawingTool !== "crosshair") {
      if (drawingStep === 0) {
        const newDrawing: ChartDrawing = {
          id: `drawing_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          type: activeDrawingTool,
          startTime: effectiveTime,
          startPrice: effectivePrice,
          endTime: effectiveTime,
          endPrice: effectivePrice,
          color: "#2962ff",
          isLocked: isDrawingsLocked || false,
        };
        setInFlightDrawing(newDrawing);
        setDrawingStep(1);
        setIsDrawing(true);
        setDragStartPos({
          x,
          y,
          startTime: effectiveTime,
          endTime: effectiveTime,
          startPrice: effectivePrice,
          endPrice: effectivePrice,
        });
      } else if (drawingStep === 1 && inFlightDrawing) {
        const finished: ChartDrawing = {
          ...inFlightDrawing,
          endTime: effectiveTime,
          endPrice: effectivePrice,
        };
        saveDrawings([...drawings, finished]);
        setSelectedDrawingId(finished.id);
        setInFlightDrawing(null);
        setDrawingStep(0);
        setIsDrawing(false);
        setDragStartPos(null);
        onSelectDrawingTool?.("none");
      }
      return;
    }

    // 2. Selection & handle dragging workflow
    const hit = getHitTestResult(x, y);
    if (hit) {
      setSelectedDrawingId(hit.drawing.id);
      if (!hit.drawing.isLocked && !isDrawingsLocked) {
        setDraggedHandle(hit.handle);
        setDragStartPos({
          x,
          y,
          startTime: hit.drawing.startTime,
          endTime: hit.drawing.endTime,
          startPrice: hit.drawing.startPrice,
          endPrice: hit.drawing.endPrice,
        });
      }
    } else {
      setSelectedDrawingId(null);
      setDraggedHandle(null);
      setDragStartPos(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = drawingCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let effectiveTime =
      coordinateToTime(x) ||
      (barsRef.current.length > 0
        ? barsRef.current[barsRef.current.length - 1].time
        : Date.now());
    let effectivePrice = coordinateToPrice(y) || currentPrice || 0;

    if (isMagnetActive) {
      const snap = findNearestCandlePoint(
        x,
        y,
        barsRef.current,
        timeToCoordinate,
        priceToCoordinate,
        25
      );
      if (snap) {
        setSnappedPoint(snap);
        effectiveTime = snap.time;
        effectivePrice = snap.price;
      } else {
        setSnappedPoint(null);
      }
    } else {
      setSnappedPoint(null);
    }

    if (drawingStep === 1 && inFlightDrawing) {
      setInFlightDrawing((prev) =>
        prev ? { ...prev, endTime: effectiveTime, endPrice: effectivePrice } : null
      );
      return;
    }

    if (draggedHandle && selectedDrawingId && dragStartPos) {
      const drawing = drawings.find((d) => d.id === selectedDrawingId);
      if (drawing && !drawing.isLocked && !isDrawingsLocked) {
        if (draggedHandle === "start") {
          saveDrawings(
            drawings.map((d) =>
              d.id === selectedDrawingId
                ? { ...d, startTime: effectiveTime, startPrice: effectivePrice }
                : d
            )
          );
        } else if (draggedHandle === "end") {
          saveDrawings(
            drawings.map((d) =>
              d.id === selectedDrawingId
                ? { ...d, endTime: effectiveTime, endPrice: effectivePrice }
                : d
            )
          );
        } else if (draggedHandle === "body") {
          const deltaPrice =
            effectivePrice - (coordinateToPrice(dragStartPos.y) || dragStartPos.startPrice);
          const startCoordTime = coordinateToTime(dragStartPos.x) || dragStartPos.startTime;
          const deltaTime = effectiveTime - startCoordTime;

          saveDrawings(
            drawings.map((d) =>
              d.id === selectedDrawingId
                ? {
                    ...d,
                    startTime: dragStartPos.startTime + deltaTime,
                    endTime: dragStartPos.endTime + deltaTime,
                    startPrice: dragStartPos.startPrice + deltaPrice,
                    endPrice: dragStartPos.endPrice + deltaPrice,
                  }
                : d
            )
          );
        }
      }
      return;
    }

    const hit = getHitTestResult(x, y);
    setIsHoveringDrawing(hit !== null);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = drawingCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let effectiveTime =
      coordinateToTime(x) ||
      (barsRef.current.length > 0
        ? barsRef.current[barsRef.current.length - 1].time
        : Date.now());
    let effectivePrice = coordinateToPrice(y) || currentPrice || 0;

    if (isMagnetActive) {
      const snap = findNearestCandlePoint(
        x,
        y,
        barsRef.current,
        timeToCoordinate,
        priceToCoordinate,
        25
      );
      if (snap) {
        effectiveTime = snap.time;
        effectivePrice = snap.price;
      }
    }

    if (drawingStep === 1 && inFlightDrawing && dragStartPos) {
      const dist = Math.hypot(x - dragStartPos.x, y - dragStartPos.y);
      if (dist > 15) {
        const finished: ChartDrawing = {
          ...inFlightDrawing,
          endTime: effectiveTime,
          endPrice: effectivePrice,
        };
        saveDrawings([...drawings, finished]);
        setSelectedDrawingId(finished.id);
        setInFlightDrawing(null);
        setDrawingStep(0);
        setIsDrawing(false);
        setDragStartPos(null);
        onSelectDrawingTool?.("none");
        return;
      }
    }

    if (draggedHandle) {
      setDraggedHandle(null);
      setDragStartPos(null);
    }
  };

  // Telemetry tape & Indicator HUD computations (DEC-034)
  const lastBar = bars.length > 0 ? bars[bars.length - 1] : null;
  const closes = bars.map((b) => b.close);
  const ema20Vals = closes.length >= 20 ? ta.ema(closes, 20) : [];
  const ema50Vals = closes.length >= 50 ? ta.ema(closes, 50) : [];
  const bbVals = closes.length >= 20 ? ta.bollingerbands(closes, 20, 2) : [];
  const rsiVals = closes.length >= rsiPeriod + 1 ? ta.rsi(closes, rsiPeriod) : [];
  const macdResults =
    closes.length >= macdSlow + macdSignal
      ? ta.macd(closes, macdFast, macdSlow, macdSignal)
      : [];

  const latestEma20 = ema20Vals.length > 0 ? ema20Vals[ema20Vals.length - 1] : null;
  const latestEma50 = ema50Vals.length > 0 ? ema50Vals[ema50Vals.length - 1] : null;
  const latestBb = bbVals.length > 0 ? bbVals[bbVals.length - 1] : null;
  const latestRsi = rsiVals.length > 0 ? rsiVals[rsiVals.length - 1] : null;
  const latestMacdObj = macdResults.length > 0 ? macdResults[macdResults.length - 1] : null;

  const displayBar = hoveredStats
    ? {
        open: hoveredStats.open,
        high: hoveredStats.high,
        low: hoveredStats.low,
        close: hoveredStats.close,
      }
    : lastBar;

  const displayEma20 = hoveredStats?.ema20 ?? latestEma20;
  const displayEma50 = hoveredStats?.ema50 ?? latestEma50;
  const displayBbUpper = hoveredStats?.bbUpper ?? latestBb?.upper;
  const displayBbMiddle = hoveredStats?.bbMiddle ?? latestBb?.middle;
  const displayBbLower = hoveredStats?.bbLower ?? latestBb?.lower;
  const displayRsi = hoveredStats?.rsi ?? latestRsi;
  const displayMacd = hoveredStats?.macd ?? latestMacdObj?.macd;
  const displayMacdSignal = hoveredStats?.macdSignal ?? latestMacdObj?.signal;
  const displayMacdHist = hoveredStats?.macdHist ?? latestMacdObj?.histogram;
  const displayVol = hoveredStats?.volume ?? lastBar?.volume;

  const hasRibbonOrEma =
    activeIndicators.includes("EMA Ribbon Momentum Multi-Timeframe") ||
    activeIndicators.some((ind) => ind.toLowerCase().includes("ema"));

  const hasBollinger =
    activeIndicators.includes("Bollinger Bands Squeeze Breakout") ||
    activeIndicators.some((ind) => ind.toLowerCase().includes("bollinger"));

  const hasRsi =
    activeIndicators.includes("RSI Divergence Engine Pro") ||
    activeIndicators.some((ind) => ind.toLowerCase().includes("rsi"));

  const hasMacd =
    activeIndicators.includes("Zero-Lag MACD Histogram") ||
    activeIndicators.some((ind) => ind.toLowerCase().includes("macd"));

  // Drawing overlay interaction state (DEC-042 & DEC-043)
  const isDrawingMode = activeDrawingTool !== "none" && activeDrawingTool !== "crosshair";
  const isInteracting =
    isDrawingMode ||
    isDrawing ||
    drawingStep === 1 ||
    draggedHandle !== null ||
    selectedDrawingId !== null ||
    isHoveringDrawing;

  const canvasCursor = isDrawingMode
    ? "crosshair"
    : draggedHandle
    ? "grabbing"
    : isHoveringDrawing
    ? "grab"
    : "default";

  const selectedDrawing = drawings.find((d) => d.id === selectedDrawingId);
  let floatingToolbarPos: { x: number; y: number } | null = null;
  if (selectedDrawing && !isDrawingsHidden) {
    const x1 = getSafeScreenX(selectedDrawing.startTime);
    const y1 = getSafeScreenY(selectedDrawing.startPrice);
    const x2 = getSafeScreenX(selectedDrawing.endTime);
    const y2 = getSafeScreenY(selectedDrawing.endPrice);
    if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
      const rect = drawingCanvasRef.current?.getBoundingClientRect();
      const width = rect?.width || 800;
      const top = Math.max(40, Math.min(y1, y2) - 40);
      const left = Math.max(12, Math.min(width - 180, (x1 + x2) / 2 - 80));
      floatingToolbarPos = { x: left, y: top };
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-surface flex flex-col overflow-hidden select-none"
    >
      {/* Sub-Toolbar: OHLC Tape + Dynamic Indicator HUD (DEC-034) */}
      <div className="h-8 border-b border-border bg-surface-container-lowest px-3 flex items-center justify-between text-xs font-mono shrink-0">
        {/* Left: Real-time OHLC Statistics */}
        <div className="flex items-center gap-3 text-[11px] overflow-hidden">
          {displayBar && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-muted">
                O <span className="text-on-surface">{displayBar.open.toFixed(2)}</span>
              </span>
              <span className="text-muted">
                H <span className="text-secondary">{displayBar.high.toFixed(2)}</span>
              </span>
              <span className="text-muted">
                L <span className="text-tertiary">{displayBar.low.toFixed(2)}</span>
              </span>
              <span className="text-muted">
                C{" "}
                <span className="text-on-surface font-semibold">
                  {displayBar.close.toFixed(2)}
                </span>
              </span>
            </div>
          )}

          {/* Indicator HUD Legend */}
          <div className="hidden lg:flex items-center gap-3 pl-3 border-l border-border shrink-0">
            {hasRibbonOrEma && (
              <>
                <div className="flex items-center gap-1.5 text-gold">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold" />
                  <span>EMA 20</span>
                  <span className="text-on-surface">
                    {displayEma20 !== null && displayEma20 !== undefined
                      ? displayEma20.toFixed(2)
                      : "—"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-cyan">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
                  <span>EMA 50</span>
                  <span className="text-on-surface">
                    {displayEma50 !== null && displayEma50 !== undefined
                      ? displayEma50.toFixed(2)
                      : "—"}
                  </span>
                </div>
              </>
            )}

            {hasBollinger && (
              <>
                <div className="flex items-center gap-1.5 text-[#2962ff]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2962ff]" />
                  <span>BB Up</span>
                  <span className="text-on-surface">
                    {displayBbUpper !== null && displayBbUpper !== undefined
                      ? displayBbUpper.toFixed(2)
                      : "—"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-gold">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold" />
                  <span>BB Mid</span>
                  <span className="text-on-surface">
                    {displayBbMiddle !== null && displayBbMiddle !== undefined
                      ? displayBbMiddle.toFixed(2)
                      : "—"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[#2962ff]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2962ff]" />
                  <span>BB Low</span>
                  <span className="text-on-surface">
                    {displayBbLower !== null && displayBbLower !== undefined
                      ? displayBbLower.toFixed(2)
                      : "—"}
                  </span>
                </div>
              </>
            )}

            <div className="flex items-center gap-1.5 text-muted">
              <span>Vol</span>
              <span className="text-on-surface">
                {displayVol !== undefined
                  ? displayVol >= 1000
                    ? `${(displayVol / 1000).toFixed(1)}K`
                    : displayVol.toFixed(2)
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Real-time Telemetry Status */}
        <div className="flex items-center gap-3 text-[11px] text-muted shrink-0">
          <div className="flex items-center gap-1.5">
            <Activity size={12} className="text-secondary animate-pulse" />
            <span className="hidden sm:inline">MEXC V3 WebSocket Live</span>
          </div>

          <div className="flex items-center gap-1 text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
            <ShieldCheck size={11} />
            <span className="text-[10px] font-semibold">60 FPS Lightweight Charts</span>
          </div>
        </div>
      </div>

      {/* Main Chart Workspace Area */}
      <div
        className="flex-1 relative w-full h-full"
        onMouseMove={(e) => {
          if (activeDrawingTool !== "none" && activeDrawingTool !== "crosshair") return;
          if (isDrawing || drawingStep === 1 || draggedHandle) return;
          const rect = drawingCanvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const hit = getHitTestResult(x, y);
          setIsHoveringDrawing(hit !== null);
        }}
      >
        {hasLibrary ? (
          <div id="tv_chart_container" className="w-full h-full" />
        ) : (
          <div className="w-full h-full relative">
            {/* Lightweight Charts DOM Mount Container */}
            <div
              ref={chartMountRef}
              className="w-full h-full absolute inset-0 cursor-crosshair"
            />

            {/* Interactive Drawing Overlay Canvas (DEC-040 & DEC-042) */}
            <canvas
              ref={drawingCanvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                setSnappedPoint(null);
                setIsHoveringDrawing(false);
                if (draggedHandle) {
                  setDraggedHandle(null);
                  setDragStartPos(null);
                }
                renderDrawingCanvas();
              }}
              className="w-full h-full absolute inset-0 z-10"
              style={{
                pointerEvents: isInteracting ? "auto" : "none",
                cursor: canvasCursor,
              }}
            />

            {/* Floating Action Pill for Selected Drawing (DEC-043) */}
            {selectedDrawing && floatingToolbarPos && !isDrawingsHidden && (
              <div
                style={{ top: floatingToolbarPos.y, left: floatingToolbarPos.x }}
                className="absolute z-30 flex items-center gap-1.5 bg-surface-container-lowest/95 border border-border px-2 py-1 rounded-md shadow-xl backdrop-blur-md text-xs font-mono"
              >
                {/* Color cycle button */}
                <button
                  onClick={() => {
                    const nextColor =
                      DRAWING_COLORS[
                        (DRAWING_COLORS.indexOf(selectedDrawing.color || "#2962ff") + 1) %
                          DRAWING_COLORS.length
                      ];
                    saveDrawings(
                      drawings.map((d) =>
                        d.id === selectedDrawing.id ? { ...d, color: nextColor } : d
                      )
                    );
                  }}
                  className="flex items-center gap-1 p-1 hover:bg-surface rounded text-muted hover:text-on-surface cursor-pointer"
                  title="Cycle Color"
                >
                  <span
                    className="w-3 h-3 rounded-full border border-border"
                    style={{ backgroundColor: selectedDrawing.color || "#2962ff" }}
                  />
                </button>

                {/* Lock / Unlock button */}
                <button
                  onClick={() => {
                    saveDrawings(
                      drawings.map((d) =>
                        d.id === selectedDrawing.id ? { ...d, isLocked: !d.isLocked } : d
                      )
                    );
                  }}
                  className={`p-1 rounded cursor-pointer transition-colors ${
                    selectedDrawing.isLocked
                      ? "text-gold bg-gold/10"
                      : "text-muted hover:text-on-surface hover:bg-surface"
                  }`}
                  title={selectedDrawing.isLocked ? "Unlock Drawing" : "Lock Drawing"}
                >
                  {selectedDrawing.isLocked ? <Lock size={13} /> : <Unlock size={13} />}
                </button>

                {/* Delete button */}
                <button
                  onClick={() => {
                    if (!selectedDrawing.isLocked) {
                      saveDrawings(drawings.filter((d) => d.id !== selectedDrawing.id));
                      setSelectedDrawingId(null);
                    }
                  }}
                  className={`p-1 rounded cursor-pointer transition-colors ${
                    selectedDrawing.isLocked
                      ? "opacity-30 cursor-not-allowed"
                      : "text-muted hover:text-tertiary hover:bg-tertiary/10"
                  }`}
                  title="Delete Drawing (Del)"
                  disabled={selectedDrawing.isLocked}
                >
                  <Trash2 size={13} />
                </button>

                {/* Deselect button */}
                <button
                  onClick={() => setSelectedDrawingId(null)}
                  className="p-1 rounded text-muted hover:text-on-surface hover:bg-surface cursor-pointer"
                  title="Deselect"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {/* Floating In-Pane Header Badges (DEC-038) */}
            <div className="absolute top-2 left-2 z-20 flex flex-col gap-1.5 pointer-events-none">
              {hasRsi && (
                <div className="pointer-events-auto flex items-center gap-2 bg-surface-container-lowest/90 border border-border px-2.5 py-1 rounded text-[11px] font-mono shadow-sm backdrop-blur-xs">
                  <span className="w-2 h-2 rounded-full bg-[#9353d3]" />
                  <span className="font-semibold text-on-surface">RSI ({rsiPeriod})</span>
                  <span className="text-[#9353d3] font-semibold">
                    {displayRsi !== null && displayRsi !== undefined ? displayRsi.toFixed(2) : "—"}
                  </span>
                  <div className="flex items-center gap-1 pl-1.5 border-l border-border text-muted">
                    <button
                      onClick={() =>
                        setActiveSettingsModal(
                          activeSettingsModal === "rsi" ? null : "rsi"
                        )
                      }
                      className="hover:text-primary transition-colors p-0.5 rounded cursor-pointer"
                      title="Configure RSI"
                    >
                      <Settings size={12} />
                    </button>
                    {onToggleIndicator && (
                      <button
                        onClick={() => onToggleIndicator("RSI Divergence Engine Pro")}
                        className="hover:text-tertiary transition-colors p-0.5 rounded cursor-pointer"
                        title="Remove RSI Pane"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {hasMacd && (
                <div className="pointer-events-auto flex items-center gap-2 bg-surface-container-lowest/90 border border-border px-2.5 py-1 rounded text-[11px] font-mono shadow-sm backdrop-blur-xs">
                  <span className="w-2 h-2 rounded-full bg-[#2962ff]" />
                  <span className="font-semibold text-on-surface">
                    MACD ({macdFast}, {macdSlow}, {macdSignal})
                  </span>
                  <span className="text-[#2962ff]">
                    {displayMacd !== null && displayMacd !== undefined
                      ? displayMacd.toFixed(2)
                      : "—"}
                  </span>
                  <span className="text-gold">
                    {displayMacdSignal !== null && displayMacdSignal !== undefined
                      ? displayMacdSignal.toFixed(2)
                      : "—"}
                  </span>
                  <span
                    className={
                      displayMacdHist !== null && displayMacdHist !== undefined
                        ? displayMacdHist >= 0
                          ? "text-secondary font-semibold"
                          : "text-tertiary font-semibold"
                        : "text-muted"
                    }
                  >
                    {displayMacdHist !== null && displayMacdHist !== undefined
                      ? displayMacdHist >= 0
                        ? `+${displayMacdHist.toFixed(2)}`
                        : displayMacdHist.toFixed(2)
                      : "—"}
                  </span>
                  <div className="flex items-center gap-1 pl-1.5 border-l border-border text-muted">
                    <button
                      onClick={() =>
                        setActiveSettingsModal(
                          activeSettingsModal === "macd" ? null : "macd"
                        )
                      }
                      className="hover:text-primary transition-colors p-0.5 rounded cursor-pointer"
                      title="Configure MACD"
                    >
                      <Settings size={12} />
                    </button>
                    {onToggleIndicator && (
                      <button
                        onClick={() => onToggleIndicator("Zero-Lag MACD Histogram")}
                        className="hover:text-tertiary transition-colors p-0.5 rounded cursor-pointer"
                        title="Remove MACD Pane"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Parameter Tuning Modal (DEC-038) */}
            {activeSettingsModal && (
              <div className="absolute top-12 left-2 z-30 bg-surface-container-low border border-border p-3 rounded-lg shadow-xl font-mono text-xs w-64 backdrop-blur-md">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
                  <span className="font-semibold text-on-surface uppercase">
                    {activeSettingsModal === "rsi" ? "RSI Parameters" : "MACD Parameters"}
                  </span>
                  <button
                    onClick={() => setActiveSettingsModal(null)}
                    className="text-muted hover:text-on-surface p-0.5 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                </div>

                {activeSettingsModal === "rsi" && (
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center justify-between text-muted text-[11px]">
                      <span>RSI Period:</span>
                      <input
                        type="number"
                        min="2"
                        max="100"
                        value={rsiPeriod}
                        onChange={(e) =>
                          setRsiPeriod(Math.max(2, parseInt(e.target.value) || 14))
                        }
                        className="w-16 bg-surface px-1.5 py-0.5 rounded border border-border text-right text-on-surface"
                      />
                    </label>
                    <label className="flex items-center justify-between text-muted text-[11px]">
                      <span>Overbought (70):</span>
                      <input
                        type="number"
                        min="50"
                        max="95"
                        value={rsiOverbought}
                        onChange={(e) =>
                          setRsiOverbought(parseInt(e.target.value) || 70)
                        }
                        className="w-16 bg-surface px-1.5 py-0.5 rounded border border-border text-right text-on-surface"
                      />
                    </label>
                    <label className="flex items-center justify-between text-muted text-[11px]">
                      <span>Oversold (30):</span>
                      <input
                        type="number"
                        min="5"
                        max="50"
                        value={rsiOversold}
                        onChange={(e) =>
                          setRsiOversold(parseInt(e.target.value) || 30)
                        }
                        className="w-16 bg-surface px-1.5 py-0.5 rounded border border-border text-right text-on-surface"
                      />
                    </label>
                  </div>
                )}

                {activeSettingsModal === "macd" && (
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center justify-between text-muted text-[11px]">
                      <span>Fast Length:</span>
                      <input
                        type="number"
                        min="2"
                        max="50"
                        value={macdFast}
                        onChange={(e) =>
                          setMacdFast(Math.max(2, parseInt(e.target.value) || 12))
                        }
                        className="w-16 bg-surface px-1.5 py-0.5 rounded border border-border text-right text-on-surface"
                      />
                    </label>
                    <label className="flex items-center justify-between text-muted text-[11px]">
                      <span>Slow Length:</span>
                      <input
                        type="number"
                        min="5"
                        max="100"
                        value={macdSlow}
                        onChange={(e) =>
                          setMacdSlow(Math.max(5, parseInt(e.target.value) || 26))
                        }
                        className="w-16 bg-surface px-1.5 py-0.5 rounded border border-border text-right text-on-surface"
                      />
                    </label>
                    <label className="flex items-center justify-between text-muted text-[11px]">
                      <span>Signal Smoothing:</span>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={macdSignal}
                        onChange={(e) =>
                          setMacdSignal(Math.max(1, parseInt(e.target.value) || 9))
                        }
                        className="w-16 bg-surface px-1.5 py-0.5 rounded border border-border text-right text-on-surface"
                      />
                    </label>
                  </div>
                )}

                <div className="mt-3 pt-2 border-t border-border flex justify-end">
                  <button
                    onClick={() => setActiveSettingsModal(null)}
                    className="px-2.5 py-1 rounded bg-primary text-on-primary font-semibold text-[11px] hover:bg-primary-hover cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {/* Proprietary Advanced Library Drop-In Ready Indicator */}
            <div className="absolute bottom-2 left-2 z-20 hidden sm:flex items-center gap-2 bg-surface-container-lowest/90 border border-border px-2.5 py-1 rounded text-[10px] text-muted font-mono backdrop-blur-xs">
              <Layers size={11} className="text-primary-container" />
              <span>
                TradingView JS API feed ready &bull; Drop library into{" "}
                <code className="text-primary bg-surface px-1 rounded">
                  public/charting_library/
                </code>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
