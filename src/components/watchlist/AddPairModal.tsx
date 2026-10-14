"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, Plus, Check, X, Sparkles, RotateCw } from "lucide-react";
import {
  MexcMarketSymbol,
  getCachedSymbolCatalog,
  fetchMexcSymbolCatalog,
  formatSymbolVolume,
} from "@/lib/mexc/symbol-catalog";

interface AddPairModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingSymbols: string[];
  onAddSymbol: (symbol: string) => void;
}

export function AddPairModal({
  isOpen,
  onClose,
  existingSymbols,
  onAddSymbol,
}: AddPairModalProps) {
  const [search, setSearch] = useState("");
  const [catalog, setCatalog] = useState<MexcMarketSymbol[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCatalog(getCachedSymbolCatalog());
    fetchMexcSymbolCatalog(false).then((data) => {
      if (data && data.length > 0) setCatalog(data);
    });
  }, [isOpen]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const fresh = await fetchMexcSymbolCatalog(true);
      if (fresh && fresh.length > 0) setCatalog(fresh);
    } finally {
      setIsRefreshing(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return catalog.slice(0, 80);
    return catalog
      .filter(
        (p) =>
          p.symbol.includes(q) ||
          p.baseAsset.toUpperCase().includes(q) ||
          p.fullName.toUpperCase().includes(q)
      )
      .slice(0, 80);
  }, [search, catalog]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs select-none p-4">
      <div className="bg-surface-container-lowest border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border bg-surface flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <h3 className="font-sans font-bold text-sm text-on-surface">
              Add Market Pair to Watchlist
            </h3>
            <span className="text-[10px] font-mono text-muted bg-surface-container px-1.5 py-0.5 rounded border border-border">
              {catalog.length} Pairs
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1 rounded text-muted hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              title="Resync MEXC market catalog"
            >
              <RotateCw size={13} className={isRefreshing ? "animate-spin text-primary" : ""} />
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-muted hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-border bg-surface-container-low">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search 1,480+ MEXC pairs (e.g. SUI, PEPE, BTC)..."
              className="w-full bg-surface text-on-surface placeholder-muted text-xs font-mono pl-9 pr-3 py-2 rounded border border-border focus:outline-hidden focus:border-primary-container"
            />
          </div>
        </div>

        {/* Pairs List */}
        <div className="max-h-72 overflow-y-auto no-scrollbar divide-y divide-border/30">
          {filtered.map((item) => {
            const isAlreadyAdded = existingSymbols.includes(item.symbol);
            const isPositive = item.change24h >= 0;

            return (
              <div
                key={item.symbol}
                className="px-4 py-2.5 flex items-center justify-between hover:bg-surface-container transition-colors"
              >
                <div>
                  <div className="font-mono text-xs font-bold text-on-surface flex items-center gap-1.5">
                    <span>{item.symbol.replace("USDT", "")}</span>
                    <span className="text-[10px] font-normal text-muted">/USDT</span>
                    <span className="text-[10px] font-sans font-normal text-muted pl-1 truncate max-w-[140px]">
                      &bull; {item.fullName}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-muted">
                    Vol {formatSymbolVolume(item.quoteVolume)}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right font-mono">
                    <div className="text-xs font-semibold text-on-surface">
                      ${item.price < 0.01 ? item.price.toFixed(6) : item.price < 1 ? item.price.toFixed(4) : item.price.toFixed(2)}
                    </div>
                    <span
                      className={`text-[10px] font-semibold ${
                        isPositive ? "text-secondary" : "text-tertiary"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {item.change24h.toFixed(2)}%
                    </span>
                  </div>

                  <button
                    disabled={isAlreadyAdded}
                    onClick={() => {
                      onAddSymbol(item.symbol);
                    }}
                    className={`p-1.5 rounded text-xs font-mono transition-colors cursor-pointer ${
                      isAlreadyAdded
                        ? "bg-surface-container text-muted cursor-not-allowed"
                        : "bg-primary-container hover:bg-accent-hover text-white shadow-xs"
                    }`}
                  >
                    {isAlreadyAdded ? <Check size={14} /> : <Plus size={14} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
