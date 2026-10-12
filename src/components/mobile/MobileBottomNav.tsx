"use client";

import React from "react";
import {
  CandlestickChart,
  Star,
  Layers,
  Pencil,
  Code2,
} from "lucide-react";

interface MobileBottomNavProps {
  activeScreen: "chart" | "watchlist" | "depth" | "draw" | "studio";
  onSelectScreen: (screen: "chart" | "watchlist" | "depth" | "draw" | "studio") => void;
}

export function MobileBottomNav({
  activeScreen,
  onSelectScreen,
}: MobileBottomNavProps) {
  const navItems = [
    { id: "chart", label: "Chart", icon: <CandlestickChart size={18} /> },
    { id: "watchlist", label: "Watchlist", icon: <Star size={18} /> },
    { id: "depth", label: "Depth", icon: <Layers size={18} /> },
    { id: "draw", label: "Draw", icon: <Pencil size={18} /> },
    { id: "studio", label: "Studio", icon: <Code2 size={18} /> },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-12 bg-surface-container-lowest border-t border-border flex items-center justify-around select-none z-40 md:hidden px-2">
      {navItems.map((item) => {
        const isActive = activeScreen === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectScreen(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded text-[10px] font-mono transition-colors ${
              isActive
                ? "text-primary-container font-bold"
                : "text-muted hover:text-on-surface"
            }`}
          >
            {item.icon}
            <span className="mt-0.5">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
