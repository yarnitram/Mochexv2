"use client";

import React, { useState } from "react";
import {
  Crosshair,
  TrendingUp,
  Sliders,
  Brush,
  Type,
  Maximize2,
  Ruler,
  Magnet,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";

export type DrawingToolType =
  | "crosshair"
  | "trendline"
  | "fibonacci"
  | "brush"
  | "text"
  | "position"
  | "ruler"
  | "none";

interface DrawingRailProps {
  activeTool: DrawingToolType;
  onSelectTool: (tool: DrawingToolType) => void;
  onClearAll?: () => void;
}

export function DrawingRail({
  activeTool,
  onSelectTool,
  onClearAll,
}: DrawingRailProps) {
  const [isLocked, setIsLocked] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isMagnetActive, setIsMagnetActive] = useState(true);

  const tools: Array<{ id: DrawingToolType; label: string; icon: React.ReactNode }> = [
    { id: "crosshair", label: "Crosshair (C)", icon: <Crosshair size={16} /> },
    { id: "trendline", label: "Trendline Tool (T)", icon: <TrendingUp size={16} /> },
    { id: "fibonacci", label: "Fibonacci Retracement (F)", icon: <Sliders size={16} /> },
    { id: "brush", label: "Brush & Freehand (B)", icon: <Brush size={16} /> },
    { id: "text", label: "Text Annotation (A)", icon: <Type size={16} /> },
    { id: "position", label: "Long / Short Position (P)", icon: <Maximize2 size={16} /> },
    { id: "ruler", label: "Price / Bar Measure (M)", icon: <Ruler size={16} /> },
  ];

  return (
    <aside className="w-12 bg-surface-container-lowest border-r border-border flex flex-col items-center py-2 justify-between select-none shrink-0 z-20">
      {/* Primary Drawing Utilities */}
      <div className="flex flex-col items-center gap-1 w-full px-1.5">
        {tools.map((t) => {
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelectTool(isActive ? "none" : t.id)}
              title={t.label}
              className={`w-9 h-9 rounded flex items-center justify-center transition-colors relative group ${
                isActive
                  ? "bg-primary-container text-white shadow-xs"
                  : "text-muted hover:text-on-surface hover:bg-surface-container"
              }`}
            >
              {t.icon}
            </button>
          );
        })}
      </div>

      {/* Auxiliary Chart Modifiers (Magnet, Lock, Eye, Trash) */}
      <div className="flex flex-col items-center gap-1 w-full px-1.5 border-t border-border pt-2">
        {/* Magnet Mode */}
        <button
          onClick={() => setIsMagnetActive(!isMagnetActive)}
          title={`Magnet Mode: ${isMagnetActive ? "ON (Snaps to OHLC)" : "OFF"}`}
          className={`w-9 h-9 rounded flex items-center justify-center transition-colors ${
            isMagnetActive
              ? "text-cyan bg-cyan/10"
              : "text-muted hover:text-on-surface hover:bg-surface-container"
          }`}
        >
          <Magnet size={16} />
        </button>

        {/* Lock Drawings */}
        <button
          onClick={() => setIsLocked(!isLocked)}
          title={isLocked ? "Unlock All Drawings" : "Lock All Drawings"}
          className={`w-9 h-9 rounded flex items-center justify-center transition-colors ${
            isLocked
              ? "text-gold bg-gold/10"
              : "text-muted hover:text-on-surface hover:bg-surface-container"
          }`}
        >
          {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
        </button>

        {/* Hide Drawings */}
        <button
          onClick={() => setIsHidden(!isHidden)}
          title={isHidden ? "Unhide Drawings" : "Hide Drawings"}
          className={`w-9 h-9 rounded flex items-center justify-center transition-colors ${
            isHidden
              ? "text-error bg-error/10"
              : "text-muted hover:text-on-surface hover:bg-surface-container"
          }`}
        >
          {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>

        {/* Clear All Drawings */}
        <button
          onClick={onClearAll}
          title="Clear All Canvas Drawings"
          className="w-9 h-9 rounded flex items-center justify-center text-muted hover:text-tertiary hover:bg-surface-container transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </aside>
  );
}
