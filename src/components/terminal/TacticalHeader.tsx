"use client";

import React, { useState } from "react";
import {
  CandlestickChart,
  ChevronDown,
  RotateCcw,
  Maximize2,
  Minimize2,
  PanelRight,
  Code2,
  Check,
  User,
  Shield,
  Sparkles,
} from "lucide-react";
import { AuthUser } from "@/lib/auth/use-auth";
import { LayoutDropdown, SavedLayoutItem } from "./LayoutDropdown";

interface TacticalHeaderProps {
  symbol: string;
  onSelectSymbol: (symbol: string) => void;
  resolution: string;
  onSelectResolution: (res: string) => void;
  markPrice?: number;
  change24h?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
  isReplayActive: boolean;
  onToggleReplay: () => void;
  onOpenIndicators: () => void;
  activeIndicatorsCount: number;
  activeIndicators?: string[];
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isStudioOpen: boolean;
  onToggleStudio: () => void;
  user?: AuthUser | null;
  onOpenAuthModal?: () => void;
  onLoadLayout?: (layout: SavedLayoutItem) => void;
}

const TIMEFRAMES = [
  { label: "1m", value: "1" },
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "1H", value: "60" },
  { label: "4H", value: "240" },
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
];

const POPULAR_PAIRS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "MXUSDT", "XRPUSDT", "DOGEUSDT"];

export function TacticalHeader({
  symbol,
  onSelectSymbol,
  resolution,
  onSelectResolution,
  markPrice = 68420.5,
  change24h = 3.42,
  high24h = 69120.0,
  low24h = 67200.0,
  volume24h = 42819.5,
  isReplayActive,
  onToggleReplay,
  onOpenIndicators,
  activeIndicatorsCount,
  activeIndicators = [],
  isSidebarOpen,
  onToggleSidebar,
  isStudioOpen,
  onToggleStudio,
  user = null,
  onOpenAuthModal,
  onLoadLayout = () => {},
}: TacticalHeaderProps) {
  const [isSymbolDropdownOpen, setIsSymbolDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const formattedSymbol = symbol.replace("USDT", "/USDT");
  const isPositive = change24h >= 0;

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  return (
    <header className="h-12 bg-surface border-b border-border px-3 flex items-center justify-between select-none z-30 shrink-0">
      {/* Left: Brand + Symbol + Live Tape Metrics */}
      <div className="flex items-center gap-3">
        {/* Brand Icon + Name */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary-container flex items-center justify-center text-white shadow-sm shadow-primary-container/30">
            <CandlestickChart size={16} />
          </div>
          <span className="font-sans font-black text-sm tracking-wide text-on-surface">
            MOCHEX
          </span>
          <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-surface-container-high text-primary border border-outline-variant/40">
            PRO TERMINAL
          </span>
        </div>

        <div className="h-4 w-px bg-border mx-1" />

        {/* Pair Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsSymbolDropdownOpen(!isSymbolDropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 text-on-surface text-xs font-mono font-semibold transition-colors"
          >
            <span>{formattedSymbol}</span>
            <ChevronDown size={13} className="text-muted" />
          </button>

          {isSymbolDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-44 bg-surface-container-low border border-border rounded shadow-xl py-1 z-50">
              <div className="px-2 py-1 text-[10px] font-mono text-muted uppercase">
                MEXC Spot Markets
              </div>
              {POPULAR_PAIRS.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    onSelectSymbol(p);
                    setIsSymbolDropdownOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 text-xs font-mono flex items-center justify-between hover:bg-surface-container transition-colors ${
                    p === symbol ? "text-primary-container font-bold" : "text-on-surface"
                  }`}
                >
                  <span>{p.replace("USDT", "/USDT")}</span>
                  {p === symbol && <Check size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Live Mark Price & 24h PnL Pill */}
        <div className="flex items-center gap-2 font-mono">
          <span className="text-sm font-bold text-on-surface">
            ${markPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
          </span>
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
              isPositive
                ? "bg-secondary/15 text-secondary border border-secondary/30"
                : "bg-tertiary/15 text-tertiary border border-tertiary/30"
            }`}
          >
            {isPositive ? "+" : ""}
            {change24h.toFixed(2)}%
          </span>
        </div>

        {/* High / Low / Vol Tape (Visible on medium+ screens) */}
        <div className="hidden xl:flex items-center gap-3 text-[11px] font-mono text-muted pl-2 border-l border-border">
          <div>
            <span className="text-[9px] uppercase tracking-wider text-outline mr-1">24h H</span>
            <span className="text-on-surface">${high24h.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-wider text-outline mr-1">24h L</span>
            <span className="text-on-surface">${low24h.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-wider text-outline mr-1">24h Vol</span>
            <span className="text-on-surface">{volume24h.toLocaleString()} USDT</span>
          </div>
        </div>
      </div>

      {/* Middle: Resolution Ribbon + Indicators Trigger + Bar Replay */}
      <div className="hidden md:flex items-center gap-2">
        {/* Resolution Buttons */}
        <div className="flex items-center bg-surface-container-lowest p-0.5 rounded border border-border">
          {TIMEFRAMES.map((tf) => {
            const isActive = resolution === tf.value;
            return (
              <button
                key={tf.value}
                onClick={() => onSelectResolution(tf.value)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                  isActive
                    ? "bg-primary-container text-white font-bold shadow-xs"
                    : "text-muted hover:text-on-surface hover:bg-surface-container-high"
                }`}
              >
                {tf.label}
              </button>
            );
          })}
        </div>

        {/* Indicators fx Trigger */}
        <button
          onClick={onOpenIndicators}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 text-on-surface text-xs font-mono transition-colors"
        >
          <span className="text-primary font-bold italic">fx</span>
          <span>Indicators</span>
          {activeIndicatorsCount > 0 && (
            <span className="px-1 py-0.2 rounded-full bg-primary-container text-white text-[9px] font-bold">
              {activeIndicatorsCount}
            </span>
          )}
        </button>

        {/* Bar Replay Trigger */}
        <button
          onClick={onToggleReplay}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium border transition-colors ${
            isReplayActive
              ? "bg-gold/15 text-gold border-gold/40 shadow-xs"
              : "bg-surface-container-low hover:bg-surface-container border-outline-variant/30 text-muted hover:text-on-surface"
          }`}
        >
          <RotateCcw size={12} className={isReplayActive ? "animate-spin" : ""} />
          <span>{isReplayActive ? "Replaying 1x" : "Replay"}</span>
        </button>
      </div>

      {/* Right: Studio Toggle + Layout Manager Dropdown + User Profile */}
      <div className="flex items-center gap-1.5">
        {/* Script Studio Dock Toggle */}
        <button
          onClick={onToggleStudio}
          title="Toggle Indicator Script Studio"
          className={`p-1.5 rounded border transition-colors ${
            isStudioOpen
              ? "bg-primary-container/20 text-primary border-primary/40"
              : "bg-surface-container-low hover:bg-surface-container text-muted hover:text-on-surface border-outline-variant/30"
          }`}
        >
          <Code2 size={15} />
        </button>

        {/* Multi-Layout Manager Dropdown */}
        <div className="hidden sm:block">
          <LayoutDropdown
            currentSymbol={symbol}
            currentResolution={resolution}
            currentIndicators={activeIndicators}
            user={user}
            onLoadLayout={onLoadLayout}
            onOpenAuthModal={onOpenAuthModal || (() => {})}
          />
        </div>

        {/* Fullscreen Toggle */}
        <button
          onClick={handleToggleFullscreen}
          title="Toggle Fullscreen"
          className="p-1.5 rounded bg-surface-container-low hover:bg-surface-container text-muted hover:text-on-surface border border-outline-variant/30 transition-colors"
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>

        {/* Right Sidebar Toggle */}
        <button
          onClick={onToggleSidebar}
          title="Toggle Watchlist & Depth"
          className={`p-1.5 rounded border transition-colors ${
            isSidebarOpen
              ? "bg-surface-container-high text-on-surface border-border"
              : "bg-surface-container-low text-muted hover:text-on-surface border-outline-variant/30"
          }`}
        >
          <PanelRight size={15} />
        </button>

        <div className="h-4 w-px bg-border mx-0.5" />

        {/* User Profile / Auth Pill Button */}
        <button
          onClick={onOpenAuthModal}
          className="flex items-center gap-1.5 p-1 rounded hover:bg-surface-container transition-colors pl-1 cursor-pointer"
          title={user ? `${user.username} (${user.role})` : "Guest Mode - Click to Sign In"}
        >
          <div className="relative">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-container to-blue-700 flex items-center justify-center text-[10px] font-bold text-white shadow-xs">
              {user ? user.username.slice(0, 2).toUpperCase() : "YM"}
            </div>
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-surface ${
                user ? "bg-secondary" : "bg-cyan"
              }`}
            />
          </div>

          <div className="hidden lg:flex flex-col text-left">
            <span className="text-[11px] font-mono font-bold leading-none text-on-surface">
              {user ? user.username : "Guest"}
            </span>
            <span className="text-[9px] font-mono text-muted leading-tight">
              {user ? user.role : "Sign In"}
            </span>
          </div>
        </button>
      </div>
    </header>
  );
}
