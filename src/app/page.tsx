"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { TacticalHeader } from "@/components/terminal/TacticalHeader";
import { DrawingRail, DrawingToolType } from "@/components/terminal/DrawingRail";
import { RightSidebar } from "@/components/terminal/RightSidebar";
import { ScriptStudio } from "@/components/terminal/ScriptStudio";
import { IndicatorsModal } from "@/components/terminal/IndicatorsModal";
import { ReplaySimulationPill } from "@/components/terminal/ReplaySimulationPill";
import { TradingViewContainer } from "@/components/chart/TradingViewContainer";
import { MobileTacticalDrawer } from "@/components/mobile/MobileTacticalDrawer";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { AuthModal } from "@/components/auth/AuthModal";
import { replayEngine } from "@/lib/replay/replay-engine";
import { CandlestickBar } from "@/lib/mexc/types";
import { BacktestPerformance, BacktestTrade } from "@/lib/strategy/types";
import { indicatorSandbox } from "@/lib/indicators/sandbox";
import { STRATEGY_PRESETS } from "@/lib/strategy/presets";
import { useAuth } from "@/lib/auth/use-auth";
import { SavedLayoutItem } from "@/components/terminal/LayoutDropdown";
import {
  createInitialMultiChartState,
  getVisiblePanes,
  getActivePane,
  setGridLayoutMode,
  updateActivePaneSymbol,
  updateActivePaneResolution,
  toggleGridSyncOption,
  toggleMaximizePane,
  GridLayoutMode,
  GridSyncConfig,
  MultiChartWorkspaceState,
} from "@/lib/chart/multi-chart-grid";

function formatResolutionBadge(res: string): string {
  if (res === "1D" || res === "1W") return res;
  const mins = Number(res);
  if (mins >= 60) return `${mins / 60}H`;
  return `${res}m`;
}

export default function WorkstationPage() {
  // Authentication session
  const { user, login, register, logout } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Multi-Chart Split-Screen Workspace State
  const [gridState, setGridState] = useState<MultiChartWorkspaceState>(() =>
    createInitialMultiChartState("BTCUSDT", "15")
  );

  // Workspace state with localStorage persistence
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [resolution, setResolution] = useState("15");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [isIndicatorsModalOpen, setIsIndicatorsModalOpen] = useState(false);
  const [isReplayActive, setIsReplayActive] = useState(false);
  const [strategyResult, setStrategyResult] = useState<BacktestPerformance | null>(null);
  const [activeStrategyName, setActiveStrategyName] = useState<string>(STRATEGY_PRESETS[0].name);
  const [focusedTrade, setFocusedTrade] = useState<BacktestTrade | null>(null);

  // Active tools & indicators
  const [activeDrawingTool, setActiveDrawingTool] = useState<DrawingToolType>("crosshair");
  const [isMagnetActive, setIsMagnetActive] = useState(true);
  const [isDrawingsLocked, setIsDrawingsLocked] = useState(false);
  const [isDrawingsHidden, setIsDrawingsHidden] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState<string[]>([
    "EMA Ribbon Momentum Multi-Timeframe",
  ]);
  const [favoriteTools, setFavoriteTools] = useState<DrawingToolType[]>([
    "trendline",
    "horizontal_line",
    "rectangle",
    "fibonacci",
  ]);
  const [showFavoritesBar, setShowFavoritesBar] = useState(true);

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

  const handlePriceUpdate = useCallback(
    (stats: { price: number; change: number; high: number; low: number; volume: number }) => {
      setMarketStats(stats);
    },
    []
  );

  const handleBarsLoaded = useCallback((bars: CandlestickBar[]) => {
    setCachedBars(bars);
  }, []);

  // Auto-run default strategy backtest when "Strategy Equity Curve & Underwater Drawdown" is toggled on
  useEffect(() => {
    const hasStrategyOverlay = activeIndicators.includes(
      "Strategy Equity Curve & Underwater Drawdown"
    );
    if (hasStrategyOverlay && cachedBars.length > 0 && !strategyResult) {
      indicatorSandbox
        .execute({
          scriptId: "auto-strategy-overlay",
          code: STRATEGY_PRESETS[0].code,
          bars: cachedBars,
          inputs: { period: 20, initialCapital: 10000, feeRate: 0.0005 },
        })
        .then((res) => {
          if (res.success && res.strategyResult) {
            setStrategyResult(res.strategyResult);
          }
        })
        .catch(() => {});
    }
  }, [activeIndicators, cachedBars, strategyResult]);

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
      const savedIndicators = localStorage.getItem("mochex:active_indicators");
      const savedFavs = localStorage.getItem("mochex:favorite_drawing_tools");
      const savedShowFavs = localStorage.getItem("mochex:show_favorites_bar");
      const savedGrid = localStorage.getItem("mochex:multi_chart_grid");

      if (savedGrid) {
        const parsedGrid = JSON.parse(savedGrid) as MultiChartWorkspaceState;
        if (parsedGrid && Array.isArray(parsedGrid.panes) && parsedGrid.panes.length === 4) {
          setGridState(parsedGrid);
          const activePane = getActivePane(parsedGrid);
          setSymbol(activePane.symbol);
          setResolution(activePane.resolution);
        }
      } else {
        const initSym = savedSymbol || "BTCUSDT";
        const initRes = savedRes || "15";
        setSymbol(initSym);
        setResolution(initRes);
        setGridState(createInitialMultiChartState(initSym, initRes));
      }

      if (savedSidebar !== null) setIsSidebarOpen(savedSidebar === "true");
      if (savedStudio !== null) setIsStudioOpen(savedStudio === "true");
      if (savedIndicators) setActiveIndicators(JSON.parse(savedIndicators));
      if (savedFavs) setFavoriteTools(JSON.parse(savedFavs));
      if (savedShowFavs !== null) setShowFavoritesBar(savedShowFavs === "true");
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Persist gridState changes to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("mochex:multi_chart_grid", JSON.stringify(gridState));
    } catch {}
  }, [gridState]);

  // Alt+Enter shortcut to Maximize / Restore active split pane
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "Enter") {
        e.preventDefault();
        setGridState((prev) => {
          if (prev.layoutMode === "1x1") return prev;
          return toggleMaximizePane(prev, prev.activePaneId);
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleOpenSidebarEvent = () => {
      setIsSidebarOpen(true);
      try {
        localStorage.setItem("mochex:sidebar_open", "true");
      } catch {}
    };
    window.addEventListener("mochex:open-object-tree", handleOpenSidebarEvent);
    window.addEventListener("mochex:execute-paper-order", handleOpenSidebarEvent);
    window.addEventListener("mochex:open-paper-trade", handleOpenSidebarEvent);
    return () => {
      window.removeEventListener("mochex:open-object-tree", handleOpenSidebarEvent);
      window.removeEventListener("mochex:execute-paper-order", handleOpenSidebarEvent);
      window.removeEventListener("mochex:open-paper-trade", handleOpenSidebarEvent);
    };
  }, []);

  // Save changes to localStorage and update active pane (or all panes if sync enabled)
  const handleSelectSymbol = (sym: string) => {
    setSymbol(sym);
    setGridState((prev) => updateActivePaneSymbol(prev, sym));
    try {
      localStorage.setItem("mochex:symbol", sym);
    } catch {}
  };

  const handleSelectResolution = (res: string) => {
    setResolution(res);
    setGridState((prev) => updateActivePaneResolution(prev, res));
    try {
      localStorage.setItem("mochex:resolution", res);
    } catch {}
  };

  const handleSelectGridLayout = (mode: GridLayoutMode) => {
    setGridState((prev) => {
      const next = setGridLayoutMode(prev, mode);
      const active = getActivePane(next);
      setSymbol(active.symbol);
      setResolution(active.resolution);
      return next;
    });
  };

  const handleToggleGridSync = (key: keyof GridSyncConfig) => {
    setGridState((prev) => toggleGridSyncOption(prev, key));
  };

  const handleFocusPane = (paneId: string) => {
    setGridState((prev) => {
      if (prev.activePaneId === paneId) return prev;
      const target = prev.panes.find((p) => p.id === paneId);
      if (target) {
        setSymbol(target.symbol);
        setResolution(target.resolution);
      }
      return {
        ...prev,
        activePaneId: paneId,
      };
    });
  };

  const handleToggleMaximizePane = (paneId: string) => {
    setGridState((prev) => toggleMaximizePane(prev, paneId));
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
      setIsReplayActive(true);
    }
  };

  const handleApplyIndicator = (name: string) => {
    setActiveIndicators((prev) => {
      const next = prev.includes(name) ? prev.filter((i) => i !== name) : [...prev, name];
      try {
        localStorage.setItem("mochex:active_indicators", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleClearDrawings = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mochex:clear-drawings"));
    }
  };

  const handleClearIndicators = () => {
    setActiveIndicators([]);
    try {
      localStorage.setItem("mochex:active_indicators", JSON.stringify([]));
    } catch {}
  };

  const handleClearAll = () => {
    handleClearDrawings();
    handleClearIndicators();
  };

  const handleToggleFavoriteTool = (tool: DrawingToolType) => {
    setFavoriteTools((prev) => {
      const exists = prev.includes(tool);
      const next = exists ? prev.filter((t) => t !== tool) : [...prev, tool];
      try {
        localStorage.setItem("mochex:favorite_drawing_tools", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleToggleFavoritesBar = () => {
    setShowFavoritesBar((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("mochex:show_favorites_bar", String(next));
      } catch {}
      return next;
    });
  };

  const handleLoadLayout = (layout: SavedLayoutItem) => {
    if (layout.symbol) handleSelectSymbol(layout.symbol);
    if (layout.resolution) handleSelectResolution(layout.resolution);
    if (layout.content?.indicators && Array.isArray(layout.content.indicators)) {
      setActiveIndicators(layout.content.indicators);
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

  const visiblePanes = getVisiblePanes(gridState);
  const isSplitGrid = gridState.layoutMode !== "1x1";
  const effectiveGridClass =
    gridState.maximizedPaneId || gridState.layoutMode === "1x1"
      ? "grid-cols-1 grid-rows-1"
      : gridState.layoutMode === "2x1"
        ? "grid-cols-1 md:grid-cols-2 grid-rows-1"
        : gridState.layoutMode === "1x2"
          ? "grid-cols-1 grid-rows-2"
          : "grid-cols-1 md:grid-cols-2 grid-rows-2";

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
        activeIndicators={activeIndicators}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={handleToggleSidebar}
        isStudioOpen={isStudioOpen}
        onToggleStudio={handleToggleStudio}
        user={user}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLoadLayout={handleLoadLayout}
        gridLayoutMode={gridState.layoutMode}
        onSelectGridLayout={handleSelectGridLayout}
        gridSync={gridState.sync}
        onToggleGridSync={handleToggleGridSync}
      />

      {/* 2. Main Terminal Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Drawing Rail (Desktop) */}
        <div className="hidden md:flex shrink-0">
          <DrawingRail
            activeTool={activeDrawingTool}
            onSelectTool={setActiveDrawingTool}
            isMagnetActive={isMagnetActive}
            onToggleMagnet={() => setIsMagnetActive((prev) => !prev)}
            isLocked={isDrawingsLocked}
            onToggleLock={() => setIsDrawingsLocked((prev) => !prev)}
            isHidden={isDrawingsHidden}
            onToggleHide={() => setIsDrawingsHidden((prev) => !prev)}
            onClearDrawings={handleClearDrawings}
            onClearIndicators={handleClearIndicators}
            onClearAll={handleClearAll}
            favoriteTools={favoriteTools}
            onToggleFavorite={handleToggleFavoriteTool}
            showFavoritesBar={showFavoritesBar}
            onToggleFavoritesBar={handleToggleFavoritesBar}
          />
        </div>

        {/* Center Workspace (Multi-Chart Split-Screen Grid + Replay Simulation Pill) */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <div className={`flex-1 relative w-full h-full grid gap-[2px] bg-border/60 ${effectiveGridClass}`}>
            {visiblePanes.map((pane, idx) => {
              const isPaneActive = pane.id === gridState.activePaneId;
              const isPaneMaximized = gridState.maximizedPaneId === pane.id;
              return (
                <div
                  key={pane.id}
                  onMouseDown={() => handleFocusPane(pane.id)}
                  className={`relative w-full h-full overflow-hidden bg-background transition-shadow ${
                    isSplitGrid
                      ? isPaneActive
                        ? "ring-1 ring-inset ring-[#2962ff]"
                        : "opacity-95 hover:opacity-100"
                      : ""
                  }`}
                >
                  {/* Per-Pane Header Badge & Maximize/Restore Control (Visible on Split Grids) */}
                  {isSplitGrid && (
                    <div
                      className={`absolute top-2 right-16 z-30 flex items-center gap-1.5 px-2 py-0.5 rounded border backdrop-blur-md text-[10px] font-mono shadow-md transition-colors ${
                        isPaneActive
                          ? "bg-[#161a25]/95 border-[#2962ff]/70 text-white"
                          : "bg-[#12161f]/85 border-outline-variant/40 text-muted hover:text-on-surface"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isPaneActive ? "bg-[#2962ff] shadow-[0_0_6px_#2962ff]" : "bg-muted/50"
                        }`}
                      />
                      <span className="font-bold tracking-tight">
                        {pane.symbol.replace(/USDT$/, "")}/USDT
                      </span>
                      <span className="text-primary font-semibold">
                        {formatResolutionBadge(pane.resolution)}
                      </span>
                      {gridState.sync.syncCrosshair && (
                        <span
                          className="text-[8px] px-1 rounded bg-cyan/15 text-cyan uppercase"
                          title="Crosshair Sync Active"
                        >
                          SYNC
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleMaximizePane(pane.id);
                        }}
                        title={
                          isPaneMaximized
                            ? "Restore Split Grid (Alt+Enter)"
                            : `Maximize Pane #${idx + 1} (Alt+Enter)`
                        }
                        className="ml-0.5 p-0.5 rounded hover:bg-surface-container-high text-muted hover:text-white transition-colors cursor-pointer"
                      >
                        {isPaneMaximized ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                      </button>
                    </div>
                  )}

                  <TradingViewContainer
                    paneId={pane.id}
                    symbol={pane.symbol}
                    resolution={pane.resolution}
                    syncCrosshair={
                      gridState.sync.syncCrosshair &&
                      isSplitGrid &&
                      !gridState.maximizedPaneId
                    }
                    activeDrawingTool={isPaneActive ? activeDrawingTool : "crosshair"}
                    onSelectDrawingTool={setActiveDrawingTool}
                    isMagnetActive={isMagnetActive}
                    isDrawingsLocked={isDrawingsLocked}
                    isDrawingsHidden={isDrawingsHidden}
                    activeIndicators={activeIndicators}
                    onToggleIndicator={handleApplyIndicator}
                    trades={isPaneActive ? strategyResult?.trades || [] : []}
                    strategyResult={isPaneActive ? strategyResult : null}
                    strategyName={activeStrategyName}
                    focusedTrade={isPaneActive ? focusedTrade : null}
                    onClearStrategy={() => {
                      setStrategyResult(null);
                      setFocusedTrade(null);
                      setActiveIndicators((prev) =>
                        prev.filter((i) => i !== "Strategy Equity Curve & Underwater Drawdown")
                      );
                    }}
                    onBarsLoaded={isPaneActive ? handleBarsLoaded : undefined}
                    onPriceUpdate={isPaneActive ? handlePriceUpdate : undefined}
                    favoriteTools={favoriteTools}
                    onToggleFavorite={handleToggleFavoriteTool}
                    showFavoritesBar={showFavoritesBar && isPaneActive}
                    onToggleFavoritesBar={handleToggleFavoritesBar}
                  />
                </div>
              );
            })}

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
            onStrategyResult={(res, name) => {
              setStrategyResult(res);
              if (name) setActiveStrategyName(name);
            }}
            onSelectTrade={(trade) => setFocusedTrade(trade)}
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
            user={user}
            activeIndicators={activeIndicators}
            onToggleIndicator={handleApplyIndicator}
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

      {/* 5. Cloud Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        user={user}
        onLogin={login}
        onRegister={register}
        onLogout={logout}
      />
    </main>
  );
}
