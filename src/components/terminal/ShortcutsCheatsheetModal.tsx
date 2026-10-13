"use client";

import React from "react";
import { Keyboard, X } from "lucide-react";
import { SHORTCUT_CHEATSHEET, EXISTING_SHORTCUTS } from "@/lib/ui/keyboard-shortcuts";

interface ShortcutsCheatsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsCheatsheetModal({ isOpen, onClose }: ShortcutsCheatsheetModalProps) {
  if (!isOpen) return null;

  const allItems = [
    ...SHORTCUT_CHEATSHEET.map((s) => ({ keys: s.keys, label: s.label, category: s.category })),
    ...EXISTING_SHORTCUTS,
  ];

  const categories = ["Chart", "Drawing", "Alerts", "Workspace", "Replay", "Help"] as const;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-[#12161f] border border-outline-variant/50 shadow-2xl overflow-hidden font-mono text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/30 bg-[#161a25]">
          <div className="flex items-center gap-2">
            <Keyboard size={15} className="text-primary" />
            <span className="font-bold text-sm text-white tracking-tight">
              TradingView Keyboard Shortcuts
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-muted hover:text-white hover:bg-surface-container cursor-pointer"
            title="Close (Esc)"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto grid grid-cols-1 gap-3">
          {categories.map((cat) => {
            const items = allItems.filter((item) => item.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-primary font-bold">
                  {cat}
                </span>
                <div className="bg-surface-container-lowest/80 border border-outline-variant/25 rounded-lg divide-y divide-outline-variant/15">
                  {items.map((item) => (
                    <div
                      key={item.keys}
                      className="flex items-center justify-between px-3 py-1.5 text-[11px]"
                    >
                      <span className="text-on-surface">{item.label}</span>
                      <kbd className="px-2 py-0.5 rounded bg-[#1a2030] border border-outline-variant/40 text-cyan font-bold text-[10px]">
                        {item.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-2.5 border-t border-outline-variant/30 bg-[#161a25] flex items-center justify-between text-[10px] text-muted">
          <span>Shortcuts target the focused (blue-bordered) chart pane</span>
          <span>Double-click any resize divider to reset</span>
        </div>
      </div>
    </div>
  );
}
