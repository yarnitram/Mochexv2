"use client";

import React, { useState, useEffect } from "react";
import { Search, Plus, Bell, Flame, Star, ChevronRight, X } from "lucide-react";
import { mexcWsManager } from "@/lib/mexc/websocket";
import { MexcMiniTickerItem } from "@/lib/mexc/types";
import { OrderDepthLadder } from "./OrderDepthLadder";

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  currentPrice?: number;
}

interface TickerRow {
  symbol: string;
  price: number;
  change: number;
  high: number;
  low: number;
  volume: number;
}

const DEFAULT_WATCHLIST: TickerRow[] = [
  { symbol: "BTCUSDT", price: 68420.5, change: 3.42, high: 69120.0, low: 67200.0, volume: 42819.5 },
  { symbol: "ETHUSDT", price: 3485.2, change: -1.15, high: 3560.0, low: 3410.0, volume: 182400.0 },
  { symbol: "SOLUSDT", price: 178.65, change: 7.82, high: 182.0, low: 165.2, volume: 924500.0 },
  { symbol: "MXUSDT", price: 3.84, change: 0.52, high: 3.92, low: 3.79, volume: 48920.0 },
  { symbol: "XRPUSDT", price: 0.542, change: -0.45, high: 0.555, low: 0.538, volume: 1420000.0 },
  { symbol: "DOGEUSDT", price: 0.128, change: 4.12, high: 0.134, low: 0.122, volume: 3840000.0 },
  { symbol: "BNBUSDT", price: 588.4, change: 1.25, high: 595.0, low: 580.0, volume: 34200.0 },
  { symbol: "SUIUSDT", price: 1.94, change: 12.4, high: 2.05, low: 1.72, volume: 890000.0 },
];

export function RightSidebar({
  isOpen,
  onClose,
  selectedSymbol,
  onSelectSymbol,
  currentPrice = 68420.5,
}: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<"watchlist" | "alerts" | "hot">("watchlist");
  const [searchQuery, setSearchQuery] = useState("");
  const [tickers, setTickers] = useState<Record<string, TickerRow>>(() => {
    const map: Record<string, TickerRow> = {};
    DEFAULT_WATCHLIST.forEach((t) => {
      map[t.symbol] = t;
    });
    return map;
  });

  useEffect(() => {
    mexcWsManager.connect();
    const handleTickers = (items: MexcMiniTickerItem[]) => {
      setTickers((prev) => {
        const next = { ...prev };
        for (const item of items) {
          if (next[item.s]) {
            next[item.s] = {
              ...next[item.s],
              price: parseFloat(item.p) || next[item.s].price,
              change: parseFloat(item.r) * 100 || next[item.s].change,
              high: parseFloat(item.h) || next[item.s].high,
              low: parseFloat(item.l) || next[item.s].low,
              volume: parseFloat(item.v) || next[item.s].volume,
            };
          }
        }
        return next;
      });
    };

    mexcWsManager.subscribeMiniTickers(handleTickers);
    return () => {
      mexcWsManager.unsubscribeMiniTickers(handleTickers);
    };
  }, []);

  if (!isOpen) return null;

  const tickerList = Object.values(tickers).filter((t) =>
    t.symbol.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <aside className="w-80 bg-surface-container-lowest border-l border-border flex flex-col h-full select-none shrink-0 z-20">
      {/* Sidebar Header & Tabs */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-2 py-1.5">
        <div className="flex items-center gap-1 bg-surface-container-low p-0.5 rounded border border-border">
          <button
            onClick={() => setActiveTab("watchlist")}
            className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors flex items-center gap-1 ${
              activeTab === "watchlist"
                ? "bg-primary-container text-white shadow-xs"
                : "text-muted hover:text-on-surface"
            }`}
          >
            <Star size={12} />
            <span>Watchlist</span>
          </button>
          <button
            onClick={() => setActiveTab("alerts")}
            className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors flex items-center gap-1 ${
              activeTab === "alerts"
                ? "bg-primary-container text-white shadow-xs"
                : "text-muted hover:text-on-surface"
            }`}
          >
            <Bell size={12} />
            <span>Alerts</span>
          </button>
          <button
            onClick={() => setActiveTab("hot")}
            className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors flex items-center gap-1 ${
              activeTab === "hot"
                ? "bg-primary-container text-white shadow-xs"
                : "text-muted hover:text-on-surface"
            }`}
          >
            <Flame size={12} />
            <span>Hot 24h</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded text-muted hover:text-on-surface hover:bg-surface-container transition-colors md:hidden"
        >
          <X size={16} />
        </button>
      </div>

      {/* Search Input + Add Pair */}
      <div className="p-2 border-b border-border bg-surface-container-lowest flex items-center gap-2">
        <div className="flex-1 relative flex items-center">
          <Search size={13} className="absolute left-2.5 text-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pair..."
            className="w-full bg-surface-container-low text-on-surface placeholder-muted text-xs font-mono pl-7 pr-2 py-1.5 rounded border border-outline-variant/30 focus:outline-hidden focus:border-primary-container transition-colors"
          />
        </div>
        <button
          title="Add Custom Pair"
          className="p-1.5 rounded bg-surface-container-low hover:bg-surface-container text-muted hover:text-primary border border-outline-variant/30 transition-colors shrink-0"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Ticker Table Header */}
      <div className="grid grid-cols-12 px-3 py-1.5 text-[10px] font-mono text-muted uppercase tracking-wider border-b border-border bg-surface-container-lowest">
        <span className="col-span-5 text-left">Symbol / Vol</span>
        <span className="col-span-4 text-right">Last Price</span>
        <span className="col-span-3 text-right">24h Chg</span>
      </div>

      {/* High-Density Ticker Rows */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {tickerList.map((t) => {
          const isSelected = t.symbol === selectedSymbol;
          const isPositive = t.change >= 0;
          return (
            <div
              key={t.symbol}
              onClick={() => onSelectSymbol(t.symbol)}
              className={`grid grid-cols-12 items-center px-3 py-2 cursor-pointer transition-colors border-b border-border/40 ${
                isSelected
                  ? "bg-surface-container-high border-l-2 border-l-primary-container"
                  : "hover:bg-surface-container-low"
              }`}
            >
              {/* Symbol & Volume */}
              <div className="col-span-5 flex flex-col">
                <span className="text-xs font-mono font-bold text-on-surface">
                  {t.symbol.replace("USDT", "")}
                  <span className="text-[10px] font-normal text-muted">/USDT</span>
                </span>
                <span className="text-[9px] font-mono text-muted">
                  Vol {t.volume >= 1000 ? `${(t.volume / 1000).toFixed(1)}K` : t.volume.toFixed(0)}
                </span>
              </div>

              {/* Price */}
              <div className="col-span-4 text-right font-mono text-xs font-semibold text-on-surface">
                {t.price >= 1 ? t.price.toFixed(2) : t.price.toFixed(4)}
              </div>

              {/* Change Pill */}
              <div className="col-span-3 flex justify-end">
                <span
                  className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded text-right ${
                    isPositive
                      ? "bg-secondary/15 text-secondary border border-secondary/30"
                      : "bg-tertiary/15 text-tertiary border border-tertiary/30"
                  }`}
                >
                  {isPositive ? "+" : ""}
                  {t.change.toFixed(2)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mini Order Depth Ladder Component */}
      <OrderDepthLadder symbol={selectedSymbol} currentPrice={currentPrice} />
    </aside>
  );
}
