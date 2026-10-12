"use client";

import React, { useEffect, useState } from "react";
import { mexcWsManager } from "@/lib/mexc/websocket";
import { MexcMiniTickerItem } from "@/lib/mexc/types";
import { Search, TrendingUp, TrendingDown, Star, X } from "lucide-react";

interface WatchlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}

const DEFAULT_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "SUIUSDT",
  "PEPEUSDT",
  "NEARUSDT",
];

export function WatchlistDrawer({
  isOpen,
  onClose,
  selectedSymbol,
  onSelectSymbol,
}: WatchlistDrawerProps) {
  const [tickers, setTickers] = useState<Map<string, MexcMiniTickerItem>>(new Map());
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    mexcWsManager.connect();
    const handleTickers = (items: MexcMiniTickerItem[]) => {
      setTickers((prev) => {
        const next = new Map(prev);
        items.forEach((item) => {
          next.set(item.s, item);
        });
        return next;
      });
    };

    mexcWsManager.subscribeMiniTickers(handleTickers);
    return () => {
      mexcWsManager.unsubscribeMiniTickers(handleTickers);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const displaySymbols = DEFAULT_SYMBOLS.filter((s) =>
    s.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="absolute right-0 top-12 bottom-0 w-80 bg-surface/95 backdrop-blur-md border-l border-border z-30 flex flex-col shadow-2xl">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star size={16} className="text-accent" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Watchlist (24h Live)
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-surface-hover rounded text-muted hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-2 border-b border-border">
        <div className="flex items-center gap-2 bg-surface-card px-2.5 py-1.5 rounded-lg border border-border">
          <Search size={14} className="text-muted" />
          <input
            type="text"
            placeholder="Search MEXC Spot..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-xs text-foreground placeholder:text-muted outline-none w-full"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border/40">
        {displaySymbols.map((symbol) => {
          const ticker = tickers.get(symbol);
          const price = ticker ? parseFloat(ticker.p).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "--";
          const changePercent = ticker ? parseFloat(ticker.r) * 100 : 0;
          const isBull = changePercent >= 0;
          const isSelected = selectedSymbol === symbol;

          return (
            <div
              key={symbol}
              onClick={() => {
                onSelectSymbol(symbol);
              }}
              className={`flex items-center justify-between p-3 cursor-pointer hover:bg-surface-hover transition-colors ${
                isSelected ? "bg-surface-card border-l-2 border-accent" : ""
              }`}
            >
              <div>
                <div className="text-xs font-bold font-mono text-foreground flex items-center gap-1.5">
                  {symbol}
                </div>
                <div className="text-[10px] text-muted font-mono">
                  Vol: {ticker ? (parseFloat(ticker.v) / 1000).toFixed(1) + "K" : "--"}
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-mono font-medium text-foreground">${price}</div>
                <div
                  className={`text-[10px] font-mono flex items-center justify-end gap-0.5 ${
                    isBull ? "text-bull" : "text-bear"
                  }`}
                >
                  {isBull ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  <span>{ticker ? `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%` : "0.00%"}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
