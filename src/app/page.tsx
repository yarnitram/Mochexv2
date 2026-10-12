"use client";

import React, { useState } from "react";
import { TradingViewContainer } from "@/components/chart/TradingViewContainer";
import { WatchlistDrawer } from "@/components/watchlist/WatchlistDrawer";
import { ReplayToolbar } from "@/components/chart/ReplayToolbar";
import { IndicatorEditorModal } from "@/components/editor/IndicatorEditorModal";
import { replayEngine } from "@/lib/replay/replay-engine";
import { CandlestickBar } from "@/lib/mexc/types";
import {
  RotateCcw,
  Code2,
  ListFilter,
  TrendingUp,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";

const TIMEFRAMES = [
  { label: "1m", value: "1" },
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "30m", value: "30" },
  { label: "1h", value: "60" },
  { label: "4h", value: "240" },
  { label: "1D", value: "1D" },
];

export default function WorkstationPage() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [resolution, setResolution] = useState("15");
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(true);
  const [isIndicatorModalOpen, setIsIndicatorModalOpen] = useState(false);
  const [isReplayActive, setIsReplayActive] = useState(false);
  const [cachedBars, setCachedBars] = useState<CandlestickBar[]>([]);

  const handleToggleReplay = () => {
    if (isReplayActive) {
      replayEngine.exitReplay();
      setIsReplayActive(false);
    } else {
      replayEngine.startSelecting();
      // Default to 50 bars ago for instant test replay
      if (cachedBars.length > 50) {
        const cutoff = cachedBars[cachedBars.length - 30].time;
        replayEngine.setCutoffTime(cutoff);
      }
      setIsReplayActive(true);
    }
  };

  return (
    <main className="h-screen w-screen flex flex-col bg-background select-none">
      {/* Workstation Top Navigation Bar */}
      <header className="h-12 bg-surface border-b border-border px-4 flex items-center justify-between z-30">
        {/* Brand & Market Selector */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-tr from-accent to-blue-400 flex items-center justify-center font-black text-xs text-white shadow-md shadow-accent/20">
              M
            </div>
            <span className="font-black text-sm tracking-wider bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent font-sans">
              MOCHEX
            </span>
            <span className="text-[10px] text-muted font-mono uppercase px-1.5 py-0.5 bg-surface-card rounded border border-border">
              MEXC SPOT
            </span>
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Timeframe Selectors */}
          <div className="flex items-center gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setResolution(tf.value)}
                className={`px-2 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  resolution === tf.value
                    ? "bg-accent text-white"
                    : "text-muted hover:text-foreground hover:bg-surface-card"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Feature Actions */}
        <div className="flex items-center gap-2">
          {/* Bar Replay Trigger */}
          <button
            onClick={handleToggleReplay}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono border transition-all ${
              isReplayActive
                ? "bg-accent/20 text-accent border-accent"
                : "bg-surface-card hover:bg-surface-hover text-muted hover:text-foreground border-border"
            }`}
          >
            <RotateCcw size={13} className={isReplayActive ? "animate-spin" : ""} />
            <span>{isReplayActive ? "Replay Active" : "Bar Replay"}</span>
          </button>

          {/* Indicator Script Lab Modal */}
          <button
            onClick={() => setIsIndicatorModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-card hover:bg-surface-hover text-muted hover:text-foreground border border-border transition-colors"
          >
            <Code2 size={13} className="text-accent" />
            <span>Indicators</span>
          </button>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Watchlist Toggle */}
          <button
            onClick={() => setIsWatchlistOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              isWatchlistOpen
                ? "bg-surface-hover text-foreground border-border"
                : "bg-surface-card text-muted hover:text-foreground border-border"
            }`}
          >
            <ListFilter size={13} />
            <span>Watchlist</span>
          </button>
        </div>
      </header>

      {/* Main Chart Workspace Area */}
      <div className="flex-1 relative overflow-hidden flex">
        {/* TradingView Chart Container */}
        <div className="flex-1 h-full relative">
          <TradingViewContainer
            symbol={symbol}
            resolution={resolution}
            onBarsLoaded={setCachedBars}
          />

          {/* Floating Replay Controls */}
          {isReplayActive && (
            <ReplayToolbar onClose={() => setIsReplayActive(false)} />
          )}
        </div>

        {/* Watchlist Drawer */}
        <WatchlistDrawer
          isOpen={isWatchlistOpen}
          onClose={() => setIsWatchlistOpen(false)}
          selectedSymbol={symbol}
          onSelectSymbol={setSymbol}
        />
      </div>

      {/* Script Editor Modal */}
      <IndicatorEditorModal
        isOpen={isIndicatorModalOpen}
        onClose={() => setIsIndicatorModalOpen(false)}
        sampleBars={cachedBars}
        onApplyIndicator={(name) => {
          console.log(`Applied indicator: ${name}`);
        }}
      />
    </main>
  );
}
