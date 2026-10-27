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
  CandleStructureSettings,
  DEFAULT_CANDLE_STRUCTURE_SETTINGS,
} from "@/lib/indicators/candle-structure";

interface CandleStructureSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: CandleStructureSettings;
  onSaveSettings: (settings: CandleStructureSettings) => void;
}

const PALETTE_COLORS = [
  "#00c087",
  "#00e676",
  "#26a69a",
  "#2962ff",
  "#00d8ff",
  "#ff3b30",
  "#ff5252",
  "#ef5350",
  "#f5ac37",
  "#9353d3",
  "#ffffff",
  "#787b86",
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

export function CandleStructureSettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}: CandleStructureSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"inputs" | "style">("inputs");

  const [formState, setFormState] = useState<CandleStructureSettings>({
    ...DEFAULT_CANDLE_STRUCTURE_SETTINGS,
    ...settings,
  });

  useEffect(() => {
    if (isOpen) {
      setFormState({
        ...DEFAULT_CANDLE_STRUCTURE_SETTINGS,
        ...settings,
      });
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleResetDefaults = () => {
    setFormState({ ...DEFAULT_CANDLE_STRUCTURE_SETTINGS });
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
              Candlestick Market Structure Settings
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#787b86] hover:text-[#f0f3fa] hover:bg-[#2a2e39]/60 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
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

        {/* Body */}
        <div className="p-5 max-h-[65vh] overflow-y-auto space-y-4 text-xs">
          {activeTab === "inputs" && (
            <div className="space-y-4">
              {/* Swing Formation */}
              <div className="bg-[#131722] p-3 rounded-lg border border-[#2a2e39] space-y-3">
                <div className="text-[11px] font-semibold text-[#787b86] uppercase tracking-wider">
                  Candlestick Swing Formation
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[#d1d4dc]">Flanking Bars</span>
                    <span className="text-[10px] text-[#787b86]">
                      {formState.flankBars === 1
                        ? "3-Bar Swing (1 left, 1 right)"
                        : "5-Bar Swing (2 left, 2 right)"}
                    </span>
                  </div>
                  <select
                    value={formState.flankBars}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        flankBars: parseInt(e.target.value) || 1,
                      })
                    }
                    className="bg-[#1e222d] border border-[#2a2e39] rounded px-2 py-1 text-xs text-[#f0f3fa] focus:border-[#2962ff] focus:outline-none cursor-pointer"
                  >
                    <option value={1}>3-Bar Swing (Flank: 1)</option>
                    <option value={2}>5-Bar Swing (Flank: 2)</option>
                    <option value={3}>7-Bar Swing (Flank: 3)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex flex-col">
                    <span className="text-[#d1d4dc]">Swing Tag Label Format</span>
                    <span className="text-[10px] text-[#787b86]">
                      {formState.labelType === "SH_SL"
                        ? "Simple Swing High / Swing Low"
                        : "Trend Flow (HH, HL, LH, LL)"}
                    </span>
                  </div>
                  <select
                    value={formState.labelType}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        labelType: e.target.value as any,
                      })
                    }
                    className="bg-[#1e222d] border border-[#2a2e39] rounded px-2 py-1 text-xs text-[#f0f3fa] focus:border-[#2962ff] focus:outline-none cursor-pointer"
                  >
                    <option value="SH_SL">SH / SL</option>
                    <option value="HH_LL">HH / HL / LH / LL</option>
                  </select>
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
                    onClick={() =>
                      setFormState({ ...formState, breakoutConfirmation: "close" })
                    }
                    className={`py-1.5 px-3 rounded border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      formState.breakoutConfirmation === "close"
                        ? "bg-[#2962ff]/15 border-[#2962ff] text-[#2962ff]"
                        : "bg-[#1e222d] border-[#2a2e39] text-[#787b86] hover:text-[#d1d4dc]"
                    }`}
                  >
                    {formState.breakoutConfirmation === "close" && <Check size={12} />}
                    Candle Close (Filter wicks)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormState({ ...formState, breakoutConfirmation: "wick" })
                    }
                    className={`py-1.5 px-3 rounded border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      formState.breakoutConfirmation === "wick"
                        ? "bg-[#2962ff]/15 border-[#2962ff] text-[#2962ff]"
                        : "bg-[#1e222d] border-[#2a2e39] text-[#787b86] hover:text-[#d1d4dc]"
                    }`}
                  >
                    {formState.breakoutConfirmation === "wick" && <Check size={12} />}
                    Candle Wick (Instant)
                  </button>
                </div>
              </div>

              {/* Visibility Switches */}
              <div className="bg-[#131722] p-3 rounded-lg border border-[#2a2e39] space-y-3">
                <div className="text-[11px] font-semibold text-[#787b86] uppercase tracking-wider">
                  Visibility Switches
                </div>

                <div className="flex items-center justify-between py-1 border-b border-[#2a2e39]/50">
                  <div className="flex flex-col">
                    <span className="text-[#f0f3fa] font-medium">Show Candlestick Swings</span>
                    <span className="text-[10px] text-[#787b86]">Pivot high & low candle markers</span>
                  </div>
                  <ToggleSwitch
                    checked={formState.showSwings}
                    onChange={(val) => setFormState({ ...formState, showSwings: val })}
                  />
                </div>

                <div className="flex items-center justify-between py-1 border-b border-[#2a2e39]/50">
                  <div className="flex flex-col">
                    <span className="text-[#f0f3fa] font-medium">Show Swing Text Badges</span>
                    <span className="text-[10px] text-[#787b86]">Labels above/below candles</span>
                  </div>
                  <ToggleSwitch
                    checked={formState.showSwingTags}
                    disabled={!formState.showSwings}
                    onChange={(val) => setFormState({ ...formState, showSwingTags: val })}
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <div className="flex flex-col">
                    <span className="text-[#f0f3fa] font-medium">Show Market Structure Shifts (MSS/BOS)</span>
                    <span className="text-[10px] text-[#787b86]">Horizontal breakout rays and shift badges</span>
                  </div>
                  <ToggleSwitch
                    checked={formState.showBreaks}
                    onChange={(val) => setFormState({ ...formState, showBreaks: val })}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "style" && (
            <div className="space-y-4">
              {/* Swing Markers */}
              <div className="bg-[#131722] p-3 rounded-lg border border-[#2a2e39] space-y-2">
                <div className="text-[11px] font-semibold text-[#787b86] uppercase tracking-wider mb-2">
                  Swing Point Colors
                </div>

                <ColorPickerRow
                  label="Swing High (SH)"
                  tagText="SH"
                  value={formState.swingHighColor}
                  onChange={(c) => setFormState({ ...formState, swingHighColor: c })}
                />
                <ColorPickerRow
                  label="Swing Low (SL)"
                  tagText="SL"
                  value={formState.swingLowColor}
                  onChange={(c) => setFormState({ ...formState, swingLowColor: c })}
                />
              </div>

              {/* Breakout Shifts */}
              <div className="bg-[#131722] p-3 rounded-lg border border-[#2a2e39] space-y-2">
                <div className="text-[11px] font-semibold text-[#787b86] uppercase tracking-wider mb-2">
                  Structure Shift (MSS / BOS) Colors
                </div>

                <ColorPickerRow
                  label="Bullish Breakout (+MSS)"
                  tagText="+MSS"
                  value={formState.bullishMssColor}
                  onChange={(c) => setFormState({ ...formState, bullishMssColor: c })}
                />
                <ColorPickerRow
                  label="Bearish Breakout (-MSS)"
                  tagText="-MSS"
                  value={formState.bearishMssColor}
                  onChange={(e) => setFormState({ ...formState, bearishMssColor: e })}
                />
              </div>

              {/* Line Style */}
              <div className="bg-[#131722] p-3 rounded-lg border border-[#2a2e39] space-y-3">
                <div className="text-[11px] font-semibold text-[#787b86] uppercase tracking-wider">
                  Breakout Line Styling
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between bg-[#1e222d] px-2.5 py-1.5 rounded border border-[#2a2e39]">
                    <span className="text-[11px] text-[#787b86]">Thickness</span>
                    <select
                      value={formState.breakLineWidth}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          breakLineWidth: parseInt(e.target.value) || 1,
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
                      value={formState.breakLineStyle}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          breakLineStyle: e.target.value as any,
                        })
                      }
                      className="bg-transparent text-xs text-[#f0f3fa] focus:outline-none cursor-pointer"
                    >
                      <option value="dashed" className="bg-[#1e222d]">Dashed</option>
                      <option value="dotted" className="bg-[#1e222d]">Dotted</option>
                      <option value="solid" className="bg-[#1e222d]">Solid</option>
                    </select>
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
