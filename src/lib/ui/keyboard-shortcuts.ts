/**
 * TradingView-style keyboard shortcut registry (DEC-077).
 *
 * Shortcuts are matched on `KeyboardEvent.code` (physical key) rather than `key`,
 * because on macOS the Option/Alt modifier changes `key` into special characters
 * (e.g. Alt+R -> "®").
 */

export type ChartShortcutAction =
  | "reset_view"
  | "horizontal_line"
  | "trendline"
  | "fibonacci"
  | "create_alert"
  | "invert_scale"
  | "show_cheatsheet";

export interface ShortcutDefinition {
  action: ChartShortcutAction;
  keys: string; // human readable label
  label: string;
  category: "Chart" | "Drawing" | "Alerts" | "Workspace" | "Replay" | "Help";
}

export interface ShortcutKeyInput {
  code: string;
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

const ALT_CODE_MAP: Record<string, ChartShortcutAction> = {
  KeyR: "reset_view",
  KeyH: "horizontal_line",
  KeyT: "trendline",
  KeyF: "fibonacci",
  KeyA: "create_alert",
  KeyI: "invert_scale",
};

/**
 * Resolves a keyboard event to a chart shortcut action, or null when it is not a shortcut.
 */
export function matchChartShortcut(e: ShortcutKeyInput): ChartShortcutAction | null {
  if (e.ctrlKey || e.metaKey) return null;

  if (e.altKey && !e.shiftKey) {
    return ALT_CODE_MAP[e.code] ?? null;
  }

  if (!e.altKey && e.key === "?") {
    return "show_cheatsheet";
  }

  return null;
}

/**
 * Returns true when keyboard focus is inside a text-entry surface (inputs, textareas,
 * selects, contentEditable regions, or the Monaco editor), where shortcuts must be ignored.
 */
export function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  if (typeof (el as HTMLElement).closest === "function" && (el as HTMLElement).closest(".monaco-editor")) {
    return true;
  }
  return false;
}

/** Full cheatsheet listing (chart actions + existing workstation shortcuts). */
export const SHORTCUT_CHEATSHEET: ShortcutDefinition[] = [
  { action: "reset_view", keys: "Alt + R", label: "Reset chart view (auto-scale + jump to latest)", category: "Chart" },
  { action: "invert_scale", keys: "Alt + I", label: "Invert price scale", category: "Chart" },
  { action: "horizontal_line", keys: "Alt + H", label: "Drop horizontal line at cursor price", category: "Drawing" },
  { action: "trendline", keys: "Alt + T", label: "Activate Trendline tool", category: "Drawing" },
  { action: "fibonacci", keys: "Alt + F", label: "Activate Fib Retracement tool", category: "Drawing" },
  { action: "create_alert", keys: "Alt + A", label: "Create alert (selected drawing or cursor price)", category: "Alerts" },
  { action: "show_cheatsheet", keys: "?", label: "Show this shortcut cheatsheet", category: "Help" },
];

/** Existing shortcuts documented in the cheatsheet but handled elsewhere. */
export const EXISTING_SHORTCUTS: Array<{ keys: string; label: string; category: ShortcutDefinition["category"] }> = [
  { keys: "Ctrl + Z", label: "Undo drawing change", category: "Drawing" },
  { keys: "Ctrl + Y / Ctrl + Shift + Z", label: "Redo drawing change", category: "Drawing" },
  { keys: "Ctrl + D", label: "Clone selected drawing", category: "Drawing" },
  { keys: "Delete / Backspace", label: "Remove selected drawing", category: "Drawing" },
  { keys: "Esc", label: "Cancel drawing / deselect", category: "Drawing" },
  { keys: "Alt + Enter", label: "Maximize / restore focused split pane", category: "Workspace" },
  { keys: "Space", label: "Play / pause Bar Replay", category: "Replay" },
  { keys: "← / →", label: "Step Bar Replay backward / forward", category: "Replay" },
];
