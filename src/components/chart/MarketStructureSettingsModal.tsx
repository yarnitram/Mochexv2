"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Sliders,
  Palette,
  RotateCcw,
  Check,
} from "lucide-react";
import {
  MarketStructureSettings,
  DEFAULT_MARKET_STRUCTURE_SETTINGS,
} from "@/lib/indicators/market-structure";

interface MarketStructureSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: MarketStructureSettings;
  onSaveSettings: (settings: MarketStructureSettings) => void;
}

const PALETTE_COLORS = [
  "#2962ff",
  "#00c087",
  "#089981",
  "#f23645",
  "#ff3b30",
  "#f5ac37",
  "#9353d3",
  "#00d8ff",
  "#787b86",
  "#ffffff",
];

export function MarketStructureSettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}: MarketStructureSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"inputs" | "style">("inputs");

  // Form local state
  const [formState, setFormState] = useState<MarketStructureSettings>(settings);

  // Sync state when modal opens or settings change
  useEffect(() => {
    if (isOpen) {
      setFormState({ ...settings });
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleResetDefaults = () => {
    setFormState({ ...DEFAULT_MARKET_STRUCTURE_SETTINGS });
  };

  const handleSave = () => {
    onSaveSettings(formState);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e222d] border border-[#2a2e39] rounded-xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden text-[#d1d4dc] font-sans animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#2a2e39] flex items-center justify-between bg-[#1e222d]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#f0f3fa]">
              Market Structure & Substructure
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#787b86] hover:text-[#f0f3fa] hover:bg-[#2a2e39]/60 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-5 border-b border-[#2a2e39] bg-[#171b26]">
          <button
            onClick={() => setActiveTab("inputs")}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "inputs"
                ? "border-[#2962ff] text-[#2962ff]"
                : "border-transparent text-[#787b86] hover:text-[#d1d4dc]"
            }`}
          >
            <Sliders size={13} />
            <span>Inputs</span>
          </button>
          <button
            onClick={() => setActiveTab("style")}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "style"
                ? "border-[#2962ff] text-[#2962ff]"
                : "border-transparent text-[#787b86] hover:text-[#d1d4dc]"
            }`}
          >
            <Palette size={13} />
            <span>Style</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4 text-xs">
          {activeTab === "inputs" && (
            <div className="space-y-4">
              {/* Swing Length Inputs */}
              <div className="bg-[#131722] p-3 rounded-lg border border-[#2a2e39] space-y-3">
                <div className="text-[11px] font-semibold text-[#787b86] uppercase tracking-wider">
                  Structure Detection Lookback
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-[#d1d4dc]">Major Swing Length</label>
                  <input
                    type="number"
                    min={2}
                    max={50}
                    value={formState.majorLength}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        majorLength: Math.max(2, parseInt(e.target.value) || 10),
                      })
                    }
                    className="w-20 bg-[#1e222d] border border-[#2a2e39] rounded px-2 py-1 text-right text-xs text-[#f0f3fa] focus:border-[#2962ff] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-[#d1d4dc]">Substructure Swing Length</label>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={formState.subLength}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        subLength: Math.max(1, parseInt(e.target.value) || 4),
                      })
                    }
                    className="w-20 bg-[#1e222d] border border-[#2a2e39] rounded px-2 py-1 text-right text-xs text-[#f0f3fa] focus:border-[#2962ff] focus:outline-none"
                  />
                </div>
              </div>

              {/* Confirmation Rule */}
              <div className="bg-[#131722] p-3 rounded-lg border border-[#2a2e39] space-y-2">
                <div className="text-[11px] font-semibold text-[#787b86] uppercase tracking-wider">
                  Breakout Confirmation Rule
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setFormState({ ...formState, confirmation: "close" })}
                    className={`py-1.5 px-3 rounded border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      formState.confirmation === "close"
                        ? "bg-[#2962ff]/15 border-[#2962ff] text-[#2962ff]"
                        : "bg-[#1e222d] border-[#2a2e39] text-[#787b86] hover:text-[#d1d4dc]"
                    }`}
                  >
                    {formState.confirmation === "close" && <Check size={12} />}
                    Candle Close (Filter wicks)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormState({ ...formState, confirmation: "wick" })}
                    className={`py-1.5 px-3 rounded border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      formState.confirmation === "wick"
                        ? "bg-[#2962ff]/15 border-[#2962ff] text-[#2962ff]"
                        : "bg-[#1e222d] border-[#2a2e39] text-[#787b86] hover:text-[#d1d4dc]"
                    }`}
                  >
                    {formState.confirmation === "wick" && <Check size={12} />}
                    Candle Wick (Instant)
                  </button>
                </div>
              </div>

              {/* Toggles */}
              <div className="bg-[#131722] p-3 rounded-lg border border-[#2a2e39] space-y-2.5">
                <div className="text-[11px] font-semibold text-[#787b86] uppercase tracking-wider">
                  Components & Labels
                </div>

                <label className="flex items-center justify-between cursor-pointer py-0.5">
                  <span className="text-[#d1d4dc]">Show Major ZigZag Swings</span>
                  <input
                    type="checkbox"
                    checked={formState.showMajor}
                    onChange={(e) =>
                      setFormState({ ...formState, showMajor: e.target.checked })
                    }
                    className="w-4 h-4 rounded bg-[#1e222d] border-[#2a2e39] accent-[#2962ff] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer py-0.5">
                  <span className="text-[#d1d4dc]">Show Internal Substructure ZigZag</span>
                  <input
                    type="checkbox"
                    checked={formState.showSubstructure}
                    onChange={(e) =>
                      setFormState({ ...formState, showSubstructure: e.target.checked })
                    }
                    className="w-4 h-4 rounded bg-[#1e222d] border-[#2a2e39] accent-[#2962ff] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer py-0.5">
                  <span className="text-[#d1d4dc]">Show Break of Structure (BOS)</span>
                  <input
                    type="checkbox"
                    checked={formState.showBOS}
                    onChange={(e) =>
                      setFormState({ ...formState, showBOS: e.target.checked })
                    }
                    className="w-4 h-4 rounded bg-[#1e222d] border-[#2a2e39] accent-[#2962ff] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer py-0.5">
                  <span className="text-[#d1d4dc]">Show Change of Character (CHoCH)</span>
                  <input
                    type="checkbox"
                    checked={formState.showCHOCH}
                    onChange={(e) =>
                      setFormState({ ...formState, showCHOCH: e.target.checked })
                    }
                    className="w-4 h-4 rounded bg-[#1e222d] border-[#2a2e39] accent-[#2962ff] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer py-0.5">
                  <span className="text-[#d1d4dc]">Show Swing Tags (HH, HL, LH, LL)</span>
                  <input
                    type="checkbox"
                    checked={formState.showSwingLabels}
                    onChange={(e) =>
                      setFormState({ ...formState, showSwingLabels: e.target.checked })
                    }
                    className="w-4 h-4 rounded bg-[#1e222d] border-[#2a2e39] accent-[#2962ff] cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === "style" && (
            <div className="space-y-4">
              {/* Major Structure Styling */}
              <div className="bg-[#131722] p-3 rounded-lg border border-[#2a2e39] space-y-3">
                <div className="text-[11px] font-semibold text-[#787b86] uppercase tracking-wider">
                  Major Structure ZigZag
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#d1d4dc]">Line Color</span>
                  <div className="flex items-center gap-1.5">
                    {PALETTE_COLORS.slice(0, 5).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormState({ ...formState, majorColor: c })}
                        style={{ backgroundColor: c }}
                        className={`w-5 h-5 rounded-full border transition-transform ${
                          formState.majorColor === c
                            ? "border-white scale-110 shadow-sm"
                            : "border-transparent opacity-80 hover:opacity-100"
                        }`}
                      />
                    ))}
                    <input
                      type="color"
                      value={formState.majorColor}
                      onChange={(e) =>
                        setFormState({ ...formState, majorColor: e.target.value })
                      }
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between bg-[#1e222d] px-2.5 py-1.5 rounded border border-[#2a2e39]">
                    <span className="text-[11px] text-[#787b86]">Thickness</span>
                    <select
                      value={formState.majorLineWidth}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          majorLineWidth: parseInt(e.target.value) || 2,
                        })
                      }
                      className="bg-transparent text-xs text-[#f0f3fa] focus:outline-none cursor-pointer"
                    >
                      <option value={1} className="bg-[#1e222d]">1px</option>
                      <option value={2} className="bg-[#1e222d]">2px</option>
                      <option value={3} className="bg-[#1e222d]">3px</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between bg-[#1e222d] px-2.5 py-1.5 rounded border border-[#2a2e39]">
                    <span className="text-[11px] text-[#787b86]">Style</span>
                    <select
                      value={formState.majorLineStyle}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          majorLineStyle: e.target.value as any,
                        })
                      }
                      className="bg-transparent text-xs text-[#f0f3fa] focus:outline-none cursor-pointer"
                    >
                      <option value="solid" className="bg-[#1e222d]">Solid</option>
                      <option value="dashed" className="bg-[#1e222d]">Dashed</option>
                      <option value="dotted" className="bg-[#1e222d]">Dotted</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Substructure Styling */}
              <div className="bg-[#131722] p-3 rounded-lg border border-[#2a2e39] space-y-3">
                <div className="text-[11px] font-semibold text-[#787b86] uppercase tracking-wider">
                  Internal Substructure ZigZag
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#d1d4dc]">Line Color</span>
                  <div className="flex items-center gap-1.5">
                    {PALETTE_COLORS.slice(5).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormState({ ...formState, subColor: c })}
                        style={{ backgroundColor: c }}
                        className={`w-5 h-5 rounded-full border transition-transform ${
                          formState.subColor === c
                            ? "border-white scale-110 shadow-sm"
                            : "border-transparent opacity-80 hover:opacity-100"
                        }`}
                      />
                    ))}
                    <input
                      type="color"
                      value={formState.subColor}
                      onChange={(e) =>
                        setFormState({ ...formState, subColor: e.target.value })
                      }
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between bg-[#1e222d] px-2.5 py-1.5 rounded border border-[#2a2e39]">
                    <span className="text-[11px] text-[#787b86]">Thickness</span>
                    <select
                      value={formState.subLineWidth}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          subLineWidth: parseInt(e.target.value) || 1,
                        })
                      }
                      className="bg-transparent text-xs text-[#f0f3fa] focus:outline-none cursor-pointer"
                    >
                      <option value={1} className="bg-[#1e222d]">1px</option>
                      <option value={2} className="bg-[#1e222d]">2px</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between bg-[#1e222d] px-2.5 py-1.5 rounded border border-[#2a2e39]">
                    <span className="text-[11px] text-[#787b86]">Style</span>
                    <select
                      value={formState.subLineStyle}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          subLineStyle: e.target.value as any,
                        })
                      }
                      className="bg-transparent text-xs text-[#f0f3fa] focus:outline-none cursor-pointer"
                    >
                      <option value="dotted" className="bg-[#1e222d]">Dotted</option>
                      <option value="dashed" className="bg-[#1e222d]">Dashed</option>
                      <option value="solid" className="bg-[#1e222d]">Solid</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Breakout Colors */}
              <div className="bg-[#131722] p-3 rounded-lg border border-[#2a2e39] space-y-3">
                <div className="text-[11px] font-semibold text-[#787b86] uppercase tracking-wider">
                  Breakout Colors (BOS / CHoCH)
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#d1d4dc]">Bullish Breakout (+BOS / +CHoCH)</span>
                  <div className="flex items-center gap-2">
                    <span
                      style={{ backgroundColor: formState.bullishColor }}
                      className="w-5 h-5 rounded-md border border-white/20 inline-block"
                    />
                    <input
                      type="color"
                      value={formState.bullishColor}
                      onChange={(e) =>
                        setFormState({ ...formState, bullishColor: e.target.value })
                      }
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#d1d4dc]">Bearish Breakout (-BOS / -CHoCH)</span>
                  <div className="flex items-center gap-2">
                    <span
                      style={{ backgroundColor: formState.bearishColor }}
                      className="w-5 h-5 rounded-md border border-white/20 inline-block"
                    />
                    <input
                      type="color"
                      value={formState.bearishColor}
                      onChange={(e) =>
                        setFormState({ ...formState, bearishColor: e.target.value })
                      }
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#2a2e39] bg-[#1e222d] flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-xs text-[#787b86] hover:text-[#f0f3fa] transition-colors py-1 px-2 rounded hover:bg-[#2a2e39]/50"
          >
            <RotateCcw size={13} />
            <span>Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs text-[#d1d4dc] hover:text-[#f0f3fa] hover:bg-[#2a2e39] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded text-xs font-semibold bg-[#2962ff] text-white hover:bg-[#1e53e5] transition-colors shadow-sm"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
