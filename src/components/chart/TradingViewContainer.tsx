"use client";

import React, { useEffect, useRef, useState } from "react";
import { MexcDatafeed } from "@/lib/mexc/datafeed";
import { CandlestickBar } from "@/lib/mexc/types";
import { mexcClient } from "@/lib/mexc/client";
import { mexcWsManager } from "@/lib/mexc/websocket";
import { replayEngine } from "@/lib/replay/replay-engine";
import { Bar } from "@/types/tradingview";
import { Activity, ShieldCheck, Layers } from "lucide-react";

interface TradingViewContainerProps {
  symbol: string;
  resolution: string;
  onBarsLoaded?: (bars: CandlestickBar[]) => void;
}

declare global {
  interface Window {
    TradingView?: any;
  }
}

export function TradingViewContainer({
  symbol,
  resolution,
  onBarsLoaded,
}: TradingViewContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasLibrary, setHasLibrary] = useState(false);
  const [bars, setBars] = useState<CandlestickBar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  // 1. Check for TradingView Advanced Charts library
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
            setCurrentPrice(fetchedBars[fetchedBars.length - 1].close);
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
  }, [symbol, resolution, onBarsLoaded]);

  // 3. Render Canvas fallback if TradingView proprietary library not present
  useEffect(() => {
    if (hasLibrary) return;
    const canvas = canvasRef.current;
    if (!canvas || bars.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;

    // Background
    ctx.fillStyle = "#0b0e14";
    ctx.fillRect(0, 0, width, height);

    // Compute min and max
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    bars.forEach((b) => {
      if (b.low < minPrice) minPrice = b.low;
      if (b.high > maxPrice) maxPrice = b.high;
    });

    const priceRange = maxPrice - minPrice || 1;
    const padding = 40;
    const chartHeight = height - padding * 2;
    const barWidth = Math.max(2, (width - 80) / bars.length - 2);

    // Grid lines
    ctx.strokeStyle = "#161d2b";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = padding + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width - 60, y);
      ctx.stroke();

      const priceLevel = maxPrice - (priceRange / 4) * i;
      ctx.fillStyle = "#4b5563";
      ctx.font = "10px monospace";
      ctx.fillText(priceLevel.toFixed(2), width - 55, y + 3);
    }

    // Draw candlesticks
    bars.forEach((bar, idx) => {
      const x = 10 + idx * (barWidth + 2);
      const isBull = bar.close >= bar.open;

      const yHigh = padding + chartHeight * (1 - (bar.high - minPrice) / priceRange);
      const yLow = padding + chartHeight * (1 - (bar.low - minPrice) / priceRange);
      const yOpen = padding + chartHeight * (1 - (bar.open - minPrice) / priceRange);
      const yClose = padding + chartHeight * (1 - (bar.close - minPrice) / priceRange);

      const color = isBull ? "#00c076" : "#ff433d";

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + barWidth / 2, yHigh);
      ctx.lineTo(x + barWidth / 2, yLow);
      ctx.stroke();

      // Body
      ctx.fillStyle = color;
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));
      ctx.fillRect(x, bodyTop, barWidth, bodyHeight);
    });
  }, [bars, hasLibrary]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-background flex flex-col overflow-hidden">
      {/* Top telemetry bar */}
      <div className="h-10 border-b border-border bg-surface/80 backdrop-blur px-4 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <span className="text-sm font-sans">{symbol}</span>
            <span className="px-1.5 py-0.5 bg-surface-card rounded text-[11px] text-accent border border-border">
              {resolution}
            </span>
          </div>

          {currentPrice && (
            <div className="text-sm font-bold text-foreground">
              ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-[11px] text-muted">
          <div className="flex items-center gap-1.5">
            <Activity size={13} className="text-bull animate-pulse" />
            <span>MEXC V3 Stream Live</span>
          </div>

          <div className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            <ShieldCheck size={12} />
            <span>JS API Datafeed Compliant</span>
          </div>
        </div>
      </div>

      {/* Main Chart Canvas / TradingView container */}
      <div className="flex-1 relative w-full h-full">
        {hasLibrary ? (
          <div id="tv_chart_container" className="w-full h-full" />
        ) : (
          <div className="w-full h-full relative">
            <canvas ref={canvasRef} className="w-full h-full block" />

            {/* Drop-in banner */}
            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 bg-surface/90 border border-border px-3 py-1.5 rounded-lg shadow-lg text-[11px] text-muted font-mono">
              <Layers size={13} className="text-accent" />
              <span>
                TradingView JS API Datafeed active. Drop proprietary library in{" "}
                <code className="text-accent bg-surface-card px-1 py-0.5 rounded">public/charting_library/</code>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
