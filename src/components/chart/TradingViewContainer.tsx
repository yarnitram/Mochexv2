"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { CandlestickBar } from "@/lib/mexc/types";
import { mexcClient } from "@/lib/mexc/client";
import { mexcWsManager } from "@/lib/mexc/websocket";
import { replayEngine } from "@/lib/replay/replay-engine";
import { Bar } from "@/types/tradingview";
import { ta } from "@/lib/indicators/ta-math";
import { Activity, ShieldCheck, Layers } from "lucide-react";
import { DrawingToolType } from "../terminal/DrawingRail";
import { BacktestTrade } from "@/lib/strategy/types";
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
} from "@/lib/chart/lightweight-adapter";

interface TradingViewContainerProps {
  symbol: string;
  resolution: string;
  activeDrawingTool?: DrawingToolType;
  activeIndicators?: string[];
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

interface DrawnShape {
  type: DrawingToolType;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startPrice: number;
  endPrice: number;
}

interface HoveredStats {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  ema20?: number;
  ema50?: number;
}

export function TradingViewContainer({
  symbol,
  resolution,
  activeDrawingTool = "none",
  activeIndicators = ["EMA Ribbon Momentum Multi-Timeframe"],
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
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

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

  // Drawing tools overlay state
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [drawnShapes, setDrawnShapes] = useState<DrawnShape[]>([]);

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

      if (candleData && "open" in candleData) {
        setHoveredStats({
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volData?.value,
          ema20: ema20Data?.value,
          ema50: ema50Data?.value,
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

        // Update latest EMA point
        const closes = updated.map((b) => b.close);
        if (closes.length >= 20) {
          const ema20Vals = ta.ema(closes, 20);
          const latestEma20 = ema20Vals[ema20Vals.length - 1];
          if (!isNaN(latestEma20)) {
            ema20SeriesRef.current?.update({ time: barTime, value: latestEma20 });
          }
        }
        if (closes.length >= 50) {
          const ema50Vals = ta.ema(closes, 50);
          const latestEma50 = ema50Vals[ema50Vals.length - 1];
          if (!isNaN(latestEma50)) {
            ema50SeriesRef.current?.update({ time: barTime, value: latestEma50 });
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

  // 5. Indicator Visibility Management
  useEffect(() => {
    const hasRibbonOrEma =
      activeIndicators.includes("EMA Ribbon Momentum Multi-Timeframe") ||
      activeIndicators.some((ind) => ind.toLowerCase().includes("ema"));

    ema20SeriesRef.current?.applyOptions({ visible: hasRibbonOrEma });
    ema50SeriesRef.current?.applyOptions({ visible: hasRibbonOrEma });
  }, [activeIndicators]);

  // 6. User Drawing Overlay Canvas
  useEffect(() => {
    const handleClearDrawings = () => setDrawnShapes([]);
    window.addEventListener("mochex:clear-drawings", handleClearDrawings);
    return () => window.removeEventListener("mochex:clear-drawings", handleClearDrawings);
  }, []);

  const renderDrawingCanvas = useCallback(() => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);

    // Render persistent user annotations
    drawnShapes.forEach((shape) => {
      ctx.strokeStyle = "#2962ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(shape.startX, shape.startY);
      ctx.lineTo(shape.endX, shape.endY);
      ctx.stroke();

      // Anchor handles
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(shape.startX, shape.startY, 3.5, 0, Math.PI * 2);
      ctx.arc(shape.endX, shape.endY, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Render in-flight active drawing tool preview
    if (isDrawing && dragStart && mousePos && activeDrawingTool !== "crosshair") {
      ctx.strokeStyle = "#b6c4ff";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(dragStart.x, dragStart.y);
      ctx.lineTo(mousePos.x, mousePos.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [drawnShapes, isDrawing, dragStart, mousePos, activeDrawingTool]);

  useEffect(() => {
    renderDrawingCanvas();
  }, [renderDrawingCanvas]);

  // Mouse handlers for drawing overlay
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeDrawingTool === "none" || activeDrawingTool === "crosshair") return;
    const rect = drawingCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setIsDrawing(true);
    setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = drawingCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setMousePos(pos);
    if (isDrawing) renderDrawingCanvas();
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawing && dragStart) {
      const rect = drawingCanvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setDrawnShapes((prev) => [
          ...prev,
          {
            type: activeDrawingTool,
            startX: dragStart.x,
            startY: dragStart.y,
            endX: x,
            endY: y,
            startPrice: 0,
            endPrice: 0,
          },
        ]);
      }
    }
    setIsDrawing(false);
    setDragStart(null);
  };

  // Telemetry tape & Indicator HUD computations (DEC-034)
  const lastBar = bars.length > 0 ? bars[bars.length - 1] : null;
  const closes = bars.map((b) => b.close);
  const ema20Vals = closes.length >= 20 ? ta.ema(closes, 20) : [];
  const ema50Vals = closes.length >= 50 ? ta.ema(closes, 50) : [];
  const latestEma20 = ema20Vals.length > 0 ? ema20Vals[ema20Vals.length - 1] : null;
  const latestEma50 = ema50Vals.length > 0 ? ema50Vals[ema50Vals.length - 1] : null;

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
  const displayVol = hoveredStats?.volume ?? lastBar?.volume;

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
      <div className="flex-1 relative w-full h-full">
        {hasLibrary ? (
          <div id="tv_chart_container" className="w-full h-full" />
        ) : (
          <div className="w-full h-full relative">
            {/* Lightweight Charts DOM Mount Container */}
            <div
              ref={chartMountRef}
              className="w-full h-full absolute inset-0 cursor-crosshair"
            />

            {/* Interactive Drawing Overlay Canvas */}
            <canvas
              ref={drawingCanvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                setMousePos(null);
                renderDrawingCanvas();
              }}
              className="w-full h-full absolute inset-0 z-10"
              style={{
                pointerEvents:
                  activeDrawingTool !== "none" && activeDrawingTool !== "crosshair"
                    ? "auto"
                    : "none",
                cursor:
                  activeDrawingTool !== "none" && activeDrawingTool !== "crosshair"
                    ? "crosshair"
                    : "default",
              }}
            />

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
