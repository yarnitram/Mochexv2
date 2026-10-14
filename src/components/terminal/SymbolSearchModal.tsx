"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  X,
  RotateCw,
  TrendingUp,
  TrendingDown,
  Layers,
  Flame,
  Cpu,
  Coins,
  Sparkles,
  Check,
} from "lucide-react";
import {
  MexcMarketSymbol,
  SymbolCategory,
  getCachedSymbolCatalog,
  fetchMexcSymbolCatalog,
  filterAndSearchSymbols,
  formatSymbolVolume,
} from "@/lib/mexc/symbol-catalog";

interface SymbolSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  onAddToWatchlist?: (symbol: string) => void;
}

const CATEGORIES: Array<{ id: SymbolCategory; label: string; icon: React.ReactNode }> = [
  { id: "ALL", label: "All Markets", icon: <Layers size={12} /> },
  { id: "TOP_FUTURES", label: "Top Volume", icon: <Flame size={12} className="text-amber-400" /> },
  { id: "LAYER1", label: "Layer 1", icon: <Sparkles size={12} className="text-blue-400" /> },
  { id: "DEFI", label: "DeFi", icon: <Coins size={12} className="text-emerald-400" /> },
  { id: "MEME", label: "Meme", icon: <Flame size={12} className="text-pink-400" /> },
  { id: "AI", label: "AI & Big Data", icon: <Cpu size={12} className="text-purple-400" /> },
];

export function SymbolSearchModal({
  isOpen,
  onClose,
  selectedSymbol,
  onSelectSymbol,
  onAddToWatchlist,
}: SymbolSearchModalProps) {
  const [catalog, setCatalog] = useState<MexcMarketSymbol[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SymbolCategory>("ALL");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Initialize catalog from cache and background sync
  useEffect(() => {
    if (!isOpen) return;
    const initial = getCachedSymbolCatalog();
    setCatalog(initial);

    // Background sync on modal open if needed
    fetchMexcSymbolCatalog(false).then((fresh) => {
      if (fresh && fresh.length > 0) {
        setCatalog(fresh);
      }
    });

    // Auto focus search input
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
  }, [isOpen]);

  // Handle manual 1-click refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const fresh = await fetchMexcSymbolCatalog(true);
      if (fresh && fresh.length > 0) {
        setCatalog(fresh);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filtered symbols
  const filteredSymbols = useMemo(() => {
    return filterAndSearchSymbols(query, category, catalog);
  }, [query, category, catalog]);

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, category]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, Math.min(filteredSymbols.length - 1, 99)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = filteredSymbols[selectedIndex];
        if (target) {
          onSelectSymbol(target.symbol);
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredSymbols, selectedIndex, onSelectSymbol, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs select-none p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[82vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="px-5 py-3.5 border-b border-border bg-surface flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Search size={16} className="text-primary" />
            <h3 className="font-sans font-bold text-sm text-on-surface flex items-center gap-2">
              <span>Symbol Search</span>
              <span className="text-[11px] font-mono font-normal text-muted bg-surface-container px-2 py-0.5 rounded-full border border-border">
                {catalog.length > 0 ? `${catalog.length.toLocaleString()} MEXC Pairs` : "Loading..."}
              </span>
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded bg-surface-container-low hover:bg-surface-container text-muted hover:text-on-surface border border-border transition-colors cursor-pointer"
              title="Scrape and refresh all 1,480+ MEXC USDT pairs"
            >
              <RotateCw size={12} className={isRefreshing ? "animate-spin text-primary" : ""} />
              <span>{isRefreshing ? "Syncing..." : "Resync Pairs"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 rounded text-muted hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Search Bar Input */}
        <div className="p-3 border-b border-border bg-surface-container-low shrink-0">
          <div className="relative flex items-center">
            <Search size={15} className="absolute left-3.5 text-muted pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search MEXC symbol, coin name, or token (e.g. SUI, BTC, PEPE, SOL)..."
              className="w-full bg-surface text-on-surface placeholder-muted text-xs font-mono pl-10 pr-9 py-2.5 rounded-lg border border-border focus:outline-hidden focus:border-primary transition-colors"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 text-muted hover:text-on-surface p-0.5 rounded cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Category Chips Bar */}
          <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto no-scrollbar py-0.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono transition-colors shrink-0 cursor-pointer ${
                  category === cat.id
                    ? "bg-primary text-on-primary font-bold shadow-xs"
                    : "bg-surface text-muted hover:text-on-surface hover:bg-surface-container border border-border"
                }`}
              >
                {cat.icon}
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto divide-y divide-border/40 min-h-[300px]">
          {filteredSymbols.length === 0 ? (
            <div className="p-12 text-center text-muted font-mono text-xs flex flex-col items-center justify-center gap-2">
              <Search size={28} className="text-muted/40 stroke-1" />
              <p>No MEXC symbols match &apos;{query}&apos;</p>
              <button
                onClick={() => {
                  setQuery("");
                  setCategory("ALL");
                }}
                className="text-primary hover:underline text-[11px] mt-1 cursor-pointer"
              >
                Reset search & filters
              </button>
            </div>
          ) : (
            filteredSymbols.slice(0, 100).map((item, idx) => {
              const isSelected = selectedSymbol === item.symbol;
              const isHighlighted = selectedIndex === idx;
              const isPositive = item.change24h >= 0;

              return (
                <div
                  key={item.symbol}
                  onClick={() => {
                    onSelectSymbol(item.symbol);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                    isHighlighted
                      ? "bg-surface-container"
                      : isSelected
                      ? "bg-surface-container-low"
                      : "hover:bg-surface-container-low/70"
                  }`}
                >
                  {/* Left: Symbol & Name */}
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-on-surface">
                          {item.symbol.replace("USDT", "/USDT")}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-container text-muted border border-border">
                          {item.baseAsset}
                        </span>
                        {item.category !== "ALL" && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-primary/10 text-primary uppercase">
                            {item.category.replace("_", " ")}
                          </span>
                        )}
                        {isSelected && (
                          <span className="flex items-center text-[10px] text-emerald-400 font-mono gap-0.5">
                            <Check size={11} /> Active
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted truncate max-w-[240px] sm:max-w-xs">
                        {item.fullName}
                      </span>
                    </div>
                  </div>

                  {/* Right: Price, 24h Change, Volume */}
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end font-mono">
                      <span className="text-xs font-semibold text-on-surface">
                        ${item.price < 0.01 ? item.price.toFixed(6) : item.price < 1 ? item.price.toFixed(4) : item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-muted">
                        Vol {formatSymbolVolume(item.quoteVolume)}
                      </span>
                    </div>

                    <div
                      className={`flex items-center gap-0.5 px-2 py-0.8 rounded text-[11px] font-mono font-medium ${
                        isPositive
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      <span>{isPositive ? `+${item.change24h}%` : `${item.change24h}%`}</span>
                    </div>

                    {onAddToWatchlist && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToWatchlist(item.symbol);
                        }}
                        className="text-[10px] font-mono px-2 py-1 rounded bg-surface-container hover:bg-surface text-muted hover:text-on-surface border border-border transition-colors hidden sm:block"
                        title="Add to Watchlist"
                      >
                        + List
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="px-4 py-2 border-t border-border bg-surface flex items-center justify-between text-[10px] font-mono text-muted shrink-0">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 bg-surface-container rounded border border-border">↑</kbd> <kbd className="px-1.5 py-0.5 bg-surface-container rounded border border-border">↓</kbd> Navigate</span>
            <span><kbd className="px-1.5 py-0.5 bg-surface-container rounded border border-border">Enter</kbd> Select</span>
            <span><kbd className="px-1.5 py-0.5 bg-surface-container rounded border border-border">Esc</kbd> Close</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>MEXC Spot & Futures Feed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
