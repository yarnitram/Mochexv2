"use client";

import React, { useState, useEffect } from "react";
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
  LayoutTemplate,
  Trash2,
  Save,
} from "lucide-react";
import {
  IndicatorTemplate,
  getStoredTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  toggleStarTemplate,
} from "@/lib/indicators/templates";

interface IndicatorCatalogItem {
  id: string;
  name: string;
  author: string;
  category: "community" | "custom" | "builtins" | "volume" | "strategies";
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
    id: "strategy-equity-underwater",
    name: "Strategy Equity Curve & Underwater Drawdown",
    author: "Mochex Quant",
    category: "strategies",
    type: "Sub-pane",
    rating: 5.0,
    usersCount: "41.8K",
    description: "Synchronized main-chart sub-pane rendering cumulative Strategy Equity vs. Buy & Hold Benchmark, Underwater Drawdown %, and Entry-to-Exit trade execution connectors.",
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
  onApplyTemplate?: (indicators: string[]) => void;
  onEditInStudio?: (indicator: IndicatorCatalogItem) => void;
  activeIndicators?: string[];
  initialTab?: "catalog" | "templates";
}

export function IndicatorsModal({
  isOpen,
  onClose,
  onApplyIndicator,
  onApplyTemplate,
  onEditInStudio,
  activeIndicators = [],
  initialTab = "catalog",
}: IndicatorsModalProps) {
  const [mainTab, setMainTab] = useState<"catalog" | "templates">("catalog");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Templates state
  const [templates, setTemplates] = useState<IndicatorTemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDesc, setNewTemplateDesc] = useState("");
  const [templateFeedback, setTemplateFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTemplates(getStoredTemplates());
      setMainTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const handleSaveCurrentTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = saveCustomTemplate(newTemplateName, newTemplateDesc, activeIndicators);
      setTemplates(getStoredTemplates());
      setNewTemplateName("");
      setNewTemplateDesc("");
      setTemplateFeedback(`Template '${created.name}' saved successfully!`);
      setTimeout(() => setTemplateFeedback(null), 3000);
    } catch (err: any) {
      setTemplateFeedback(err?.message || "Failed to save template");
      setTimeout(() => setTemplateFeedback(null), 3000);
    }
  };

  const handleDeleteTemplate = (id: string) => {
    const updated = deleteCustomTemplate(id);
    setTemplates(updated);
  };

  const handleToggleStar = (id: string) => {
    const updated = toggleStarTemplate(id);
    setTemplates(updated);
  };

  const handleApplyTemplateStack = (indicators: string[]) => {
    if (onApplyTemplate) {
      onApplyTemplate(indicators);
    } else {
      window.dispatchEvent(
        new CustomEvent("mochex:apply-indicator-template", {
          detail: { indicators },
        })
      );
    }
    onClose();
  };

  if (!isOpen) return null;

  const categories = [
    { id: "all", label: "All Indicators", count: CATALOG_ITEMS.length, icon: <Layers size={14} /> },
    { id: "strategies", label: "Quant Strategies", count: 1, icon: <Activity size={14} /> },
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

  const filteredTemplates = templates
    .filter((t) => {
      const q = searchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.indicators.some((ind) => ind.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      // Starred first
      if (a.isStarred && !b.isStarred) return -1;
      if (!a.isStarred && b.isStarred) return 1;
      return 0;
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs select-none p-4">
      <div className="bg-surface-container-lowest border border-border rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-3 border-b border-border bg-surface flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-sm font-sans font-bold text-on-surface flex items-center gap-2">
                <span className="text-primary font-mono italic">fx</span>
                <span>Indicators & Templates</span>
              </h2>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center gap-1 bg-surface-container-low p-0.5 rounded border border-border">
              <button
                onClick={() => setMainTab("catalog")}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
                  mainTab === "catalog"
                    ? "bg-primary-container text-white shadow-xs font-bold"
                    : "text-muted hover:text-on-surface"
                }`}
              >
                Catalog ({CATALOG_ITEMS.length})
              </button>
              <button
                onClick={() => setMainTab("templates")}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  mainTab === "templates"
                    ? "bg-primary-container text-white shadow-xs font-bold"
                    : "text-muted hover:text-on-surface"
                }`}
              >
                <LayoutTemplate size={13} />
                <span>Templates ({templates.length})</span>
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded text-muted hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Sub-Filter Bar (for Catalog) or Search Bar (for Templates) */}
        <div className="px-5 py-3 border-b border-border bg-surface-container-low flex flex-col sm:flex-row items-center gap-3 shrink-0">
          <div className="relative flex-1 w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                mainTab === "catalog"
                  ? "Search indicators, strategies, or authors..."
                  : "Search templates or indicator stacks..."
              }
              className="w-full bg-surface text-on-surface placeholder-muted text-xs font-mono pl-9 pr-3 py-2 rounded border border-outline-variant/30 focus:outline-hidden focus:border-primary-container transition-colors"
            />
          </div>

          {mainTab === "catalog" && (
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
          )}
        </div>

        {/* Modal Body */}
        {mainTab === "catalog" ? (
          /* 2-Column Catalog Body */
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
        ) : (
          /* Template Manager Body */
          <div className="flex-1 p-5 overflow-y-auto no-scrollbar bg-surface-container-lowest">
            {/* Save Current Stack Form */}
            <div className="bg-surface-container-low border border-border rounded-lg p-4 mb-5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Save size={15} className="text-primary" />
                  <span className="text-xs font-mono font-bold text-on-surface uppercase tracking-wide">
                    Save Active Chart Indicators as Template
                  </span>
                </div>
                <span className="text-[10px] font-mono text-muted">
                  {activeIndicators.length} active indicator{activeIndicators.length === 1 ? "" : "s"}
                </span>
              </div>

              {activeIndicators.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {activeIndicators.map((name) => (
                    <span
                      key={name}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface text-primary border border-primary/30"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted mb-3 font-sans">
                  No indicators are active on your chart. Add indicators from the Catalog tab to assemble and save a custom stack.
                </p>
              )}

              <form onSubmit={handleSaveCurrentTemplate} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Template name (e.g. My Scalp Setup)..."
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  required
                  className="flex-1 bg-surface text-on-surface placeholder-muted text-xs font-mono px-3 py-2 rounded border border-outline-variant/30 focus:outline-hidden focus:border-primary-container"
                />
                <input
                  type="text"
                  placeholder="Description (optional)..."
                  value={newTemplateDesc}
                  onChange={(e) => setNewTemplateDesc(e.target.value)}
                  className="flex-1 bg-surface text-on-surface placeholder-muted text-xs font-mono px-3 py-2 rounded border border-outline-variant/30 focus:outline-hidden focus:border-primary-container"
                />
                <button
                  type="submit"
                  disabled={activeIndicators.length === 0}
                  className={`px-4 py-2 rounded text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    activeIndicators.length === 0
                      ? "bg-surface text-muted border border-border cursor-not-allowed opacity-50"
                      : "bg-primary-container hover:bg-primary text-white shadow-xs"
                  }`}
                >
                  <Save size={13} />
                  <span>Save Stack</span>
                </button>
              </form>

              {templateFeedback && (
                <div className="mt-2 text-xs font-mono text-secondary">
                  {templateFeedback}
                </div>
              )}
            </div>

            {/* Templates Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredTemplates.map((tpl) => {
                const isAllApplied =
                  tpl.indicators.length > 0 &&
                  tpl.indicators.every((ind) => activeIndicators.includes(ind));
                return (
                  <div
                    key={tpl.id}
                    className="bg-surface border border-border hover:border-outline-variant/50 rounded-lg p-4 flex flex-col justify-between transition-all hover:shadow-lg"
                  >
                    <div>
                      {/* Header: Star + Title + Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleStar(tpl.id)}
                            className="p-1 rounded hover:bg-surface-container text-gold transition-colors cursor-pointer"
                            title={tpl.isStarred ? "Remove from favorites" : "Add to favorites"}
                          >
                            <Star
                              size={14}
                              className={tpl.isStarred ? "fill-gold text-gold" : "text-muted hover:text-gold"}
                            />
                          </button>
                          <h3 className="font-sans font-semibold text-xs text-on-surface leading-snug">
                            {tpl.name}
                          </h3>
                        </div>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${
                            tpl.isBuiltin
                              ? "bg-primary-container/20 text-primary border-primary/40 font-bold"
                              : "bg-surface-container text-cyan border-border"
                          }`}
                        >
                          {tpl.isBuiltin ? "Institutional Stack" : "Custom"}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-muted font-sans mt-2 leading-relaxed">
                        {tpl.description}
                      </p>

                      {/* Indicators List Badges */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {tpl.indicators.map((ind) => (
                          <span
                            key={ind}
                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-container-low text-on-surface border border-border"
                          >
                            {ind}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border">
                      {!tpl.isBuiltin && (
                        <button
                          onClick={() => handleDeleteTemplate(tpl.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono text-tertiary hover:bg-tertiary/10 transition-colors cursor-pointer"
                          title="Delete custom template"
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleApplyTemplateStack(tpl.indicators)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
                          isAllApplied
                            ? "bg-secondary/20 text-secondary border border-secondary/40 font-bold"
                            : "bg-primary-container hover:bg-primary text-white shadow-xs font-bold"
                        }`}
                      >
                        {isAllApplied ? (
                          <>
                            <Check size={13} />
                            <span>Stack Active</span>
                          </>
                        ) : (
                          <>
                            <LayoutTemplate size={13} />
                            <span>Apply Stack</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
