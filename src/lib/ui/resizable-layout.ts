/**
 * Resizable layout math for the Right Sidebar and Multi-Chart split panes (DEC-077).
 */
import type { GridLayoutMode } from "@/lib/chart/multi-chart-grid";

export const SIDEBAR_MIN_WIDTH = 260;
export const SIDEBAR_MAX_WIDTH = 560;
export const SIDEBAR_DEFAULT_WIDTH = 320;

export const SCREENER_MIN_HEIGHT = 200;
export const SCREENER_DEFAULT_HEIGHT = 340;
export const SCREENER_MAX_HEIGHT_CAP = 860;

export const SPLIT_MIN_FRACTION = 0.15;
export const SPLIT_MAX_FRACTION = 0.85;

/** Fraction of space given to the first column (left) and first row (top). */
export interface SplitSizes {
  col: number;
  row: number;
}

export type SplitSizesByLayout = Record<GridLayoutMode, SplitSizes>;

export const DEFAULT_SPLIT_SIZES: SplitSizesByLayout = {
  "1x1": { col: 0.5, row: 0.5 },
  "2x1": { col: 0.5, row: 0.5 },
  "1x2": { col: 0.5, row: 0.5 },
  "2x2": { col: 0.5, row: 0.5 },
};

export function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) return SIDEBAR_DEFAULT_WIDTH;
  return Math.round(Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, width)));
}

/**
 * Sidebar is anchored on the right edge, so dragging the handle left (negative delta) widens it.
 */
export function computeSidebarWidthFromDrag(startWidth: number, startX: number, currentX: number): number {
  return clampSidebarWidth(startWidth + (startX - currentX));
}

export function clampScreenerHeight(height: number, maxAllowed = SCREENER_MAX_HEIGHT_CAP): number {
  if (!Number.isFinite(height)) return SCREENER_DEFAULT_HEIGHT;
  const effectiveMax = Math.max(SCREENER_MIN_HEIGHT + 50, maxAllowed);
  return Math.round(Math.max(SCREENER_MIN_HEIGHT, Math.min(effectiveMax, height)));
}

/**
 * Screener drawer is anchored at the bottom of the Center Workspace,
 * so dragging the top handle upward (decreasing pointer Y, startY - currentY > 0) increases height.
 */
export function computeScreenerHeightFromDrag(
  startHeight: number,
  startY: number,
  currentY: number,
  maxAllowed = SCREENER_MAX_HEIGHT_CAP
): number {
  return clampScreenerHeight(startHeight + (startY - currentY), maxAllowed);
}

export function clampSplitFraction(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0.5;
  return Math.max(SPLIT_MIN_FRACTION, Math.min(SPLIT_MAX_FRACTION, fraction));
}

/** Converts a pointer position inside a container into a clamped split fraction. */
export function computeSplitFraction(pointerPos: number, containerStart: number, containerSize: number): number {
  if (containerSize <= 0) return 0.5;
  return clampSplitFraction((pointerPos - containerStart) / containerSize);
}

export function buildGridTemplate(mode: GridLayoutMode, sizes: SplitSizes, maximized: boolean) {
  const col = clampSplitFraction(sizes.col);
  const row = clampSplitFraction(sizes.row);
  const cols = `${col}fr ${1 - col}fr`;
  const rows = `${row}fr ${1 - row}fr`;
  if (maximized || mode === "1x1") return { columns: "1fr", rows: "1fr" };
  if (mode === "2x1") return { columns: cols, rows: "1fr" };
  if (mode === "1x2") return { columns: "1fr", rows: rows };
  return { columns: cols, rows: rows };
}

/** Safely parses persisted split sizes, falling back to defaults for invalid entries. */
export function parseSplitSizes(raw: string | null): SplitSizesByLayout {
  const result: SplitSizesByLayout = {
    "1x1": { ...DEFAULT_SPLIT_SIZES["1x1"] },
    "2x1": { ...DEFAULT_SPLIT_SIZES["2x1"] },
    "1x2": { ...DEFAULT_SPLIT_SIZES["1x2"] },
    "2x2": { ...DEFAULT_SPLIT_SIZES["2x2"] },
  };
  if (!raw) return result;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<GridLayoutMode, Partial<SplitSizes>>>;
    (Object.keys(result) as GridLayoutMode[]).forEach((mode) => {
      const entry = parsed?.[mode];
      if (entry) {
        result[mode] = {
          col: clampSplitFraction(Number(entry.col ?? 0.5)),
          row: clampSplitFraction(Number(entry.row ?? 0.5)),
        };
      }
    });
  } catch {
    // ignore malformed storage
  }
  return result;
}
