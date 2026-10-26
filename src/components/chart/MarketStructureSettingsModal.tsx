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
  "#26a69a",
  "#f23645",
  "#ff3b30",
  "#ef5350",
  "#f5ac37",
  "#9353d3",
  "#00d8ff",
  "#787b86",
  "#ffffff",
];

function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? "bg-[#2962ff]" : "bg-[#2a2e39]"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function ColorPickerRow({
  label,
  value,
  onChange,
  tagText,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  tagText?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        {tagText && (
          <span
            style={{ backgroundColor: value }}
            className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white shadow-xs"
          >
            {tagText}
          </span>
        )}
        <span className="text-[#d1d4dc] text-xs">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          style={{ backgroundColor: value }}
          className="w-5 h-5 rounded border border-white/20 inline-block shadow-xs"
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
        />
      </div>
    </div>
  );
}

export function MarketStructureSettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}: MarketStructureSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"inputs" | "style">("inputs");

  // Form local state
  const [formState, setFormState] = useState<MarketStructureSettings>({
    ...DEFAULT_MARKET_STRUCTURE_SETTINGS,
    ...settings,
  });

  // Sync state when modal opens or settings change
  useEffect(() => {
    if (isOpen) {
      setFormState({
        ...DEFAULT_MARKET_STRUCTURE_SETTINGS,
        ...settings,
      });
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
      <div className="bg-[#1e222d] border border-[#2a2e39] rounded-xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden text-[#d1d4dc] font-sans animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#2a2e39] flex items-center justify-between bg-[#1e222d]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#f0f3fa]">
              Market Structure & Substructure Settings
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#787b86] hover:text-[#f0f3fa] hover:bg-[#2a2e39]/60 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-5 border-b border-[#2a2e39] bg-[#171b26]">
          <button
            onClick={() => setActiveTab("inputs")}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === "inputs"
                ? "border-[#2962ff] text-[#2962ff]"
                : "border-transparent text-[#787b86] hover:text-[#d1d4dc]"
            }`}
          >
            <Sliders size={13} />
            <span>Inputs & Toggles</span>
          </button>
          <button
            onClick={() => setActiveTab("style")}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === "style"
                ? "border-[#2962ff] text-[#2962ff]"
                : "border-transparent text-[#787b86] hover:text-[#d1d4dc]"
            }`}
          >
            <Palette size={13} />
            <span>Colors & Style</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 max-h-[65vh] overflow-y-auto space-y-4 text-xs">
          {activeTab === "inputs" && (
            <div className="space-y-4">
              {/* Structure Detection Lookbacks */}
              <div className="bg-[#131722] p-3 rounded-lg border border-[#2a2e39] space-y-3">
                <div className="text-[11px] font-semibold text-[#787b86] uppercase tracking-wider">
                  Structure Detection Lookback
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-[#d1d4dc]">Major Swing Lookback Length</label>
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
                  <label className="text-[#d1d4dc]">Substructure Swing Lookback Length</label>
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
                    className={`py-1.5 px-3 rounded border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
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
                    className={`py-1.5 px-3 rounded border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
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

              {/* Main Structure Toggles */}
              <div className="bg-[#131722] p-3 rounded-lg border border-[#2a2e39] space-y-3">
                <div className="text-[11px] font-semibold text-[#787b86] uppercase tracking-wider">
                  Structure Visibility Switches
                </div>

                <div className="flex items-center justify-between py-1 border-b border-[#2a2e39]/50">
                  <div className="flex flex-col">
                    <span className="text-[#f0f3fa] font-medium">True Market Structure (Major ZigZag)</span>
                    <span className="text-[10px] text-[#787b86]">Macro swing highs, lows, and primary trendline</span>
                  </div>
                  <ToggleSwitch
                    checked={formState.showMajor}
                    onChange={(val) => setFormState({ ...formState, showMajor: val })}
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <div className="flex flex-col">
                    <span className="text-[#f0f3fa] font-medium">Internal Substructure</span>
                    <span className="text-[10px] text-[#787b86]">Micro swings and internal zigzag waves</span>
                  </div>
                  <ToggleSwitch
                    checked={formState.showSubstructure}
                    onChange={(val) => setFormState({ ...formState, showSubstructure: val })}
                  />
                </div>
              </div>

              {/* Breakout Switches */}
              <div className="bg-[#131722] p-3 rounded-lg border border-[#2a2e39] space-y-3">
                <div className="text-[11px] font-semibold text-[#787b86] uppercase tracking-wider">
                  Breakout Level Switches
                </div>

                <div className="flex items-center justify-between py-1 border-b border-[#2a2e39]/50">
                  <div className="flex flex-col">
                    <span className="text-[#d1d4dc]">Break of Structure (BOS)</span>
                    <span className="text-[10px] text-[#787b86]">Trend-continuation breakout rays and badges</span>
                  </div>
                  <ToggleSwitch
                    checked={formState.showBOS}
                    onChange={(val) => setFormState({ ...formState, showBOS: val })}
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <div className="flex flex-col">
                    <span className="text-[#d1d4dc]">Change of Character (CHoCH)</span>
                    <span className="text-[10px] text-[#787b86]">Trend-reversal breakout rays and badges</span>
                  </div>
                  <ToggleSwitch
                    checked={formState.showCHOCH}
                    onChange={(val) => setFormState({ ...formState, showCHOCH: val })}
                  />
                </div>
              </div>

              {/* Swing Label Switches */}
              <div className="bg-[#131722] p-3 rounded-lg border border-[#2a2e39] space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-[#2a2e39]/50">
                  <span className="text-[11px] font-semibold text-[#787b86] uppercase tracking-wider">
                    Swing Point Tags (HH, HL, LH, LL)
                  </span>
                  <ToggleSwitch
                    checked={formState.showSwingLabels}
                    onChange={(val) => setFormState({ ...formState, showSwingLabels: val })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="flex items-center justify-between bg-[#1e222d] p-2 rounded border border-[#2a2e39]">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-[#089981] text-[9px] font-bold text-white">HH</span>
                      <span className="text-[11px] text-[#d1d4dc]">Higher High</span>
                    </div>
                    <ToggleSwitch
                      checked={formState.showHH}
                      disabled={!formState.showSwingLabels}
                      onChange={(val) => setFormState({ ...formState, showHH: val })}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-[#1e222d] p-2 rounded border border-[#2a2e39]">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-[#26a69a] text-[9px] font-bold text-white">HL</span>
                      <span className="text-[11px] text-[#d1d4dc]">Higher Low</span>
                    </div>
                    <ToggleSwitch
                      checked={formState.showHL}
                      disabled={!formState.showSwingLabels}
                      onChange={(val) => setFormState({ ...formState, showHL: val })}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-[#1e222d] p-2 rounded border border-[#2a2e39]">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-[#f23645] text-[9px] font-bold text-white">LH</span>
                      <span className="text-[11px] text-[#d1d4dc]">Lower High</span>
                    </div>
                    <ToggleSwitch
                      checked={formState.showLH}
                      disabled={!formState.showSwingLabels}
                      onChange={(val) => setFormState({ ...formState, showLH: val })}
                    />
                  </div>

                  <div className="flex items-center justify-between bg-[#1e222d] p-2 rounded border border-[#2a2e39]">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-[#ef5350] text-[9px] font-bold text-white">LL</span>
                      <span className="text-[11px] text-[#d1d4dc]">Lower Low</span>
                    </div>
                    <ToggleSwitch
                      checked={formState.showLL}
                      disabled={!formState.showSwingLabels}
                      onChange={(val) => setFormState({ ...formState, showLL: val })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "style" && (
            <div className="space-y-4">
              {/* Major Structure Styling */}
              <div className="bg-[#131722] p-3 rounded-lg border border-[#2a2e39] space-y-3">
                <div className="text-[11px] font-semibold text-[#787b86] uppercase tracking-wider">
                  True Market Structure (Major ZigZag)
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
                        className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
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
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
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
                    {PALETTE_COLORS.slice(6, 11).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormState({ ...formState, subColor: c })}
                        style={{ backgroundColor: c }}
                        className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
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
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
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

              {/* BOS & CHoCH Breakout Colors */}
              <div className="bg-[#131722] p-3 rounded-lg border border-[#2a2e39] space-y-2">
                <div className="text-[11px] font-semibold text-[#787b86] uppercase tracking-wider mb-2">
                  BOS & CHoCH Breakout Colors
                </div>

                <ColorPickerRow
                  label="Bullish Break of Structure (+BOS)"
                  tagText="+BOS"
                  value={formState.bosBullishColor}
                  onChange={(c) => setFormState({ ...formState, bosBullishColor: c })}
                />
                <ColorPickerRow
                  label="Bearish Break of Structure (-BOS)"
                  tagText="-BOS"
                  value={formState.bosBearishColor}
                  onChange={(c) => setFormState({ ...formState, bosBearishColor: c })}
                />
                <div className="border-t border-[#2a2e39]/50 my-1" />
                <ColorPickerRow
                  label="Bullish Change of Character (+CHoCH)"
                  tagText="+CHoCH"
                  value={formState.chochBullishColor}
                  onChange={(c) => setFormState({ ...formState, chochBullishColor: c })}
                />
                <ColorPickerRow
                  label="Bearish Change of Character (-CHoCH)"
                  tagText="-CHoCH"
                  value={formState.chochBearishColor}
                  onChange={(c) => setFormState({ ...formState, chochBearishColor: c })}
                />
              </div>

              {/* Swing Labels Colors */}
              <div className="bg-[#131722] p-3 rounded-lg border border-[#2a2e39] space-y-2">
                <div className="text-[11px] font-semibold text-[#787b86] uppercase tracking-wider mb-2">
                  Swing Point Label Colors
                </div>

                <ColorPickerRow
                  label="Higher High (HH)"
                  tagText="HH"
                  value={formState.hhColor}
                  onChange={(c) => setFormState({ ...formState, hhColor: c })}
                />
                <ColorPickerRow
                  label="Higher Low (HL)"
                  tagText="HL"
                  value={formState.hlColor}
                  onChange={(c) => setFormState({ ...formState, hlColor: c })}
                />
                <ColorPickerRow
                  label="Lower High (LH)"
                  tagText="LH"
                  value={formState.lhColor}
                  onChange={(c) => setFormState({ ...formState, lhColor: c })}
                />
                <ColorPickerRow
                  label="Lower Low (LL)"
                  tagText="LL"
                  value={formState.llColor}
                  onChange={(c) => setFormState({ ...formState, llColor: c })}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#2a2e39] bg-[#1e222d] flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-xs text-[#787b86] hover:text-[#f0f3fa] transition-colors py-1 px-2 rounded hover:bg-[#2a2e39]/50 cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs text-[#d1d4dc] hover:text-[#f0f3fa] hover:bg-[#2a2e39] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded text-xs font-semibold bg-[#2962ff] text-white hover:bg-[#1e53e5] transition-colors shadow-sm cursor-pointer"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
