import { CandlestickBar } from "@/lib/mexc/types";

export interface SwingPoint {
  id: string;
  type: "HIGH" | "LOW";
  price: number;
  time: number;
  barIndex: number;
  tag: "HH" | "LH" | "HL" | "LL";
  isSubstructure: boolean;
}

export interface MarketBreakout {
  id: string;
  type: "BOS" | "CHOCH";
  direction: "BULLISH" | "BEARISH";
  level: number;
  fromTime: number;
  toTime: number;
  fromIndex: number;
  toIndex: number;
  isSubstructure: boolean;
}

export interface MarketStructureSettings {
  majorLength: number;
  subLength: number;
  confirmation: "close" | "wick";
  showMajor: boolean;
  showSubstructure: boolean;
  showBOS: boolean;
  showCHOCH: boolean;
  showSwingLabels: boolean;

  // Style attributes
  majorColor: string;
  majorLineWidth: number;
  majorLineStyle: "solid" | "dashed" | "dotted";

  subColor: string;
  subLineWidth: number;
  subLineStyle: "solid" | "dashed" | "dotted";

  bullishColor: string;
  bearishColor: string;
}

export const DEFAULT_MARKET_STRUCTURE_SETTINGS: MarketStructureSettings = {
  majorLength: 10,
  subLength: 4,
  confirmation: "close",
  showMajor: true,
  showSubstructure: true,
  showBOS: true,
  showCHOCH: true,
  showSwingLabels: true,

  majorColor: "#2962ff",
  majorLineWidth: 2,
  majorLineStyle: "solid",

  subColor: "#787b86",
  subLineWidth: 1,
  subLineStyle: "dotted",

  bullishColor: "#089981",
  bearishColor: "#f23645",
};

export const MARKET_STRUCTURE_SETTINGS_STORAGE_KEY = "mochex:market_structure_settings";

export function getStoredMarketStructureSettings(): MarketStructureSettings {
  if (typeof window === "undefined" && typeof localStorage === "undefined") {
    return { ...DEFAULT_MARKET_STRUCTURE_SETTINGS };
  }
  try {
    const raw = localStorage.getItem(MARKET_STRUCTURE_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MARKET_STRUCTURE_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_MARKET_STRUCTURE_SETTINGS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_MARKET_STRUCTURE_SETTINGS };
  }
}

export function saveMarketStructureSettings(
  settings: Partial<MarketStructureSettings>
): MarketStructureSettings {
  const current = getStoredMarketStructureSettings();
  const updated: MarketStructureSettings = {
    ...current,
    ...settings,
  };
  if (typeof window !== "undefined" || typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(
        MARKET_STRUCTURE_SETTINGS_STORAGE_KEY,
        JSON.stringify(updated)
      );
    } catch {
      // storage unavailable
    }
  }
  return updated;
}

/**
 * Calculates raw pivot highs and lows using a left/right lookback window.
 */
function findPivots(
  bars: CandlestickBar[],
  length: number
): Array<{ type: "HIGH" | "LOW"; price: number; time: number; barIndex: number }> {
  const pivots: Array<{
    type: "HIGH" | "LOW";
    price: number;
    time: number;
    barIndex: number;
  }> = [];

  if (bars.length < length * 2 + 1) return pivots;

  for (let i = length; i < bars.length - length; i++) {
    const current = bars[i];
    let isHigh = true;
    let isLow = true;

    for (let k = 1; k <= length; k++) {
      if (bars[i - k].high >= current.high || bars[i + k].high > current.high) {
        isHigh = false;
      }
      if (bars[i - k].low <= current.low || bars[i + k].low < current.low) {
        isLow = false;
      }
    }

    if (isHigh) {
      pivots.push({
        type: "HIGH",
        price: current.high,
        time: current.time,
        barIndex: i,
      });
    }
    if (isLow) {
      pivots.push({
        type: "LOW",
        price: current.low,
        time: current.time,
        barIndex: i,
      });
    }
  }

  // Sort by barIndex ascending
  return pivots.sort((a, b) => a.barIndex - b.barIndex);
}

/**
 * Filters raw pivots into an alternating ZigZag series (High, Low, High, Low...)
 * and assigns structural tags: HH, LH, HL, LL.
 */
function buildAlternatingSwings(
  rawPivots: Array<{ type: "HIGH" | "LOW"; price: number; time: number; barIndex: number }>,
  isSubstructure: boolean
): SwingPoint[] {
  if (rawPivots.length === 0) return [];

  const alternating: Array<{
    type: "HIGH" | "LOW";
    price: number;
    time: number;
    barIndex: number;
  }> = [];

  for (const p of rawPivots) {
    if (alternating.length === 0) {
      alternating.push(p);
      continue;
    }

    const last = alternating[alternating.length - 1];
    if (last.type === p.type) {
      // Same type consecutive: keep the more extreme one
      if (p.type === "HIGH" && p.price > last.price) {
        alternating[alternating.length - 1] = p;
      } else if (p.type === "LOW" && p.price < last.price) {
        alternating[alternating.length - 1] = p;
      }
    } else {
      alternating.push(p);
    }
  }

  // Tag swings with HH, LH, HL, LL
  let prevHigh: number | null = null;
  let prevLow: number | null = null;
  const swings: SwingPoint[] = [];

  for (const s of alternating) {
    let tag: "HH" | "LH" | "HL" | "LL";
    if (s.type === "HIGH") {
      tag = prevHigh === null || s.price >= prevHigh ? "HH" : "LH";
      prevHigh = s.price;
    } else {
      tag = prevLow === null || s.price <= prevLow ? "LL" : "HL";
      prevLow = s.price;
    }

    swings.push({
      id: `${isSubstructure ? "sub" : "maj"}-${s.type.toLowerCase()}-${s.barIndex}-${s.time}`,
      type: s.type,
      price: s.price,
      time: s.time,
      barIndex: s.barIndex,
      tag,
      isSubstructure,
    });
  }

  return swings;
}

/**
 * Detects BOS (Break of Structure) and CHoCH (Change of Character) breakouts against swings.
 */
function detectBreakouts(
  bars: CandlestickBar[],
  swings: SwingPoint[],
  confirmation: "close" | "wick",
  isSubstructure: boolean
): MarketBreakout[] {
  const breakouts: MarketBreakout[] = [];
  if (swings.length === 0 || bars.length === 0) return breakouts;

  let currentTrend: "BULLISH" | "BEARISH" | null = null;

  // Track active unbroken swings
  let activeSwingHigh: SwingPoint | null = null;
  let activeSwingLow: SwingPoint | null = null;

  let swingIdx = 0;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];

    // Check if new swings are confirmed up to this bar
    while (swingIdx < swings.length && swings[swingIdx].barIndex <= i) {
      const sw = swings[swingIdx];
      if (sw.type === "HIGH") {
        activeSwingHigh = sw;
      } else {
        activeSwingLow = sw;
      }
      swingIdx++;
    }

    // 1. Check Bullish Breakout above active swing high
    if (activeSwingHigh && i > activeSwingHigh.barIndex) {
      const isBroken =
        confirmation === "close"
          ? bar.close > activeSwingHigh.price
          : bar.high > activeSwingHigh.price;

      if (isBroken) {
        const isBOS = currentTrend === "BULLISH";
        const type: "BOS" | "CHOCH" = isBOS ? "BOS" : "CHOCH";
        currentTrend = "BULLISH";

        breakouts.push({
          id: `${isSubstructure ? "sub" : "maj"}-${type.toLowerCase()}-bull-${i}-${activeSwingHigh.time}`,
          type,
          direction: "BULLISH",
          level: activeSwingHigh.price,
          fromTime: activeSwingHigh.time,
          toTime: bar.time,
          fromIndex: activeSwingHigh.barIndex,
          toIndex: i,
          isSubstructure,
        });

        // Swing high is now broken, clear so it doesn't trigger multiple times
        activeSwingHigh = null;
      }
    }

    // 2. Check Bearish Breakout below active swing low
    if (activeSwingLow && i > activeSwingLow.barIndex) {
      const isBroken =
        confirmation === "close"
          ? bar.close < activeSwingLow.price
          : bar.low < activeSwingLow.price;

      if (isBroken) {
        const isBOS = currentTrend === "BEARISH";
        const type: "BOS" | "CHOCH" = isBOS ? "BOS" : "CHOCH";
        currentTrend = "BEARISH";

        breakouts.push({
          id: `${isSubstructure ? "sub" : "maj"}-${type.toLowerCase()}-bear-${i}-${activeSwingLow.time}`,
          type,
          direction: "BEARISH",
          level: activeSwingLow.price,
          fromTime: activeSwingLow.time,
          toTime: bar.time,
          fromIndex: activeSwingLow.barIndex,
          toIndex: i,
          isSubstructure,
        });

        // Swing low is now broken, clear
        activeSwingLow = null;
      }
    }
  }

  return breakouts;
}

export interface MarketStructureResult {
  majorSwings: SwingPoint[];
  subSwings: SwingPoint[];
  breakouts: MarketBreakout[];
}

/**
 * Computes True Market Structure and Substructure for a given candlestick dataset and settings.
 */
export function computeMarketStructure(
  bars: CandlestickBar[],
  settings: Partial<MarketStructureSettings> = {}
): MarketStructureResult {
  const cfg: MarketStructureSettings = {
    ...DEFAULT_MARKET_STRUCTURE_SETTINGS,
    ...settings,
  };

  if (!bars || bars.length === 0) {
    return { majorSwings: [], subSwings: [], breakouts: [] };
  }

  // 1. Major Structure
  let majorSwings: SwingPoint[] = [];
  let majorBreakouts: MarketBreakout[] = [];
  if (cfg.showMajor) {
    const rawMajorPivots = findPivots(bars, Math.max(2, cfg.majorLength));
    majorSwings = buildAlternatingSwings(rawMajorPivots, false);
    majorBreakouts = detectBreakouts(bars, majorSwings, cfg.confirmation, false);
  }

  // 2. Substructure (Internal Structure)
  let subSwings: SwingPoint[] = [];
  let subBreakouts: MarketBreakout[] = [];
  if (cfg.showSubstructure) {
    const rawSubPivots = findPivots(bars, Math.max(1, cfg.subLength));
    subSwings = buildAlternatingSwings(rawSubPivots, true);
    subBreakouts = detectBreakouts(bars, subSwings, cfg.confirmation, true);
  }

  // Combine and filter breakouts based on user toggles
  const allBreakouts = [...majorBreakouts, ...subBreakouts].filter((b) => {
    if (b.type === "BOS" && !cfg.showBOS) return false;
    if (b.type === "CHOCH" && !cfg.showCHOCH) return false;
    return true;
  });

  return {
    majorSwings,
    subSwings,
    breakouts: allBreakouts,
  };
}
