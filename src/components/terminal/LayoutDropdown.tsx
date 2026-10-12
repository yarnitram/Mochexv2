"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Cloud,
  ChevronDown,
  Plus,
  Trash2,
  Check,
  RefreshCw,
  Clock,
  Sparkles,
} from "lucide-react";
import { AuthUser } from "@/lib/auth/use-auth";

export interface SavedLayoutItem {
  id: string;
  name: string;
  symbol: string;
  resolution: string;
  content: any;
  isDefault?: boolean;
  updatedAt?: string;
}

interface LayoutDropdownProps {
  currentSymbol: string;
  currentResolution: string;
  currentIndicators: string[];
  user: AuthUser | null;
  onLoadLayout: (layout: SavedLayoutItem) => void;
  onOpenAuthModal: () => void;
}

export function LayoutDropdown({
  currentSymbol,
  currentResolution,
  currentIndicators,
  user,
  onLoadLayout,
  onOpenAuthModal,
}: LayoutDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeLayoutName, setActiveLayoutName] = useState("Default Pro Setup");
  const [newLayoutName, setNewLayoutName] = useState("");
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [layouts, setLayouts] = useState<SavedLayoutItem[]>([]);

  // Fetch layouts from cloud or localStorage
  const fetchLayouts = useCallback(async () => {
    if (user) {
      try {
        const res = await fetch("/api/layouts", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setLayouts(data);
            return;
          }
        }
      } catch (err) {
        console.warn("Failed to fetch cloud layouts:", err);
      }
    }

    // Guest fallback to localStorage
    if (typeof window !== "undefined") {
      try {
        const local = localStorage.getItem("mochex:layouts_list");
        if (local) {
          setLayouts(JSON.parse(local));
        } else {
          setLayouts([
            {
              id: "default-local",
              name: "Default Pro Setup",
              symbol: currentSymbol,
              resolution: currentResolution,
              content: { symbol: currentSymbol, resolution: currentResolution, indicators: currentIndicators },
              isDefault: true,
            },
          ]);
        }
      } catch {}
    }
  }, [user, currentSymbol, currentResolution, currentIndicators]);

  useEffect(() => {
    fetchLayouts();
  }, [fetchLayouts]);

  // Save current layout to cloud / local
  const saveCurrentLayout = async (nameToSave = activeLayoutName, makeDefault = false) => {
    setIsSaving(true);
    const content = {
      symbol: currentSymbol,
      resolution: currentResolution,
      indicators: currentIndicators,
      savedAt: new Date().toISOString(),
    };

    if (user) {
      try {
        const res = await fetch("/api/layouts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: nameToSave,
            symbol: currentSymbol,
            resolution: currentResolution,
            content,
            isDefault: makeDefault,
          }),
        });

        if (res.ok) {
          const saved = await res.json();
          setLayouts((prev) => [saved, ...prev.filter((l) => l.name !== nameToSave)]);
          setActiveLayoutName(nameToSave);
          setSaveFeedback(true);
          setTimeout(() => setSaveFeedback(false), 2000);
        }
      } catch (err) {
        console.warn("Cloud layout save error:", err);
      }
    } else {
      // Local Guest storage
      const newItem: SavedLayoutItem = {
        id: `local-${Date.now()}`,
        name: nameToSave,
        symbol: currentSymbol,
        resolution: currentResolution,
        content,
        isDefault: makeDefault,
        updatedAt: new Date().toISOString(),
      };

      const updated = [newItem, ...layouts.filter((l) => l.name !== nameToSave)];
      setLayouts(updated);
      setActiveLayoutName(nameToSave);
      if (typeof window !== "undefined") {
        localStorage.setItem("mochex:layouts_list", JSON.stringify(updated));
      }
      setSaveFeedback(true);
      setTimeout(() => setSaveFeedback(false), 2000);
    }

    setIsSaving(false);
  };

  // Auto-Save interval (every 30 seconds if enabled)
  useEffect(() => {
    if (!autoSaveEnabled) return;

    const timer = setInterval(() => {
      saveCurrentLayout(activeLayoutName);
    }, 30000);

    return () => clearInterval(timer);
  }, [autoSaveEnabled, activeLayoutName, currentSymbol, currentResolution, currentIndicators]);

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLayoutName.trim()) return;
    saveCurrentLayout(newLayoutName.trim());
    setNewLayoutName("");
  };

  const handleDeleteLayout = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (user) {
      try {
        await fetch(`/api/layouts/${id}`, { method: "DELETE", credentials: "include" });
      } catch {}
    }

    const updated = layouts.filter((l) => l.id !== id);
    setLayouts(updated);
    if (!user && typeof window !== "undefined") {
      localStorage.setItem("mochex:layouts_list", JSON.stringify(updated));
    }
  };

  return (
    <div className="relative font-mono">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 text-on-surface text-xs font-semibold transition-colors"
      >
        <Cloud size={13} className={saveFeedback ? "text-secondary" : isSaving ? "text-primary animate-spin" : "text-muted"} />
        <span className="max-w-[110px] truncate">{activeLayoutName}</span>
        <ChevronDown size={12} className="text-muted" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-72 bg-surface-container-lowest border border-border rounded-lg shadow-2xl py-2 z-50">
          {/* Header Title & Status */}
          <div className="px-3 pb-2 border-b border-border flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted">
              {user ? "Cloud Workspaces" : "Local Layouts (Guest)"}
            </span>

            {!user && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenAuthModal();
                }}
                className="text-[10px] text-primary hover:underline flex items-center gap-1"
              >
                <Sparkles size={11} />
                <span>Sign In to Sync</span>
              </button>
            )}
          </div>

          {/* Auto-Save Toggle */}
          <div className="px-3 py-2 border-b border-border flex items-center justify-between text-[11px]">
            <span className="text-on-surface">Auto-Save (30s)</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoSaveEnabled}
                onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-7 h-4 bg-surface-container-highest peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary-container"></div>
            </label>
          </div>

          {/* Save As New Input */}
          <form onSubmit={handleCreateNew} className="p-2 border-b border-border flex items-center gap-1.5">
            <input
              type="text"
              value={newLayoutName}
              onChange={(e) => setNewLayoutName(e.target.value)}
              placeholder="Save current setup as..."
              className="flex-1 bg-surface-container-low text-on-surface text-[11px] px-2 py-1 rounded border border-border focus:outline-hidden focus:border-primary-container"
            />
            <button
              type="submit"
              disabled={!newLayoutName.trim()}
              className="px-2 py-1 rounded bg-primary-container hover:bg-accent-hover text-white text-[11px] font-semibold disabled:opacity-40 transition-colors"
            >
              <Plus size={13} />
            </button>
          </form>

          {/* Layouts List */}
          <div className="max-h-48 overflow-y-auto no-scrollbar py-1 divide-y divide-border/20">
            {layouts.map((layout) => {
              const isActive = layout.name === activeLayoutName;
              return (
                <div
                  key={layout.id}
                  onClick={() => {
                    setActiveLayoutName(layout.name);
                    onLoadLayout(layout);
                    setIsOpen(false);
                  }}
                  className={`px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-surface-container transition-colors ${
                    isActive ? "bg-surface-container-high border-l-2 border-primary-container" : ""
                  }`}
                >
                  <div>
                    <div className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                      <span>{layout.name}</span>
                      {isActive && <Check size={12} className="text-secondary" />}
                    </div>
                    <div className="text-[10px] text-muted flex items-center gap-2 mt-0.5">
                      <span>{layout.symbol}</span>
                      <span>&bull;</span>
                      <span>{layout.resolution}m</span>
                    </div>
                  </div>

                  {layouts.length > 1 && (
                    <button
                      onClick={(e) => handleDeleteLayout(layout.id, e)}
                      title="Delete Layout"
                      className="p-1 rounded text-muted hover:text-tertiary hover:bg-surface transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
