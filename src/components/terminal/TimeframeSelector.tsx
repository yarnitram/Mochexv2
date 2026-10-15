"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Star, Check, Plus, AlertCircle } from "lucide-react";
import {
  ALL_TIMEFRAMES,
  TIMEFRAME_CATEGORIES,
  DEFAULT_FAVORITE_TIMEFRAMES,
  TimeframeItem,
  TimeframeUnit,
  getStoredFavoriteTimeframes,
  saveStoredFavoriteTimeframes,
  validateCustomTimeframe,
  findTimeframe,
} from "@/lib/chart/timeframes";

interface TimeframeSelectorProps {
  resolution: string;
  onSelectResolution: (res: string) => void;
}

export function TimeframeSelector({
  resolution,
  onSelectResolution,
}: TimeframeSelectorProps) {
  const [favorites, setFavorites] = useState<string[]>(DEFAULT_FAVORITE_TIMEFRAMES);
  const [isOpen, setIsOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [customUnit, setCustomUnit] = useState<TimeframeUnit>("minutes");
  const [customError, setCustomError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Load favorites from localStorage on mount
  useEffect(() => {
    const loaded = getStoredFavoriteTimeframes();
    setFavorites(loaded);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const toggleFavorite = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    let updated: string[];
    if (favorites.includes(val)) {
      // Must keep at least one favorite
      if (favorites.length <= 1) return;
      updated = favorites.filter((f) => f !== val);
    } else {
      // Keep sorted by ALL_TIMEFRAMES order
      const allValues = ALL_TIMEFRAMES.map((t) => t.value);
      const nextSet = new Set([...favorites, val]);
      updated = allValues.filter((v) => nextSet.has(v));
    }
    setFavorites(updated);
    saveStoredFavoriteTimeframes(updated);
  };

  const handleSelect = (val: string) => {
    onSelectResolution(val);
    setIsOpen(false);
    setCustomError(null);
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(customAmount, 10);
    const result = validateCustomTimeframe(parsed, customUnit);
    if (!result.valid || !result.timeframe) {
      setCustomError(result.message || "Invalid interval.");
      return;
    }

    const val = result.timeframe.value;
    if (!favorites.includes(val)) {
      const allValues = ALL_TIMEFRAMES.map((t) => t.value);
      const nextSet = new Set([...favorites, val]);
      const updated = allValues.filter((v) => nextSet.has(v));
      setFavorites(updated);
      saveStoredFavoriteTimeframes(updated);
    }
    onSelectResolution(val);
    setCustomAmount("");
    setCustomError(null);
    setIsOpen(false);
  };

  // Determine which buttons to show on ribbon
  // Pinned favorites + temporary active timeframe if resolution not in favorites
  const favoriteItems = ALL_TIMEFRAMES.filter((tf) => favorites.includes(tf.value));
  const activeNotInFavorites = !favorites.includes(resolution)
    ? findTimeframe(resolution) || {
        label: resolution,
        description: resolution,
        value: resolution,
        category: "minutes" as const,
        numericAmount: 0,
        unit: "minutes" as const,
      }
    : null;

  return (
    <div ref={containerRef} className="relative flex items-center">
      {/* Quick Ribbon Bar */}
      <div className="flex items-center bg-surface-container-lowest p-0.5 rounded border border-border">
        {favoriteItems.map((tf) => {
          const isActive = resolution === tf.value;
          return (
            <button
              key={tf.value}
              onClick={() => handleSelect(tf.value)}
              title={tf.description}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                isActive
                  ? "bg-primary-container text-white font-bold shadow-xs"
                  : "text-muted hover:text-on-surface hover:bg-surface-container-high"
              }`}
            >
              {tf.label}
            </button>
          );
        })}

        {/* Temporary pill for active un-favorited interval */}
        {activeNotInFavorites && (
          <button
            onClick={() => handleSelect(activeNotInFavorites.value)}
            title={`${activeNotInFavorites.description} (Active)`}
            className="px-2 py-0.5 rounded text-[11px] font-mono transition-colors bg-primary-container text-white font-bold shadow-xs"
          >
            {activeNotInFavorites.label}
          </button>
        )}

        {/* Dropdown Chevron Trigger */}
        <button
          onClick={() => {
            setIsOpen((prev) => !prev);
            setCustomError(null);
          }}
          title="More Timeframes"
          className={`px-1 py-1 rounded text-muted hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer ml-0.5 ${
            isOpen ? "bg-surface-container-high text-on-surface" : ""
          }`}
        >
          <ChevronDown size={12} className={`transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* TradingView-Style Timeframe Popover Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 top-full mt-1.5 w-64 rounded-lg bg-[#161a25] border border-outline-variant/40 shadow-2xl z-50 p-2 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-100">
            {/* Header */}
            <div className="flex items-center justify-between px-2 py-1 border-b border-outline-variant/20">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted font-bold">
                Timeframe Selection
              </span>
              <span className="text-[9px] font-mono text-outline">TradingView Style</span>
            </div>

            {/* Categorized List */}
            <div className="max-h-72 overflow-y-auto no-scrollbar space-y-2">
              {TIMEFRAME_CATEGORIES.map((cat) => {
                const items = ALL_TIMEFRAMES.filter((tf) => tf.category === cat.id);
                if (items.length === 0) return null;

                return (
                  <div key={cat.id} className="space-y-0.5">
                    <div className="px-2 pt-1 pb-0.5 text-[9px] font-mono uppercase tracking-wider text-muted/70 font-semibold">
                      {cat.label}
                    </div>

                    {items.map((tf) => {
                      const isActive = resolution === tf.value;
                      const isFavorite = favorites.includes(tf.value);

                      return (
                        <div
                          key={tf.value}
                          onClick={() => handleSelect(tf.value)}
                          className={`group w-full px-2 py-1 rounded flex items-center justify-between transition-colors cursor-pointer ${
                            isActive
                              ? "bg-primary/15 text-primary font-bold border border-primary/30"
                              : "text-on-surface hover:bg-surface-container text-xs font-mono"
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="w-8 text-[11px] font-bold text-left">{tf.label}</span>
                            <span className="truncate text-xs text-muted group-hover:text-on-surface">
                              {tf.description}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isActive && <Check size={12} className="text-secondary shrink-0" />}
                            <button
                              type="button"
                              onClick={(e) => toggleFavorite(tf.value, e)}
                              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                              className="p-1 rounded hover:bg-surface-container-high transition-colors"
                            >
                              <Star
                                size={12}
                                className={
                                  isFavorite
                                    ? "text-gold fill-gold"
                                    : "text-muted/30 group-hover:text-muted hover:text-gold"
                                }
                              />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Custom Timeframe Section */}
            <div className="border-t border-outline-variant/20 pt-2 px-1">
              <form onSubmit={handleAddCustom} className="space-y-1.5">
                <div className="text-[10px] font-mono text-muted uppercase tracking-wider font-semibold">
                  Add Custom Interval
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 30"
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value);
                      setCustomError(null);
                    }}
                    className="w-16 px-2 py-1 rounded bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs font-mono focus:outline-hidden focus:border-primary"
                  />
                  <select
                    value={customUnit}
                    onChange={(e) => {
                      setCustomUnit(e.target.value as TimeframeUnit);
                      setCustomError(null);
                    }}
                    className="flex-1 px-2 py-1 rounded bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs font-mono focus:outline-hidden focus:border-primary"
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </select>
                  <button
                    type="submit"
                    title="Add and activate interval"
                    className="px-2.5 py-1 rounded bg-primary-container text-white text-xs font-mono font-semibold hover:bg-primary-container/80 transition-colors flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Add</span>
                  </button>
                </div>
                {customError && (
                  <div className="flex items-start gap-1 text-[10px] text-tertiary font-mono pt-0.5">
                    <AlertCircle size={11} className="shrink-0 mt-0.5" />
                    <span>{customError}</span>
                  </div>
                )}
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
