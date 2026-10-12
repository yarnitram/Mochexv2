"use client";

import React, { useState, useEffect } from "react";
import { TacticalHeader } from "@/components/terminal/TacticalHeader";
import { DrawingRail, DrawingToolType } from "@/components/terminal/DrawingRail";
import { RightSidebar } from "@/components/terminal/RightSidebar";
import { ScriptStudio } from "@/components/terminal/ScriptStudio";
import { IndicatorsModal } from "@/components/terminal/IndicatorsModal";
import { ReplaySimulationPill } from "@/components/terminal/ReplaySimulationPill";
import { TradingViewContainer } from "@/components/chart/TradingViewContainer";
import { MobileTacticalDrawer } from "@/components/mobile/MobileTacticalDrawer";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { replayEngine } from "@/lib/replay/replay-engine";
import { CandlestickBar } from "@/lib/mexc/types";
import { BacktestPerformance } from "@/lib/strategy/types";

export default function WorkstationPage() {
  // Workspace state with localStorage persistence
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [resolution, setResolution] = useState("15");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [isIndicatorsModalOpen, setIsIndicatorsModalOpen] = useState(false);
  const [isReplayActive, setIsReplayActive] = useState(false);
  const [strategyResult, setStrategyResult] = useState<BacktestPerformance | null>(null);

  // Active tools & indicators
  const [activeDrawingTool, setActiveDrawingTool] = useState<DrawingToolType>("crosshair");
  const [activeIndicators, setActiveIndicators] = useState<string[]>([
    "EMA Ribbon Momentum Multi-Timeframe",
  ]);

  // Market metrics tape
  const [marketStats, setMarketStats] = useState({
    price: 68420.5,
    change: 3.42,
    high: 69120.0,
    low: 67200.0,
    volume: 42819.5,
  });

  // Cached bars for replay and indicator sandbox
  const [cachedBars, setCachedBars] = useState<CandlestickBar[]>([]);

  // Mobile navigation state
  const [mobileScreen, setMobileScreen] = useState<"chart" | "watchlist" | "depth" | "draw" | "studio">("chart");
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedSymbol = localStorage.getItem("mochex:symbol");
      const savedRes = localStorage.getItem("mochex:resolution");
      const savedSidebar = localStorage.getItem("mochex:sidebar_open");
      const savedStudio = localStorage.getItem("mochex:studio_open");

      if (savedSymbol) setSymbol(savedSymbol);
      if (savedRes) setResolution(savedRes);
      if (savedSidebar !== null) setIsSidebarOpen(savedSidebar === "true");
      if (savedStudio !== null) setIsStudioOpen(savedStudio === "true");
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Save changes to localStorage
  const handleSelectSymbol = (sym: string) => {
    setSymbol(sym);
    try {
      localStorage.setItem("mochex:symbol", sym);
    } catch {}
  };

  const handleSelectResolution = (res: string) => {
    setResolution(res);
    try {
      localStorage.setItem("mochex:resolution", res);
    } catch {}
  };

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("mochex:sidebar_open", String(next));
      } catch {}
      return next;
    });
  };

  const handleToggleStudio = () => {
    setIsStudioOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("mochex:studio_open", String(next));
      } catch {}
      return next;
    });
  };

  const handleToggleReplay = () => {
    if (isReplayActive) {
      replayEngine.exitReplay();
      setIsReplayActive(false);
    } else {
      replayEngine.startSelecting();
      if (cachedBars.length > 50) {
        const cutoff = cachedBars[cachedBars.length - 30].time;
        replayEngine.setCutoffTime(cutoff);
      }
      setIsReplayActive(true);
    }
  };

  const handleApplyIndicator = (name: string) => {
    setActiveIndicators((prev) =>
      prev.includes(name) ? prev.filter((i) => i !== name) : [...prev, name]
    );
  };

  const handleClearDrawings = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mochex:clear-drawings"));
    }
  };

  // Handle Mobile Bottom Nav Clicks
  const handleSelectMobileScreen = (screen: "chart" | "watchlist" | "depth" | "draw" | "studio") => {
    setMobileScreen(screen);
    if (screen === "watchlist" || screen === "draw") {
      setIsMobileDrawerOpen(true);
    } else if (screen === "studio") {
      setIsStudioOpen(true);
      setIsMobileDrawerOpen(false);
    } else {
      setIsMobileDrawerOpen(false);
    }
  };

  return (
    <main className="h-screen w-screen flex flex-col bg-background select-none overflow-hidden font-sans">
      {/* 1. Desktop Tactical Header */}
      <TacticalHeader
        symbol={symbol}
        onSelectSymbol={handleSelectSymbol}
        resolution={resolution}
        onSelectResolution={handleSelectResolution}
        markPrice={marketStats.price}
        change24h={marketStats.change}
        high24h={marketStats.high}
        low24h={marketStats.low}
        volume24h={marketStats.volume}
        isReplayActive={isReplayActive}
        onToggleReplay={handleToggleReplay}
        onOpenIndicators={() => setIsIndicatorsModalOpen(true)}
        activeIndicatorsCount={activeIndicators.length}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={handleToggleSidebar}
        isStudioOpen={isStudioOpen}
        onToggleStudio={handleToggleStudio}
      />

      {/* 2. Main Terminal Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Drawing Rail (Desktop) */}
        <div className="hidden md:flex shrink-0">
          <DrawingRail
            activeTool={activeDrawingTool}
            onSelectTool={setActiveDrawingTool}
            onClearAll={handleClearDrawings}
          />
        </div>

        {/* Center Workspace (Chart Canvas + Replay Simulation Pill) */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <div className="flex-1 relative w-full h-full">
            <TradingViewContainer
              symbol={symbol}
              resolution={resolution}
              activeDrawingTool={activeDrawingTool}
              activeIndicators={activeIndicators}
              trades={strategyResult?.trades || []}
              onBarsLoaded={setCachedBars}
              onPriceUpdate={(stats) => setMarketStats(stats)}
            />

            {/* In-chart Floating Simulation Control Pill */}
            {isReplayActive && (
              <ReplaySimulationPill onClose={() => setIsReplayActive(false)} />
            )}
          </div>

          {/* Bottom Script Studio (Collapsible Split Panel) */}
          <ScriptStudio
            isOpen={isStudioOpen}
            onClose={() => setIsStudioOpen(false)}
            sampleBars={cachedBars}
            onStrategyResult={setStrategyResult}
            onApplyIndicator={(name) => {
              handleApplyIndicator(name);
              setIsStudioOpen(false);
            }}
          />
        </div>

        {/* Right High-Density Sidebar (Desktop) */}
        <div className="hidden md:flex shrink-0">
          <RightSidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            selectedSymbol={symbol}
            onSelectSymbol={handleSelectSymbol}
            currentPrice={marketStats.price}
          />
        </div>
      </div>

      {/* 3. Indicators & Strategies Catalog Modal (fx Trigger) */}
      <IndicatorsModal
        isOpen={isIndicatorsModalOpen}
        onClose={() => setIsIndicatorsModalOpen(false)}
        onApplyIndicator={handleApplyIndicator}
        activeIndicators={activeIndicators}
        onEditInStudio={() => {
          setIsStudioOpen(true);
        }}
      />

      {/* 4. Mobile Adaptations (< 768px viewports) */}
      <MobileTacticalDrawer
        isOpen={isMobileDrawerOpen}
        onToggle={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
        selectedSymbol={symbol}
        onSelectSymbol={handleSelectSymbol}
        activeDrawingTool={activeDrawingTool}
        onSelectDrawingTool={setActiveDrawingTool}
        onClearDrawings={handleClearDrawings}
      />

      <MobileBottomNav
        activeScreen={mobileScreen}
        onSelectScreen={handleSelectMobileScreen}
      />
    </main>
  );
}
