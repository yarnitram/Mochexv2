"use client";

import React, { useState } from "react";
import { Search, Plus, Check, X, Sparkles } from "lucide-react";

interface AddPairModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingSymbols: string[];
  onAddSymbol: (symbol: string) => void;
}

const AVAILABLE_MEXC_PAIRS = [
  { symbol: "BTCUSDT", name: "Bitcoin", price: 68420.5, change: 3.42, volume: "42.8K" },
  { symbol: "ETHUSDT", name: "Ethereum", price: 3485.2, change: -1.15, volume: "182K" },
  { symbol: "SOLUSDT", name: "Solana", price: 178.65, change: 7.82, volume: "924K" },
  { symbol: "MXUSDT", name: "MEXC Token", price: 3.84, change: 0.52, volume: "48.9K" },
  { symbol: "SUIUSDT", name: "Sui Network", price: 1.94, change: 12.4, volume: "890K" },
  { symbol: "DOGEUSDT", name: "Dogecoin", price: 0.128, change: 4.12, volume: "3.8M" },
  { symbol: "XRPUSDT", name: "Ripple", price: 0.542, change: -0.45, volume: "1.4M" },
  { symbol: "BNBUSDT", name: "BNB", price: 588.4, change: 1.25, volume: "34.2K" },
  { symbol: "ADAUSDT", name: "Cardano", price: 0.354, change: 2.15, volume: "620K" },
  { symbol: "AVAXUSDT", name: "Avalanche", price: 28.45, change: 5.12, volume: "210K" },
  { symbol: "NEARUSDT", name: "NEAR Protocol", price: 4.88, change: 8.64, volume: "450K" },
  { symbol: "LINKUSDT", name: "Chainlink", price: 11.24, change: -0.85, volume: "190K" },
  { symbol: "DOTUSDT", name: "Polkadot", price: 4.15, change: 1.12, volume: "310K" },
  { symbol: "PEPEUSDT", name: "Pepe", price: 0.0000095, change: 15.8, volume: "12.4M" },
  { symbol: "SHIBUSDT", name: "Shiba Inu", price: 0.0000185, change: 3.25, volume: "8.2M" },
];

export function AddPairModal({
  isOpen,
  onClose,
  existingSymbols,
  onAddSymbol,
}: AddPairModalProps) {
  const [search, setSearch] = useState("");

  if (!isOpen) return null;

  const filtered = AVAILABLE_MEXC_PAIRS.filter(
    (p) =>
      p.symbol.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase())
  );

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
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-muted hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <X size={16} />
          </button>
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
              placeholder="Search MEXC Spot symbol (e.g. SUI, PEPE, BTC)..."
              className="w-full bg-surface text-on-surface placeholder-muted text-xs font-mono pl-9 pr-3 py-2 rounded border border-border focus:outline-hidden focus:border-primary-container"
            />
          </div>
        </div>

        {/* Pairs List */}
        <div className="max-h-72 overflow-y-auto no-scrollbar divide-y divide-border/30">
          {filtered.map((item) => {
            const isAlreadyAdded = existingSymbols.includes(item.symbol);
            const isPositive = item.change >= 0;

            return (
              <div
                key={item.symbol}
                className="px-4 py-2.5 flex items-center justify-between hover:bg-surface-container transition-colors"
              >
                <div>
                  <div className="font-mono text-xs font-bold text-on-surface flex items-center gap-1.5">
                    <span>{item.symbol.replace("USDT", "")}</span>
                    <span className="text-[10px] font-normal text-muted">/USDT</span>
                    <span className="text-[10px] font-sans font-normal text-muted pl-1">
                      &bull; {item.name}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-muted">Vol {item.volume}</div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right font-mono">
                    <div className="text-xs font-semibold text-on-surface">
                      ${item.price >= 1 ? item.price.toFixed(2) : item.price.toFixed(6)}
                    </div>
                    <span
                      className={`text-[10px] font-semibold ${
                        isPositive ? "text-secondary" : "text-tertiary"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {item.change.toFixed(2)}%
                    </span>
                  </div>

                  <button
                    disabled={isAlreadyAdded}
                    onClick={() => {
                      onAddSymbol(item.symbol);
                    }}
                    className={`p-1.5 rounded text-xs font-mono transition-colors ${
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
