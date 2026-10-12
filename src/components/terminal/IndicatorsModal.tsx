"use client";

import React, { useState } from "react";
import {
  Search,
  X,
  Star,
  Users,
  Code2,
  Plus,
  Check,
  TrendingUp,
  Activity,
  BarChart2,
  Layers,
  Sparkles,
} from "lucide-react";

interface IndicatorCatalogItem {
  id: string;
  name: string;
  author: string;
  category: "community" | "custom" | "builtins" | "volume";
  type: "Overlay" | "Sub-pane";
  rating: number;
  usersCount: string;
  description: string;
  isVerified: boolean;
  code?: string;
}

const CATALOG_ITEMS: IndicatorCatalogItem[] = [
  {
    id: "ema-ribbon",
    name: "EMA Ribbon Momentum Multi-Timeframe",
    author: "Mochex Core",
    category: "builtins",
    type: "Overlay",
    rating: 4.9,
    usersCount: "28.4K",
    description: "Multi-layered Exponential Moving Average ribbon (20, 50, 100, 200) highlighting trend dynamic compression and expansion zones.",
    isVerified: true,
  },
  {
    id: "rsi-divergence",
    name: "RSI Divergence Engine Pro",
    author: "Ymatt",
    category: "community",
    type: "Sub-pane",
    rating: 4.8,
    usersCount: "14.2K",
    description: "Detects regular and hidden bullish/bearish divergences automatically with dynamic overbought (70) and oversold (30) bands.",
    isVerified: true,
  },
  {
    id: "macd-zerolag",
    name: "Zero-Lag MACD Histogram",
    author: "QuantLab",
    category: "community",
    type: "Sub-pane",
    rating: 4.7,
    usersCount: "9.8K",
    description: "Eliminates standard moving average delay via exponential smoothing error feedback for fast reversal signals.",
    isVerified: true,
  },
  {
    id: "volume-profile-session",
    name: "Volume Profile & Dynamic Point of Control (POC)",
    author: "Mochex Core",
    category: "volume",
    type: "Overlay",
    rating: 4.9,
    usersCount: "35.1K",
    description: "High-density horizontal volume distribution rendering Value Area High (VAH), Value Area Low (VAL), and POC liquidity nodes.",
    isVerified: true,
  },
  {
    id: "bollinger-squeeze",
    name: "Bollinger Bands Squeeze Breakout",
    author: "JohnCarter_TA",
    category: "builtins",
    type: "Overlay",
    rating: 4.6,
    usersCount: "8.1K",
    description: "Detects pre-breakout volatility contraction by comparing Bollinger Bands bandwidth with Keltner Channels.",
    isVerified: false,
  },
  {
    id: "my-custom-momentum",
    name: "My Custom EMA Momentum Ribbon",
    author: "You (Admin)",
    category: "custom",
    type: "Overlay",
    rating: 5.0,
    usersCount: "1",
    description: "Locally edited Pine/JS indicator compiled via isolated HTML5 Web Worker sandbox.",
    isVerified: true,
  },
];

interface IndicatorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyIndicator: (name: string) => void;
  onEditInStudio?: (indicator: IndicatorCatalogItem) => void;
  activeIndicators?: string[];
}

export function IndicatorsModal({
  isOpen,
  onClose,
  onApplyIndicator,
  onEditInStudio,
  activeIndicators = [],
}: IndicatorsModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  const categories = [
    { id: "all", label: "All Indicators", count: CATALOG_ITEMS.length, icon: <Layers size={14} /> },
    { id: "community", label: "Global Community", count: 2, icon: <Sparkles size={14} /> },
    { id: "builtins", label: "Built-in Overlays", count: 2, icon: <TrendingUp size={14} /> },
    { id: "volume", label: "Volume Profiles", count: 1, icon: <BarChart2 size={14} /> },
    { id: "custom", label: "My Custom Scripts", count: 1, icon: <Code2 size={14} /> },
  ];

  const filteredItems = CATALOG_ITEMS.filter((item) => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchesType =
      filterType === "all" ||
      (filterType === "overlay" && item.type === "Overlay") ||
      (filterType === "subpane" && item.type === "Sub-pane");
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesType && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs select-none p-4">
      <div className="bg-surface-container-lowest border border-border rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-border bg-surface flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-sans font-bold text-on-surface flex items-center gap-2">
              <span className="text-primary font-mono italic">fx</span>
              <span>Indicators & Strategies Catalog</span>
            </h2>
            <p className="text-xs text-muted font-sans mt-0.5">
              Technical Analysis, Quant Overlays & Community Scripts
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded text-muted hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Sub-Filter Bar */}
        <div className="px-5 py-3 border-b border-border bg-surface-container-low flex flex-col sm:flex-row items-center gap-3 shrink-0">
          <div className="relative flex-1 w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search indicators, strategies, or authors..."
              className="w-full bg-surface text-on-surface placeholder-muted text-xs font-mono pl-9 pr-3 py-2 rounded border border-outline-variant/30 focus:outline-hidden focus:border-primary-container transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {["all", "overlay", "subpane"].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded text-xs font-mono capitalize transition-colors ${
                  filterType === type
                    ? "bg-primary-container text-white font-medium"
                    : "bg-surface text-muted hover:text-on-surface border border-outline-variant/30"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* 2-Column Catalog Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Category Sidebar */}
          <div className="w-56 border-r border-border bg-surface-container-lowest p-3 space-y-1 overflow-y-auto no-scrollbar shrink-0">
            <div className="text-[10px] font-mono text-muted uppercase tracking-wider px-2 py-1">
              Libraries
            </div>
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded text-xs font-mono transition-colors ${
                    isActive
                      ? "bg-surface-container-high text-primary font-bold border-l-2 border-primary-container"
                      : "text-muted hover:text-on-surface hover:bg-surface-container"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {cat.icon}
                    <span>{cat.label}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-container text-muted">
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right: Cards Grid */}
          <div className="flex-1 p-4 overflow-y-auto no-scrollbar grid grid-cols-1 md:grid-cols-2 gap-3 bg-surface-container-lowest">
            {filteredItems.map((item) => {
              const isApplied = activeIndicators.includes(item.name);
              return (
                <div
                  key={item.id}
                  className="bg-surface border border-border hover:border-outline-variant/50 rounded-lg p-3.5 flex flex-col justify-between transition-all hover:shadow-lg"
                >
                  <div>
                    {/* Header: Title + Type badge */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-sans font-semibold text-xs text-on-surface leading-snug">
                        {item.name}
                      </h3>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container text-muted border border-border shrink-0">
                        {item.type}
                      </span>
                    </div>

                    {/* Author & Stats */}
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] font-mono text-muted">
                      <span>by {item.author}</span>
                      <div className="flex items-center gap-0.5 text-gold">
                        <Star size={11} fill="currentColor" />
                        <span>{item.rating}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Users size={11} />
                        <span>{item.usersCount}</span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-muted font-sans mt-2 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-border">
                    {onEditInStudio && (
                      <button
                        onClick={() => {
                          onEditInStudio(item);
                          onClose();
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container text-muted hover:text-on-surface border border-outline-variant/30 text-xs font-mono transition-colors"
                      >
                        <Code2 size={12} />
                        <span>Edit Studio</span>
                      </button>
                    )}

                    <button
                      onClick={() => onApplyIndicator(item.name)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors ${
                        isApplied
                          ? "bg-secondary/20 text-secondary border border-secondary/40"
                          : "bg-primary-container hover:bg-accent-hover text-white shadow-xs"
                      }`}
                    >
                      {isApplied ? (
                        <>
                          <Check size={13} />
                          <span>Active on Chart</span>
                        </>
                      ) : (
                        <>
                          <Plus size={13} />
                          <span>Add to Chart</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
