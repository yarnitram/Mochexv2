"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Radar,
  Table2,
  LayoutGrid,
  Search,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  X,
  BellPlus,
  Zap,
  Flame,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  CheckCircle2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { mexcClient } from "@/lib/mexc/client";
import { mexcWsManager } from "@/lib/mexc/websocket";
import { MexcMiniTickerItem } from "@/lib/mexc/types";
import { PriceAlert } from "@/lib/alerts/alerts-engine";
import { PaperOrderInput } from "@/lib/trading/paper-trading-engine";
import {
  clampScreenerHeight,
  computeScreenerHeightFromDrag,
  SCREENER_DEFAULT_HEIGHT,
} from "@/lib/ui/resizable-layout";
import {
  ScreenerTimeframe,
  SCREENER_TIMEFRAMES,
  CONFLUENCE_TIMEFRAMES,
  ScreenerFilterPreset,
  ScreenerSortField,
  HeatmapColorMode,
  ScreenerPairRow,
  TechnicalRating,
  buildInitialScreenerSnapshot,
  updateScreenerPairWithKlines,
  filterAndSortScreenerRows,
  computeHeatmapTiles,
  matchesScreenerPreset,
} from "@/lib/screener/market-screener-engine";

interface MarketScreenerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSymbol: string;
  activeResolution: string;
  onSelectSymbol: (symbol: string) => void;
  onSelectResolution?: (res: string) => void;
  activePaneId?: string;
  isSplitGrid?: boolean;
  syncSymbol?: boolean;
}

const PRESET_DEFINITIONS: Array<{
  id: ScreenerFilterPreset;
  label: string;
  shortLabel: string;
}> = [
  { id: "all", label: "All Markets", shortLabel: "All" },
  { id: "oversold", label: "Oversold (RSI ≤ 32)", shortLabel: "Oversold" },
  { id: "overbought", label: "Overbought (RSI ≥ 68)", shortLabel: "Overbought" },
  { id: "macd_bull_cross", label: "MACD Bull Cross", shortLabel: "MACD Bull+" },
  { id: "macd_bear_cross", label: "MACD Bear Cross", shortLabel: "MACD Bear-" },
  { id: "volume_breakout", label: "Vol Breakout (RVOL ≥ 1.8x)", shortLabel: "Vol Surge" },
  { id: "mtf_strong_buy", label: "Multi-TF Strong Buy", shortLabel: "MTF Buy" },
  { id: "mtf_strong_sell", label: "Multi-TF Strong Sell", shortLabel: "MTF Sell" },
  { id: "bb_squeeze", label: "Bollinger Squeeze", shortLabel: "BB Squeeze" },
];

function formatPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(3);
  if (p >= 0.01) return p.toFixed(4);
  return p.toFixed(7);
}

function formatUsdVolume(vol: number): string {
  if (vol >= 1_000_000_000) return `$${(vol / 1_000_000_000).toFixed(2)}B`;
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(1)}K`;
  return `$${vol.toFixed(0)}`;
}

function renderRatingBadge(rating: TechnicalRating, compact = false) {
  switch (rating) {
    case "STRONG_BUY":
      return (
        <span
          className={`inline-flex items-center gap-1 font-mono font-bold rounded border bg-secondary/20 text-secondary border-secondary/50 ${
            compact ? "px-1 py-0.2 text-[9px]" : "px-1.5 py-0.5 text-[10px]"
          }`}
        >
          STRONG BUY
        </span>
      );
    case "BUY":
      return (
        <span
          className={`inline-flex items-center gap-1 font-mono font-semibold rounded border bg-secondary/10 text-secondary/90 border-secondary/30 ${
            compact ? "px-1 py-0.2 text-[9px]" : "px-1.5 py-0.5 text-[10px]"
          }`}
        >
          BUY
        </span>
      );
    case "STRONG_SELL":
      return (
        <span
          className={`inline-flex items-center gap-1 font-mono font-bold rounded border bg-tertiary/20 text-tertiary border-tertiary/50 ${
            compact ? "px-1 py-0.2 text-[9px]" : "px-1.5 py-0.5 text-[10px]"
          }`}
        >
          STRONG SELL
        </span>
      );
    case "SELL":
      return (
        <span
          className={`inline-flex items-center gap-1 font-mono font-semibold rounded border bg-tertiary/10 text-tertiary/90 border-tertiary/30 ${
            compact ? "px-1 py-0.2 text-[9px]" : "px-1.5 py-0.5 text-[10px]"
          }`}
        >
          SELL
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 font-mono font-medium rounded border bg-surface-container-high text-muted border-outline-variant/30 ${
            compact ? "px-1 py-0.2 text-[9px]" : "px-1.5 py-0.5 text-[10px]"
          }`}
        >
          NEUTRAL
        </span>
      );
  }
}

export function MarketScreenerDrawer({
  isOpen,
  onClose,
  selectedSymbol,
  activeResolution,
  onSelectSymbol,
  onSelectResolution,
  activePaneId,
  isSplitGrid = false,
  syncSymbol = false,
}: MarketScreenerDrawerProps) {
  const [rows, setRows] = useState<ScreenerPairRow[]>(() => buildInitialScreenerSnapshot());
  const [viewMode, setViewMode] = useState<"table" | "heatmap">("table");
  const [scanTimeframe, setScanTimeframe] = useState<ScreenerTimeframe>("15");
  const [activePreset, setActivePreset] = useState<ScreenerFilterPreset>("all");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "Layer 1" | "DeFi & Infra" | "Meme">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<ScreenerSortField>("volume24h");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [heatmapColorMode, setHeatmapColorMode] = useState<HeatmapColorMode>("change24h");
  const [isScanningLive, setIsScanningLive] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [syncChartTimeframeOnSelect, setSyncChartTimeframeOnSelect] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Dynamic Draggable Height Resizing & Maximize State
  const [drawerHeight, setDrawerHeight] = useState<number>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mochex:screener_height");
        if (saved) return clampScreenerHeight(Number(saved));
      } catch {}
    }
    return SCREENER_DEFAULT_HEIGHT;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const preMaximizeHeightRef = useRef<number>(SCREENER_DEFAULT_HEIGHT);

  const persistHeight = useCallback((h: number) => {
    const clamped = clampScreenerHeight(h);
    setDrawerHeight(clamped);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("mochex:screener_height", String(clamped));
      } catch {}
    }
  }, []);

  const handleStartResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startY = e.clientY;
      const startH = isMaximized ? window.innerHeight * 0.78 : drawerHeight;
      if (isMaximized) setIsMaximized(false);
      setIsResizing(true);

      const maxH = typeof window !== "undefined" ? Math.round(window.innerHeight * 0.82) : 800;

      const onMove = (ev: MouseEvent) => {
        const nextH = computeScreenerHeightFromDrag(startH, startY, ev.clientY, maxH);
        setDrawerHeight(nextH);
      };

      const onUp = (ev: MouseEvent) => {
        const finalH = computeScreenerHeightFromDrag(startH, startY, ev.clientY, maxH);
        persistHeight(finalH);
        setIsResizing(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [drawerHeight, isMaximized, persistHeight]
  );

  const handleResetHeight = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsMaximized(false);
      persistHeight(SCREENER_DEFAULT_HEIGHT);
    },
    [persistHeight]
  );

  const handleToggleMaximize = useCallback(() => {
    setIsMaximized((prev) => {
      const next = !prev;
      if (next) {
        preMaximizeHeightRef.current = drawerHeight;
      } else {
        setDrawerHeight(preMaximizeHeightRef.current || SCREENER_DEFAULT_HEIGHT);
      }
      return next;
    });
  }, [drawerHeight]);

  const rowsRef = useRef<ScreenerPairRow[]>(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    if (!actionToast) return;
    const t = setTimeout(() => setActionToast(null), 3200);
    return () => clearTimeout(t);
  }, [actionToast]);

  // Subscribe to real-time MEXC mini-tickers so prices & 24h changes stay live while Screener is open
  useEffect(() => {
    if (!isOpen) return;

    const handleMiniTickers = (items: MexcMiniTickerItem[]) => {
      if (!Array.isArray(items) || items.length === 0) return;
      const map = new Map<string, MexcMiniTickerItem>();
      for (const item of items) {
        if (item.s) map.set(item.s.toUpperCase(), item);
      }

      setRows((prev) =>
        prev.map((r) => {
          const tick = map.get(r.symbol);
          if (!tick) return r;
          const nextPrice = parseFloat(tick.p);
          const nextChange = parseFloat(tick.r) * 100;
          const nextHigh = parseFloat(tick.h);
          const nextLow = parseFloat(tick.l);
          const nextVol = parseFloat(tick.a || tick.v);
          return {
            ...r,
            price: Number.isFinite(nextPrice) && nextPrice > 0 ? nextPrice : r.price,
            change24h: Number.isFinite(nextChange) ? Number(nextChange.toFixed(2)) : r.change24h,
            high24h: Number.isFinite(nextHigh) && nextHigh > 0 ? nextHigh : r.high24h,
            low24h: Number.isFinite(nextLow) && nextLow > 0 ? nextLow : r.low24h,
            volume24h: Number.isFinite(nextVol) && nextVol > 0 ? nextVol : r.volume24h,
          };
        })
      );
    };

    mexcWsManager.subscribeMiniTickers(handleMiniTickers);
    return () => {
      mexcWsManager.unsubscribeMiniTickers(handleMiniTickers);
    };
  }, [isOpen]);

  // Batch scan live MEXC klines for the active scanTimeframe
  const runLiveKlineScan = useCallback(
    async (tf: ScreenerTimeframe = scanTimeframe) => {
      if (isScanningLive) return;
      setIsScanningLive(true);

      try {
        const currentRows = rowsRef.current;
        // Scan in lightweight batches of 5 pairs to respect rate limits while remaining fast
        const batchSize = 5;
        for (let i = 0; i < currentRows.length; i += batchSize) {
          const slice = currentRows.slice(i, i + batchSize);
          const results = await Promise.allSettled(
            slice.map(async (pair) => {
              const bars = await mexcClient.getKlines({
                symbol: pair.symbol,
                resolution: tf,
                limit: 120,
              });
              return { symbol: pair.symbol, bars };
            })
          );

          setRows((prev) =>
            prev.map((row) => {
              const found = results.find(
                (r) => r.status === "fulfilled" && r.value.symbol === row.symbol
              );
              if (found && found.status === "fulfilled" && found.value.bars.length >= 25) {
                return updateScreenerPairWithKlines(row, tf, found.value.bars);
              }
              return row;
            })
          );
        }
      } catch {
        // Keep deterministic baseline on network/CORS fallback
      } finally {
        setIsScanningLive(false);
      }
    },
    [scanTimeframe, isScanningLive]
  );

  // Trigger live scan on open or when scanTimeframe changes, plus 30s auto-refresh
  useEffect(() => {
    if (!isOpen || !autoRefresh) return;
    const timer = setInterval(() => {
      runLiveKlineScan(scanTimeframe);
    }, 30000);
    return () => clearInterval(timer);
  }, [isOpen, autoRefresh, scanTimeframe, runLiveKlineScan]);

  const handleSortColumn = (field: ScreenerSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Compute preset badge counts for the active scan timeframe
  const presetCounts = useMemo(() => {
    const counts: Record<ScreenerFilterPreset, number> = {
      all: rows.length,
      oversold: 0,
      overbought: 0,
      macd_bull_cross: 0,
      macd_bear_cross: 0,
      volume_breakout: 0,
      mtf_strong_buy: 0,
      mtf_strong_sell: 0,
      bb_squeeze: 0,
    };
    for (const r of rows) {
      for (const p of PRESET_DEFINITIONS) {
        if (p.id !== "all" && matchesScreenerPreset(r, scanTimeframe, p.id)) {
          counts[p.id]++;
        }
      }
    }
    return counts;
  }, [rows, scanTimeframe]);

  const filteredRows = useMemo(
    () =>
      filterAndSortScreenerRows(rows, {
        timeframe: scanTimeframe,
        preset: activePreset,
        category: categoryFilter,
        searchQuery,
        sortField,
        sortDirection,
      }),
    [rows, scanTimeframe, activePreset, categoryFilter, searchQuery, sortField, sortDirection]
  );

  const heatmapTiles = useMemo(
    () => computeHeatmapTiles(filteredRows, scanTimeframe, heatmapColorMode),
    [filteredRows, scanTimeframe, heatmapColorMode]
  );

  // Row Quick Action 1: Select Symbol (and optionally sync timeframe) on focused chart pane
  const handleRowSelect = (row: ScreenerPairRow) => {
    onSelectSymbol(row.symbol);
    if (syncChartTimeframeOnSelect && onSelectResolution) {
      onSelectResolution(scanTimeframe);
    }
  };

  // Row Quick Action 2: 1-Click Price Alert at +/- 0.5% or RSI threshold
  const handleQuickAlert = (row: ScreenerPairRow, e: React.MouseEvent) => {
    e.stopPropagation();
    const tfMetrics = row.timeframes[scanTimeframe];
    const targetPrice = Number(
      (row.price * (tfMetrics.score >= 0 ? 1.008 : 0.992)).toPrecision(6)
    );
    const alertItem: PriceAlert = {
      id: `scr-alert-${row.symbol}-${Date.now()}`,
      symbol: row.symbol,
      targetPrice,
      condition: "crossing",
      frequency: "only_once",
      label: `${row.symbol.replace("USDT", "")} Screener (${tfMetrics.rating.replace("_", " ")})`,
      active: true,
      triggeredCount: 0,
      createdAt: Date.now(),
      sourceType: "price",
    };

    window.dispatchEvent(
      new CustomEvent("mochex:create-drawing-alert", {
        detail: { alerts: [alertItem] },
      })
    );
    setActionToast(`Alert created for ${row.symbol} @ $${formatPrice(targetPrice)}`);
  };

  // Row Quick Action 3: 1-Click Paper Trade Execution (Market Long/Short with auto TP/SL)
  const handleQuickPaperTrade = (
    row: ScreenerPairRow,
    side: "long" | "short",
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    onSelectSymbol(row.symbol);
    const tpMultiplier = side === "long" ? 1.025 : 0.975;
    const slMultiplier = side === "long" ? 0.988 : 1.012;

    const order: PaperOrderInput = {
      symbol: row.symbol,
      side,
      orderType: "market",
      marginAmountUsdt: 1000,
      leverage: 5,
      takeProfit: Number((row.price * tpMultiplier).toPrecision(6)),
      stopLoss: Number((row.price * slMultiplier).toPrecision(6)),
    };

    window.dispatchEvent(
      new CustomEvent("mochex:execute-paper-order", {
        detail: { order },
      })
    );
    setActionToast(
      `Executed Paper ${side.toUpperCase()} on ${row.symbol} ($1,000 × 5x)`
    );
  };

  if (!isOpen) return null;

  return (
    <section
      aria-label="Market Screener and Multi-Timeframe Technical Scanner"
      style={{
        height: isMaximized ? "78vh" : `${drawerHeight}px`,
      }}
      className={`border-t border-border bg-[#0d111a] flex flex-col select-none ${
        isResizing ? "transition-none" : "transition-[height] duration-150"
      } z-30 shrink-0 relative`}
    >
      {/* Top-Edge Draggable Height Resize Divider (DEC-078) */}
      <div
        onMouseDown={handleStartResize}
        onDoubleClick={handleResetHeight}
        title="Drag to resize Screener height · Double-click to reset (340px)"
        className="h-1.5 w-full cursor-row-resize flex items-center justify-center group hover:bg-[#2962ff]/30 transition-colors relative z-40 select-none shrink-0"
      >
        <div className="w-9 h-1 rounded-full bg-outline-variant/60 group-hover:bg-[#2962ff] transition-colors" />
      </div>

      {/* 1. Top Toolbar Header */}
      <div className="h-9 px-3 border-b border-border bg-[#121621] flex items-center justify-between gap-2 shrink-0">
        {/* Left: Screener Identity + View Switcher + Timeframe Selector */}
        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-white shrink-0">
            <Radar size={14} className="text-primary animate-pulse" />
            <span>CRYPTO SCREENER</span>
            <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-surface-container-high text-cyan border border-cyan/30">
              {filteredRows.length}/{rows.length} Pairs
            </span>
            {isSplitGrid && (
              <span
                title={
                  syncSymbol
                    ? "Broadcasts symbol changes to all split panes"
                    : "Loads selected pair into the focused (blue-bordered) chart pane"
                }
                className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-[#161a25] border border-outline-variant/40 text-on-surface"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    syncSymbol
                      ? "bg-cyan shadow-[0_0_5px_#00e5ff]"
                      : "bg-[#2962ff] shadow-[0_0_5px_#2962ff]"
                  }`}
                />
                <span>
                  {syncSymbol
                    ? "All Panes (Sync)"
                    : `Pane ${activePaneId ? activePaneId.replace("pane-", "#") : "#1"}`}
                </span>
              </span>
            )}
          </div>

          <div className="h-4 w-px bg-border shrink-0" />

          {/* View Mode Toggle: Table vs 2D Heatmap */}
          <div className="flex items-center bg-surface-container-lowest p-0.5 rounded border border-border shrink-0">
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                viewMode === "table"
                  ? "bg-primary-container text-white font-bold"
                  : "text-muted hover:text-on-surface"
              }`}
            >
              <Table2 size={11} />
              <span>Technical Table</span>
            </button>
            <button
              onClick={() => setViewMode("heatmap")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                viewMode === "heatmap"
                  ? "bg-primary-container text-white font-bold"
                  : "text-muted hover:text-on-surface"
              }`}
            >
              <LayoutGrid size={11} />
              <span>2D Heatmap</span>
            </button>
          </div>

          <div className="h-4 w-px bg-border shrink-0" />

          {/* Primary Scan Timeframe Selector */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] font-mono text-muted uppercase">Scan TF:</span>
            <div className="flex items-center bg-surface-container-lowest p-0.5 rounded border border-border">
              {SCREENER_TIMEFRAMES.map((tf) => {
                const active = scanTimeframe === tf.value;
                return (
                  <button
                    key={tf.value}
                    onClick={() => {
                      setScanTimeframe(tf.value);
                      runLiveKlineScan(tf.value);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                      active
                        ? "bg-[#2962ff] text-white font-bold"
                        : "text-muted hover:text-on-surface"
                    }`}
                  >
                    {tf.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Heatmap Color Mode Selector (visible when Heatmap view is active) */}
          {viewMode === "heatmap" && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] font-mono text-muted uppercase">Color By:</span>
              <div className="flex items-center bg-surface-container-lowest p-0.5 rounded border border-border text-[10px] font-mono">
                {(
                  [
                    { id: "change24h", label: "24h Chg%" },
                    { id: "rsi14", label: "RSI(14) Heat" },
                    { id: "rating", label: "Tech Rating" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setHeatmapColorMode(m.id)}
                    className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                      heatmapColorMode === m.id
                        ? "bg-primary/25 text-primary font-bold"
                        : "text-muted hover:text-on-surface"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Sync TF toggle + Live Scan + Expand + Close */}
        <div className="flex items-center gap-2 shrink-0">
          {actionToast && (
            <div className="hidden lg:flex items-center gap-1 px-2 py-0.5 rounded bg-secondary/15 border border-secondary/40 text-secondary text-[10px] font-mono">
              <CheckCircle2 size={11} />
              <span>{actionToast}</span>
            </div>
          )}

          <button
            onClick={() => setSyncChartTimeframeOnSelect((prev) => !prev)}
            title="When enabled, clicking a screener row also sets the chart resolution to the Scan TF"
            className={`hidden md:flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono transition-colors cursor-pointer ${
              syncChartTimeframeOnSelect
                ? "bg-primary/20 border-primary/50 text-primary font-semibold"
                : "bg-surface-container-low border-outline-variant/30 text-muted hover:text-on-surface"
            }`}
          >
            <span>Sync Chart TF</span>
          </button>

          <button
            onClick={() => setAutoRefresh((prev) => !prev)}
            title="Auto-refresh live MEXC kline technicals every 30s"
            className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono transition-colors cursor-pointer ${
              autoRefresh
                ? "bg-secondary/15 border-secondary/40 text-secondary font-semibold"
                : "bg-surface-container-low border-outline-variant/30 text-muted"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? "bg-secondary animate-ping" : "bg-muted"}`} />
            <span>Auto 30s</span>
          </button>

          <button
            onClick={() => runLiveKlineScan(scanTimeframe)}
            disabled={isScanningLive}
            title="Fetch latest MEXC Spot klines across pairs and recalculate multi-timeframe indicators"
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-low hover:bg-surface-container border border-outline-variant/40 text-on-surface text-[10px] font-mono transition-colors cursor-pointer"
          >
            <RefreshCw size={11} className={isScanningLive ? "animate-spin text-primary" : "text-muted"} />
            <span>{isScanningLive ? "Scanning..." : "Rescan Now"}</span>
          </button>

          <button
            onClick={handleToggleMaximize}
            title={isMaximized ? "Restore Screener Dock Height" : "Maximize Screener Dock Height (78vh)"}
            className="p-1 rounded bg-surface-container-low hover:bg-surface-container text-muted hover:text-on-surface border border-outline-variant/30 cursor-pointer"
          >
            {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          <button
            onClick={onClose}
            title="Close Screener (Alt+S)"
            className="p-1 rounded bg-surface-container-low hover:bg-tertiary/20 text-muted hover:text-tertiary border border-outline-variant/30 cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* 2. Filter Preset Ribbon + Sector Filter + Search Input */}
      <div className="px-3 py-1.5 border-b border-border bg-[#10141f] flex items-center justify-between gap-2 shrink-0 overflow-x-auto no-scrollbar">
        {/* Preset Pills */}
        <div className="flex items-center gap-1 shrink-0">
          {PRESET_DEFINITIONS.map((preset) => {
            const isActive = activePreset === preset.id;
            const count = presetCounts[preset.id] ?? 0;
            return (
              <button
                key={preset.id}
                onClick={() => setActivePreset(preset.id)}
                title={preset.label}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                  isActive
                    ? "bg-[#2962ff]/25 border-[#2962ff] text-white font-bold shadow-xs"
                    : "bg-surface-container-lowest hover:bg-surface-container-low border-outline-variant/25 text-muted hover:text-on-surface"
                }`}
              >
                <span>{preset.shortLabel}</span>
                <span
                  className={`px-1 rounded text-[9px] ${
                    isActive ? "bg-[#2962ff] text-white" : "bg-surface-container-high text-muted"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Sector Category Filter + Search Box */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden xl:flex items-center bg-surface-container-lowest p-0.5 rounded border border-border text-[10px] font-mono">
            {(["ALL", "Layer 1", "DeFi & Infra", "Meme"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                  categoryFilter === cat
                    ? "bg-surface-container-high text-white font-semibold"
                    : "text-muted hover:text-on-surface"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-44">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter symbol..."
              className="w-full bg-surface-container-lowest text-on-surface placeholder-muted text-[11px] font-mono pl-6 pr-2 py-0.5 rounded border border-outline-variant/30 focus:outline-hidden focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* 3. Body: Either Technical Scanner Table OR 2D Market Heatmap */}
      {viewMode === "table" ? (
        <div className="flex-1 overflow-auto no-scrollbar">
          <table className="w-full border-collapse text-left font-mono text-[11px]">
            <thead className="sticky top-0 z-20 bg-[#141926] border-b border-border text-[10px] text-muted uppercase">
              <tr>
                <th
                  onClick={() => handleSortColumn("symbol")}
                  className="py-1.5 px-3 cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Pair</span>
                    <ArrowUpDown size={10} />
                  </div>
                </th>
                <th
                  onClick={() => handleSortColumn("price")}
                  className="py-1.5 px-2.5 text-right cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Last Price</span>
                    <ArrowUpDown size={10} />
                  </div>
                </th>
                <th
                  onClick={() => handleSortColumn("change24h")}
                  className="py-1.5 px-2.5 text-right cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>24h Chg</span>
                    <ArrowUpDown size={10} />
                  </div>
                </th>
                <th
                  onClick={() => handleSortColumn("volume24h")}
                  className="py-1.5 px-2.5 text-right cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>24h Vol</span>
                    <ArrowUpDown size={10} />
                  </div>
                </th>
                <th
                  onClick={() => handleSortColumn("rvol")}
                  className="py-1.5 px-2.5 text-right cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>RVOL</span>
                    <ArrowUpDown size={10} />
                  </div>
                </th>
                <th
                  onClick={() => handleSortColumn("rsi14")}
                  className="py-1.5 px-3 cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>RSI (14)</span>
                    <ArrowUpDown size={10} />
                  </div>
                </th>
                <th
                  onClick={() => handleSortColumn("macdHistogram")}
                  className="py-1.5 px-2.5 cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>MACD (12,26,9)</span>
                    <ArrowUpDown size={10} />
                  </div>
                </th>
                <th className="py-1.5 px-2.5">EMA 20/50/200</th>
                <th
                  onClick={() => handleSortColumn("bbWidthPct")}
                  className="py-1.5 px-2.5 cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Bollinger (20,2)</span>
                    <ArrowUpDown size={10} />
                  </div>
                </th>
                <th
                  onClick={() => handleSortColumn("mtfScore")}
                  className="py-1.5 px-3 cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>MTF Confluence (15m·1H·4H·1D)</span>
                    <ArrowUpDown size={10} />
                  </div>
                </th>
                <th
                  onClick={() => handleSortColumn("score")}
                  className="py-1.5 px-2.5 text-center cursor-pointer hover:text-white select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Rating</span>
                    <ArrowUpDown size={10} />
                  </div>
                </th>
                <th className="py-1.5 px-3 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/35">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-muted text-xs">
                    No MEXC Spot pairs match the current filter preset. Click{" "}
                    <button
                      onClick={() => {
                        setActivePreset("all");
                        setCategoryFilter("ALL");
                        setSearchQuery("");
                      }}
                      className="text-primary underline cursor-pointer"
                    >
                      Reset Filters
                    </button>{" "}
                    to view all markets.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const tf = row.timeframes[scanTimeframe];
                  const isSelected = row.symbol === selectedSymbol;
                  const isPos = row.change24h >= 0;

                  // RSI heat color
                  const rsiColor =
                    tf.rsi14 <= 30
                      ? "text-secondary font-bold"
                      : tf.rsi14 >= 70
                        ? "text-tertiary font-bold"
                        : "text-on-surface";
                  const rsiBarColor =
                    tf.rsi14 <= 30
                      ? "bg-secondary"
                      : tf.rsi14 >= 70
                        ? "bg-tertiary"
                        : "bg-[#2962ff]";

                  return (
                    <tr
                      key={row.symbol}
                      onClick={() => handleRowSelect(row)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-[#2962ff]/15 hover:bg-[#2962ff]/20"
                          : "hover:bg-surface-container-low/80"
                      }`}
                    >
                      {/* 1. Pair & Category */}
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? "bg-[#2962ff] shadow-[0_0_6px_#2962ff]" : "bg-muted/40"
                            }`}
                          />
                          <span className="font-bold text-white">
                            {row.symbol.replace(/USDT$/, "")}
                          </span>
                          <span className="text-[9px] text-muted">/USDT</span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-surface-container-high text-muted">
                            {row.category}
                          </span>
                        </div>
                      </td>

                      {/* 2. Last Price */}
                      <td className="py-1.5 px-2.5 text-right font-semibold text-on-surface whitespace-nowrap">
                        ${formatPrice(row.price)}
                      </td>

                      {/* 3. 24h Chg % */}
                      <td className="py-1.5 px-2.5 text-right whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            isPos
                              ? "bg-secondary/15 text-secondary"
                              : "bg-tertiary/15 text-tertiary"
                          }`}
                        >
                          {isPos ? "+" : ""}
                          {row.change24h.toFixed(2)}%
                        </span>
                      </td>

                      {/* 4. 24h Volume */}
                      <td className="py-1.5 px-2.5 text-right text-muted whitespace-nowrap">
                        {formatUsdVolume(row.volume24h)}
                      </td>

                      {/* 5. Relative Volume (RVOL) */}
                      <td className="py-1.5 px-2.5 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] ${
                            tf.isVolumeBreakout
                              ? "bg-gold/15 text-gold border border-gold/40 font-bold"
                              : "text-on-surface"
                          }`}
                        >
                          {tf.isVolumeBreakout && <Flame size={10} className="text-gold" />}
                          {tf.rvol.toFixed(2)}x
                        </span>
                      </td>

                      {/* 6. RSI (14) + Heat Progress Bar */}
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`w-9 text-right ${rsiColor}`}>
                            {tf.rsi14.toFixed(1)}
                          </span>
                          <div className="w-14 h-1.5 rounded-full bg-surface-container-highest overflow-hidden relative">
                            <div
                              style={{ width: `${Math.min(100, Math.max(0, tf.rsi14))}%` }}
                              className={`h-full rounded-full ${rsiBarColor}`}
                            />
                          </div>
                          {tf.rsiZone !== "neutral" && (
                            <span
                              className={`text-[8px] uppercase px-1 rounded font-bold ${
                                tf.rsiZone === "oversold"
                                  ? "bg-secondary/20 text-secondary"
                                  : "bg-tertiary/20 text-tertiary"
                              }`}
                            >
                              {tf.rsiZone === "oversold" ? "OS" : "OB"}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 7. MACD (12, 26, 9) State */}
                      <td className="py-1.5 px-2.5 whitespace-nowrap">
                        {tf.macdCross === "bullish_cross" ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary/20 text-secondary border border-secondary/40 text-[10px] font-bold">
                            <TrendingUp size={10} />
                            BULL CROSS
                          </span>
                        ) : tf.macdCross === "bearish_cross" ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-tertiary/20 text-tertiary border border-tertiary/40 text-[10px] font-bold">
                            <TrendingDown size={10} />
                            BEAR CROSS
                          </span>
                        ) : tf.macdCross === "bullish" ? (
                          <span className="text-secondary text-[10px] font-medium">
                            Bullish (+Hist)
                          </span>
                        ) : (
                          <span className="text-tertiary text-[10px] font-medium">
                            Bearish (-Hist)
                          </span>
                        )}
                      </td>

                      {/* 8. EMA 20/50/200 Trend */}
                      <td className="py-1.5 px-2.5 whitespace-nowrap">
                        {tf.emaTrend === "strong_uptrend" ? (
                          <span className="text-secondary font-bold text-[10px]">
                            ▲ Strong Bull (20&gt;50&gt;200)
                          </span>
                        ) : tf.emaTrend === "uptrend" ? (
                          <span className="text-secondary/85 text-[10px]">▲ Uptrend</span>
                        ) : tf.emaTrend === "strong_downtrend" ? (
                          <span className="text-tertiary font-bold text-[10px]">
                            ▼ Strong Bear (20&lt;50&lt;200)
                          </span>
                        ) : tf.emaTrend === "downtrend" ? (
                          <span className="text-tertiary/85 text-[10px]">▼ Downtrend</span>
                        ) : (
                          <span className="text-muted text-[10px]">◆ Range / Mixed</span>
                        )}
                      </td>

                      {/* 9. Bollinger Bands Status */}
                      <td className="py-1.5 px-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {tf.bbStatus === "squeeze" ? (
                            <span className="px-1.5 py-0.2 rounded bg-cyan/20 text-cyan border border-cyan/40 text-[9px] font-bold">
                              SQUEEZE
                            </span>
                          ) : tf.bbStatus === "upper_breakout" ? (
                            <span className="px-1.5 py-0.2 rounded bg-secondary/20 text-secondary text-[9px] font-semibold">
                              UPPER BREAK
                            </span>
                          ) : tf.bbStatus === "lower_breakout" ? (
                            <span className="px-1.5 py-0.2 rounded bg-tertiary/20 text-tertiary text-[9px] font-semibold">
                              LOWER BREAK
                            </span>
                          ) : (
                            <span className="text-muted text-[10px]">In-Band</span>
                          )}
                          <span className="text-[9px] text-muted">({tf.bbWidthPct.toFixed(1)}%)</span>
                        </div>
                      </td>

                      {/* 10. 4-Timeframe Confluence Strip (15m · 1H · 4H · 1D) */}
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {CONFLUENCE_TIMEFRAMES.map((cTf) => {
                            const m = row.timeframes[cTf];
                            const label =
                              cTf === "15"
                                ? "15m"
                                : cTf === "60"
                                  ? "1H"
                                  : cTf === "240"
                                    ? "4H"
                                    : "1D";
                            const isBull = m.rating === "STRONG_BUY" || m.rating === "BUY";
                            const isBear = m.rating === "STRONG_SELL" || m.rating === "SELL";
                            return (
                              <span
                                key={cTf}
                                title={`${label}: RSI ${m.rsi14.toFixed(1)} · ${m.rating.replace("_", " ")}`}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                  isBull
                                    ? "bg-secondary/20 border-secondary/45 text-secondary"
                                    : isBear
                                      ? "bg-tertiary/20 border-tertiary/45 text-tertiary"
                                      : "bg-surface-container-high border-outline-variant/30 text-muted"
                                }`}
                              >
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      {/* 11. Overall Technical Rating */}
                      <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                        {renderRatingBadge(tf.rating, true)}
                      </td>

                      {/* 12. Row Quick Actions: Alert + Paper Long / Short */}
                      <td className="py-1.5 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => handleQuickAlert(row, e)}
                            title={`Create Price Crossing Alert for ${row.symbol}`}
                            className="p-1 rounded bg-surface-container-low hover:bg-gold/20 text-muted hover:text-gold border border-outline-variant/30 transition-colors cursor-pointer"
                          >
                            <BellPlus size={11} />
                          </button>
                          <button
                            onClick={(e) => handleQuickPaperTrade(row, "long", e)}
                            title={`1-Click Paper LONG ${row.symbol} ($1,000 × 5x)`}
                            className="px-1.5 py-0.5 rounded bg-secondary/15 hover:bg-secondary/30 text-secondary border border-secondary/30 text-[9px] font-bold transition-colors cursor-pointer"
                          >
                            ⚡L
                          </button>
                          <button
                            onClick={(e) => handleQuickPaperTrade(row, "short", e)}
                            title={`1-Click Paper SHORT ${row.symbol} ($1,000 × 5x)`}
                            className="px-1.5 py-0.5 rounded bg-tertiary/15 hover:bg-tertiary/30 text-tertiary border border-tertiary/30 text-[9px] font-bold transition-colors cursor-pointer"
                          >
                            ⚡S
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* View 2: 2D Market Heatmap Tiles */
        <div className="flex-1 p-2.5 overflow-y-auto no-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 h-full min-h-[190px]">
            {heatmapTiles.map((tile) => {
              const row = rows.find((r) => r.symbol === tile.symbol);
              const isSelected = tile.symbol === selectedSymbol;
              const isPos = tile.change24h >= 0;

              return (
                <div
                  key={tile.symbol}
                  onClick={() => row && handleRowSelect(row)}
                  style={{
                    backgroundColor: tile.bgColor,
                    borderColor: isSelected ? "#2962ff" : tile.borderColor,
                  }}
                  className={`relative rounded-lg border p-2.5 flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.01] group ${
                    isSelected ? "ring-2 ring-[#2962ff]" : ""
                  }`}
                >
                  {/* Top row: Symbol + Quick Action icons on hover */}
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <div className="font-mono font-black text-xs text-white flex items-center gap-1">
                        <span>{tile.baseAsset}</span>
                        <span className="text-[9px] font-normal text-muted">/USDT</span>
                      </div>
                      <span className="text-[9px] font-mono text-muted">{tile.category}</span>
                    </div>

                    {row && (
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <button
                          onClick={(e) => handleQuickAlert(row, e)}
                          title={`Quick Alert on ${tile.symbol}`}
                          className="p-1 rounded bg-black/40 hover:bg-gold/30 text-white hover:text-gold transition-colors cursor-pointer"
                        >
                          <BellPlus size={10} />
                        </button>
                        <button
                          onClick={(e) => handleQuickPaperTrade(row, isPos ? "long" : "short", e)}
                          title={`Quick Paper ${isPos ? "LONG" : "SHORT"} ${tile.symbol}`}
                          className="p-1 rounded bg-black/40 hover:bg-primary/40 text-white transition-colors cursor-pointer"
                        >
                          <Zap size={10} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Center: Price & Primary Metric */}
                  <div className="my-1 font-mono">
                    <div className="text-xs font-bold text-white">${formatPrice(tile.price)}</div>
                    <div
                      style={{ color: tile.textColor }}
                      className="text-sm font-black tracking-tight"
                    >
                      {isPos ? "+" : ""}
                      {tile.change24h.toFixed(2)}%
                    </div>
                  </div>

                  {/* Bottom: RSI + RVOL + Rating */}
                  <div className="flex items-center justify-between text-[9px] font-mono border-t border-white/10 pt-1">
                    <span className="text-white/90">
                      RSI <strong>{tile.rsi14.toFixed(0)}</strong> · {tile.rvol.toFixed(1)}x
                    </span>
                    <span className="uppercase font-bold" style={{ color: tile.textColor }}>
                      {tile.rating.replace("_", " ")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
