import { CandlestickBar } from "@/lib/mexc/types";

export interface CandleSwingPoint {
  id: string;
  type: "HIGH" | "LOW";
  price: number;
  time: number;
  barIndex: number;
  tag: "SH" | "SL" | "HH" | "LH" | "HL" | "LL";
}

export interface CandleStructureBreak {
  id: string;
  type: "MSS" | "BOS";
  direction: "BULLISH" | "BEARISH";
  level: number;
  fromTime: number;
  toTime: number;
  fromIndex: number;
  toIndex: number;
}

export interface CandleStructureSettings {
  flankBars: number; // 1 = 3-bar swing (flanked by 1 bar on each side), 2 = 5-bar swing
  breakoutConfirmation: "close" | "wick";
  showSwings: boolean;
  showBreaks: boolean;
  showSwingTags: boolean;
  labelType: "SH_SL" | "HH_LL";

  // Colors & Styles
  swingHighColor: string;
  swingLowColor: string;
  bullishMssColor: string;
  bearishMssColor: string;
  breakLineWidth: number;
  breakLineStyle: "solid" | "dashed" | "dotted";
}

export const DEFAULT_CANDLE_STRUCTURE_SETTINGS: CandleStructureSettings = {
  flankBars: 1, // 3-bar candlestick structure
  breakoutConfirmation: "close",
  showSwings: true,
  showBreaks: true,
  showSwingTags: true,
  labelType: "SH_SL",

  swingHighColor: "#00c087",
  swingLowColor: "#ff3b30",
  bullishMssColor: "#00e676",
  bearishMssColor: "#ff5252",
  breakLineWidth: 1,
  breakLineStyle: "dashed",
};

export const CANDLE_STRUCTURE_SETTINGS_STORAGE_KEY = "mochex:candle_structure_settings";

export function getStoredCandleStructureSettings(): CandleStructureSettings {
  if (typeof window === "undefined" && typeof localStorage === "undefined") {
    return { ...DEFAULT_CANDLE_STRUCTURE_SETTINGS };
  }
  try {
    const raw = localStorage.getItem(CANDLE_STRUCTURE_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CANDLE_STRUCTURE_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CANDLE_STRUCTURE_SETTINGS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_CANDLE_STRUCTURE_SETTINGS };
  }
}

export function saveCandleStructureSettings(
  settings: Partial<CandleStructureSettings>
): CandleStructureSettings {
  const current = getStoredCandleStructureSettings();
  const updated: CandleStructureSettings = {
    ...current,
    ...settings,
  };
  if (typeof window !== "undefined" || typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(
        CANDLE_STRUCTURE_SETTINGS_STORAGE_KEY,
        JSON.stringify(updated)
      );
    } catch {
      // storage unavailable
    }
  }
  return updated;
}

export interface CandleStructureResult {
  swings: CandleSwingPoint[];
  breaks: CandleStructureBreak[];
}

/**
 * Computes 3-bar (or N-bar) Candlestick Swings and Candle-Close Market Structure Shifts (MSS/BOS).
 */
export function computeCandleMarketStructure(
  bars: CandlestickBar[],
  settings: Partial<CandleStructureSettings> = {}
): CandleStructureResult {
  const cfg: CandleStructureSettings = {
    ...DEFAULT_CANDLE_STRUCTURE_SETTINGS,
    ...settings,
  };

  if (!bars || bars.length < 3) {
    return { swings: [], breaks: [] };
  }

  const flank = Math.max(1, cfg.flankBars);
  const rawSwings: CandleSwingPoint[] = [];

  let prevHighPrice: number | null = null;
  let prevLowPrice: number | null = null;

  // 1. Identify Candlestick Swings (e.g. 3-bar swing where bar[i] is higher/lower than neighbors)
  for (let i = flank; i < bars.length - flank; i++) {
    const current = bars[i];
    let isHigh = true;
    let isLow = true;

    for (let k = 1; k <= flank; k++) {
      if (bars[i - k].high >= current.high || bars[i + k].high > current.high) {
        isHigh = false;
      }
      if (bars[i - k].low <= current.low || bars[i + k].low < current.low) {
        isLow = false;
      }
    }

    if (isHigh) {
      const tag =
        cfg.labelType === "HH_LL"
          ? prevHighPrice === null || current.high >= prevHighPrice
            ? "HH"
            : "LH"
          : "SH";
      prevHighPrice = current.high;

      rawSwings.push({
        id: `c-sh-${i}-${current.time}`,
        type: "HIGH",
        price: current.high,
        time: current.time,
        barIndex: i,
        tag,
      });
    }

    if (isLow) {
      const tag =
        cfg.labelType === "HH_LL"
          ? prevLowPrice === null || current.low <= prevLowPrice
            ? "LL"
            : "HL"
          : "SL";
      prevLowPrice = current.low;

      rawSwings.push({
        id: `c-sl-${i}-${current.time}`,
        type: "LOW",
        price: current.low,
        time: current.time,
        barIndex: i,
        tag,
      });
    }
  }

  // Sort chronologically by bar index
  const swings = rawSwings.sort((a, b) => a.barIndex - b.barIndex);

  // 2. Detect Market Structure Shifts (MSS) & Break of Structure (BOS)
  const breaks: CandleStructureBreak[] = [];
  let currentTrend: "BULLISH" | "BEARISH" | null = null;

  let activeSwingHigh: CandleSwingPoint | null = null;
  let activeSwingLow: CandleSwingPoint | null = null;
  let swingIdx = 0;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];

    // Activate confirmed swings up to this bar
    while (swingIdx < swings.length && swings[swingIdx].barIndex + flank <= i) {
      const sw = swings[swingIdx];
      if (sw.type === "HIGH") {
        activeSwingHigh = sw;
      } else {
        activeSwingLow = sw;
      }
      swingIdx++;
    }

    // Check Bullish Structure Shift / Breakout above active swing high
    if (activeSwingHigh && i > activeSwingHigh.barIndex) {
      const isBroken =
        cfg.breakoutConfirmation === "close"
          ? bar.close > activeSwingHigh.price
          : bar.high > activeSwingHigh.price;

      if (isBroken) {
        // If prior trend was BEARISH or null, breaking high is an MSS (Change of trend)
        // If prior trend was already BULLISH, this is a BOS (Trend continuation)
        const type: "MSS" | "BOS" = currentTrend === "BULLISH" ? "BOS" : "MSS";
        currentTrend = "BULLISH";

        breaks.push({
          id: `c-mss-bull-${i}-${activeSwingHigh.time}`,
          type,
          direction: "BULLISH",
          level: activeSwingHigh.price,
          fromTime: activeSwingHigh.time,
          toTime: bar.time,
          fromIndex: activeSwingHigh.barIndex,
          toIndex: i,
        });

        // Clear active high so it triggers once per structure level
        activeSwingHigh = null;
      }
    }

    // Check Bearish Structure Shift / Breakout below active swing low
    if (activeSwingLow && i > activeSwingLow.barIndex) {
      const isBroken =
        cfg.breakoutConfirmation === "close"
          ? bar.close < activeSwingLow.price
          : bar.low < activeSwingLow.price;

      if (isBroken) {
        // If prior trend was BULLISH or null, breaking low is an MSS (reversal)
        // If prior trend was already BEARISH, this is a BOS (continuation)
        const type: "MSS" | "BOS" = currentTrend === "BEARISH" ? "BOS" : "MSS";
        currentTrend = "BEARISH";

        breaks.push({
          id: `c-mss-bear-${i}-${activeSwingLow.time}`,
          type,
          direction: "BEARISH",
          level: activeSwingLow.price,
          fromTime: activeSwingLow.time,
          toTime: bar.time,
          fromIndex: activeSwingLow.barIndex,
          toIndex: i,
        });

        // Clear active low
        activeSwingLow = null;
      }
    }
  }

  return {
    swings: cfg.showSwings ? swings : [],
    breaks: cfg.showBreaks ? breaks : [],
  };
}
