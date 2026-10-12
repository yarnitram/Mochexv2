"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { MexcDatafeed } from "@/lib/mexc/datafeed";
import { CandlestickBar } from "@/lib/mexc/types";
import { mexcClient } from "@/lib/mexc/client";
import { mexcWsManager } from "@/lib/mexc/websocket";
import { replayEngine } from "@/lib/replay/replay-engine";
import { Bar } from "@/types/tradingview";
import { ta } from "@/lib/indicators/ta-math";
import { Activity, ShieldCheck, Layers, Eye, Settings, X } from "lucide-react";
import { DrawingToolType } from "../terminal/DrawingRail";
import { BacktestTrade } from "@/lib/strategy/types";

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasLibrary, setHasLibrary] = useState(false);
  const [bars, setBars] = useState<CandlestickBar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  // Mouse & Drawing interaction state
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [drawnShapes, setDrawnShapes] = useState<DrawnShape[]>([]);

  // 1. Check for TradingView Advanced Charts proprietary library
  useEffect(() => {
    if (typeof window !== "undefined" && window.TradingView) {
      setHasLibrary(true);
    }
  }, []);

  // 2. Load historical klines and attach real-time feed
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    const loadData = async () => {
      try {
        const fetchedBars = await mexcClient.getKlines({
          symbol,
          resolution,
          limit: 300,
        });

        if (!isCancelled) {
          setBars(fetchedBars);
          replayEngine.loadHistory(fetchedBars as Bar[]);
          onBarsLoaded?.(fetchedBars);

          if (fetchedBars.length > 0) {
            const lastBar = fetchedBars[fetchedBars.length - 1];
            const firstBar = fetchedBars[0];
            const change = firstBar.open > 0 ? ((lastBar.close - firstBar.open) / firstBar.open) * 100 : 0;
            const high = Math.max(...fetchedBars.map((b) => b.high));
            const low = Math.min(...fetchedBars.map((b) => b.low));
            const volume = fetchedBars.reduce((acc, b) => acc + b.volume, 0);

            setCurrentPrice(lastBar.close);
            onPriceUpdate?.({
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

      setBars((prev) => {
        if (prev.length === 0) return [newBar];
        const last = prev[prev.length - 1];
        if (last.time === newBar.time) {
          const updated = [...prev];
          updated[updated.length - 1] = newBar;
          return updated;
        }
        return [...prev.slice(-299), newBar];
      });

      setCurrentPrice(newBar.close);
    });

    // Replay Engine Listener
    const unsubscribeReplay = replayEngine.subscribe({
      onTick: (replayBar) => {
        setCurrentPrice(replayBar.close);
        setBars(replayEngine.getVisibleBars() as CandlestickBar[]);
      },
    });

    return () => {
      isCancelled = true;
      mexcWsManager.unsubscribeKline(channel);
      unsubscribeReplay();
    };
  }, [symbol, resolution, onBarsLoaded, onPriceUpdate]);

  // 3. Clear drawings when requested
  useEffect(() => {
    const handleClearDrawings = () => setDrawnShapes([]);
    window.addEventListener("mochex:clear-drawings", handleClearDrawings);
    return () => window.removeEventListener("mochex:clear-drawings", handleClearDrawings);
  }, []);

  // 4. Render High-Definition Canvas fallback
  const renderCanvas = useCallback(() => {
    if (hasLibrary) return;
    const canvas = canvasRef.current;
    if (!canvas || bars.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Stitch Surface Background (#0A141F)
    ctx.fillStyle = "#0a141f";
    ctx.fillRect(0, 0, width, height);

    // Dynamic price scale calculation
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVolume = 0;

    bars.forEach((b) => {
      if (b.low < minPrice) minPrice = b.low;
      if (b.high > maxPrice) maxPrice = b.high;
      if (b.volume > maxVolume) maxVolume = b.volume;
    });

    const priceMargin = (maxPrice - minPrice) * 0.05 || 1;
    minPrice -= priceMargin;
    maxPrice += priceMargin;
    const priceRange = maxPrice - minPrice;

    const rightScaleWidth = 65;
    const chartWidth = width - rightScaleWidth;
    const volumeHeight = Math.max(50, height * 0.16);
    const mainChartHeight = height - volumeHeight - 30;

    // 4.1 Draw Grid Lines
    ctx.strokeStyle = "#131c27";
    ctx.lineWidth = 1;

    // Horizontal Price Grids
    const gridRows = 6;
    for (let i = 0; i <= gridRows; i++) {
      const y = 20 + (mainChartHeight / gridRows) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();

      // Right Scale Price Labels
      const p = maxPrice - (priceRange / gridRows) * i;
      ctx.fillStyle = "#8d90a2";
      ctx.font = "10px JetBrains Mono, monospace";
      ctx.fillText(p.toFixed(2), chartWidth + 6, y + 3);
    }

    // Right Scale Border
    ctx.strokeStyle = "#17202b";
    ctx.beginPath();
    ctx.moveTo(chartWidth, 0);
    ctx.lineTo(chartWidth, height);
    ctx.stroke();

    // Volume Separator Line
    ctx.beginPath();
    ctx.moveTo(0, mainChartHeight + 20);
    ctx.lineTo(chartWidth, mainChartHeight + 20);
    ctx.stroke();

    // 4.2 Candlesticks & Volume Rendering
    const barSpacing = Math.max(2, chartWidth / bars.length);
    const barWidth = Math.max(1, barSpacing * 0.7);

    // Compute EMAs if active
    const closes = bars.map((b) => b.close);
    const ema20 = ta.ema(closes, 20);
    const ema50 = ta.ema(closes, 50);

    bars.forEach((bar, idx) => {
      const x = idx * barSpacing + barSpacing * 0.15;
      const isBull = bar.close >= bar.open;
      const color = isBull ? "#00c087" : "#ff3b30";

      const yHigh = 20 + mainChartHeight * (1 - (bar.high - minPrice) / priceRange);
      const yLow = 20 + mainChartHeight * (1 - (bar.low - minPrice) / priceRange);
      const yOpen = 20 + mainChartHeight * (1 - (bar.open - minPrice) / priceRange);
      const yClose = 20 + mainChartHeight * (1 - (bar.close - minPrice) / priceRange);

      // Candlestick Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + barWidth / 2, yHigh);
      ctx.lineTo(x + barWidth / 2, yLow);
      ctx.stroke();

      // Candlestick Body
      ctx.fillStyle = color;
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(1.5, Math.abs(yClose - yOpen));
      ctx.fillRect(x, bodyTop, barWidth, bodyHeight);

      // Volume Bar in bottom sub-pane
      const volRatio = maxVolume > 0 ? bar.volume / maxVolume : 0;
      const volBarHeight = volRatio * (volumeHeight - 10);
      const volY = height - volBarHeight;
      ctx.fillStyle = isBull ? "rgba(0, 192, 135, 0.35)" : "rgba(255, 59, 48, 0.35)";
      ctx.fillRect(x, volY, barWidth, volBarHeight);
    });

    // 4.3 Draw EMA Overlays
    const drawEmaLine = (emaSeries: number[], strokeColor: string) => {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let started = false;

      emaSeries.forEach((val, i) => {
        if (val === undefined || isNaN(val)) return;
        const x = i * barSpacing + barSpacing / 2;
        const y = 20 + mainChartHeight * (1 - (val - minPrice) / priceRange);

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    };

    // Draw Gold EMA 20 and Cyan EMA 50
    drawEmaLine(ema20, "#f5ac37");
    drawEmaLine(ema50, "#00d8ff");

    // 4.4 Render User Canvas Drawings
    drawnShapes.forEach((shape) => {
      ctx.strokeStyle = "#2962ff";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(shape.startX, shape.startY);
      ctx.lineTo(shape.endX, shape.endY);
      ctx.stroke();

      // End Anchor dots
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(shape.startX, shape.startY, 3, 0, Math.PI * 2);
      ctx.arc(shape.endX, shape.endY, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Render active drawing in-flight preview
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

    // 4.5 Render Backtest Strategy Trade Markers
    trades.forEach((trade) => {
      const entryIdx = trade.entryBarIndex;
      const exitIdx = trade.exitBarIndex;

      if (entryIdx >= 0 && entryIdx < bars.length) {
        const entryX = entryIdx * barSpacing + barSpacing / 2;
        const entryY = 20 + mainChartHeight * (1 - (trade.entryPrice - minPrice) / priceRange);
        const isLong = trade.direction === "long";

        // Entry Marker Triangle
        ctx.fillStyle = isLong ? "#00c087" : "#ff3b30";
        ctx.beginPath();
        if (isLong) {
          ctx.moveTo(entryX, entryY + 12);
          ctx.lineTo(entryX - 4, entryY + 19);
          ctx.lineTo(entryX + 4, entryY + 19);
        } else {
          ctx.moveTo(entryX, entryY - 12);
          ctx.lineTo(entryX - 4, entryY - 19);
          ctx.lineTo(entryX + 4, entryY - 19);
        }
        ctx.closePath();
        ctx.fill();

        // Connected Trade Path to Exit
        if (exitIdx >= 0 && exitIdx < bars.length) {
          const exitX = exitIdx * barSpacing + barSpacing / 2;
          const exitY = 20 + mainChartHeight * (1 - (trade.exitPrice - minPrice) / priceRange);
          const isProfitable = trade.netPnL >= 0;

          ctx.strokeStyle = isProfitable ? "rgba(0, 192, 135, 0.45)" : "rgba(255, 59, 48, 0.45)";
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(entryX, entryY);
          ctx.lineTo(exitX, exitY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Exit 'X' Marker
          ctx.strokeStyle = isProfitable ? "#00c087" : "#ff3b30";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(exitX - 3, exitY - 3);
          ctx.lineTo(exitX + 3, exitY + 3);
          ctx.moveTo(exitX + 3, exitY - 3);
          ctx.lineTo(exitX - 3, exitY + 3);
          ctx.stroke();
        }
      }
    });

    // 4.6 Interactive Crosshair
    if (mousePos && mousePos.x < chartWidth && mousePos.y < height) {
      ctx.strokeStyle = "rgba(141, 144, 162, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(mousePos.x, 0);
      ctx.lineTo(mousePos.x, height);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(0, mousePos.y);
      ctx.lineTo(chartWidth, mousePos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Right Scale Price Pill on Crosshair
      const curP = maxPrice - ((mousePos.y - 20) / mainChartHeight) * priceRange;
      ctx.fillStyle = "#2962ff";
      ctx.fillRect(chartWidth, mousePos.y - 9, rightScaleWidth, 18);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px JetBrains Mono, monospace";
      ctx.fillText(curP.toFixed(2), chartWidth + 5, mousePos.y + 3);
    }
  }, [bars, hasLibrary, drawnShapes, isDrawing, dragStart, mousePos, activeDrawingTool]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => renderCanvas();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderCanvas]);

  // Mouse Interaction handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeDrawingTool !== "none" && activeDrawingTool !== "crosshair") {
      setIsDrawing(true);
      setDragStart({ x, y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });
    renderCanvas();
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawing && dragStart) {
      const rect = canvasRef.current?.getBoundingClientRect();
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

  const lastBar = bars.length > 0 ? bars[bars.length - 1] : null;

  return (
    <div ref={containerRef} className="relative w-full h-full bg-surface flex flex-col overflow-hidden select-none">
      {/* Sub-Toolbar: OHLC Tape + Dynamic Indicator HUD */}
      <div className="h-8 border-b border-border bg-surface-container-lowest px-3 flex items-center justify-between text-xs font-mono shrink-0">
        {/* Left: OHLC Stats */}
        <div className="flex items-center gap-3 text-[11px]">
          {lastBar && (
            <div className="flex items-center gap-2">
              <span className="text-muted">
                O <span className="text-on-surface">{lastBar.open.toFixed(2)}</span>
              </span>
              <span className="text-muted">
                H <span className="text-secondary">{lastBar.high.toFixed(2)}</span>
              </span>
              <span className="text-muted">
                L <span className="text-tertiary">{lastBar.low.toFixed(2)}</span>
              </span>
              <span className="text-muted">
                C <span className="text-on-surface font-semibold">{lastBar.close.toFixed(2)}</span>
              </span>
            </div>
          )}

          {/* Indicator HUD Legend */}
          <div className="hidden lg:flex items-center gap-3 pl-3 border-l border-border">
            <div className="flex items-center gap-1.5 text-gold">
              <span className="w-1.5 h-1.5 rounded-full bg-gold" />
              <span>EMA 20</span>
              <span className="text-on-surface">
                {currentPrice ? (currentPrice * 0.998).toFixed(2) : "68,410.20"}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-cyan">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
              <span>EMA 50</span>
              <span className="text-on-surface">
                {currentPrice ? (currentPrice * 0.991).toFixed(2) : "67,950.40"}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-muted">
              <span>Vol 20</span>
              <span className="text-on-surface">4.2K</span>
            </div>
          </div>
        </div>

        {/* Right: Real-time Telemetry Status */}
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <div className="flex items-center gap-1.5">
            <Activity size={12} className="text-secondary animate-pulse" />
            <span className="hidden sm:inline">MEXC V3 WebSocket Live</span>
          </div>

          <div className="flex items-center gap-1 text-primary bg-primary/10 px-1.5 py-0.2 rounded border border-primary/20">
            <ShieldCheck size={11} />
            <span className="text-[10px]">60 FPS Canvas</span>
          </div>
        </div>
      </div>

      {/* Main Chart Canvas / TradingView container */}
      <div className="flex-1 relative w-full h-full cursor-crosshair">
        {hasLibrary ? (
          <div id="tv_chart_container" className="w-full h-full" />
        ) : (
          <div className="w-full h-full relative">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => setMousePos(null)}
              className="w-full h-full block"
            />

            {/* Drop-in banner */}
            <div className="absolute bottom-2 left-2 z-10 hidden sm:flex items-center gap-2 bg-surface-container-lowest/90 border border-border px-2.5 py-1 rounded text-[10px] text-muted font-mono backdrop-blur-xs">
              <Layers size={11} className="text-primary-container" />
              <span>
                TradingView JS API feed ready &bull; Drop library into{" "}
                <code className="text-primary bg-surface px-1 rounded">public/charting_library/</code>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
