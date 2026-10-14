/**
 * Custom Script Persistence & Management Store
 * Handles localStorage persistence for user-created custom indicators and strategies in Mochex.
 */

export interface CustomScript {
  id: string;
  name: string;
  description: string;
  code: string;
  type: "indicator" | "strategy";
  createdAt: number;
  updatedAt: number;
  color?: string;
  isPublished?: boolean;
}

const STORAGE_KEY = "mochex:custom_scripts";
const DRAFT_KEY = "mochex:script_studio_draft";

export const DEFAULT_STARTER_SCRIPT = `/**
 * Custom Technical Analysis Indicator
 * @param {Array} bars - Candlestick dataset [{ time, open, high, low, close, volume }]
 * @param {Object} inputs - User configurable parameters
 * @param {Object} ta - Technical analysis library (ta.rsi, ta.sma, ta.ema, ta.macd, ta.atr)
 * @param {Object} strategy - Pine-style strategy tester (strategy.at(i).entry, exit, close)
 * @param {Function} alertcondition - Real-time alert emitter
 */
function calculate(bars, inputs, ta, strategy, alertcondition) {
  const period = inputs.period || 20;
  const closes = bars.map(b => b.close);
  const ema = ta.ema(closes, period);

  // Return points to render as an overlay line on the chart
  return bars.map((bar, i) => ({
    time: bar.time,
    value: ema[i] !== undefined ? ema[i] : bar.close
  }));
}`;

export const DEFAULT_FVG_SCRIPT = `/**
 * Mochex Custom Indicator: Unmitigated Fair Value Gaps (0% Wick Touch)
 * Plots 0% mitigated FVG levels and emits alerts on newly formed gaps.
 */
function calculate(bars, inputs, ta, strategy, alertcondition) {
  const showMidLine = inputs.showMidLine !== undefined ? inputs.showMidLine : true;
  const minGapPct = inputs.minGapPct || 0.05;

  const activeFvgs = [];
  const fvgPlotSeries = new Array(bars.length).fill(null);

  for (let i = 2; i < bars.length; i++) {
    const c1 = bars[i - 2];
    const c2 = bars[i - 1];
    const c3 = bars[i];

    // 1. Bullish FVG: Candle 1 High < Candle 3 Low
    if (c3.low > c1.high) {
      const top = c3.low;
      const bottom = c1.high;
      const gapPct = ((top - bottom) / bottom) * 100;

      if (gapPct >= minGapPct) {
        activeFvgs.push({
          id: "bull-" + i,
          type: "BULLISH",
          createdIndex: i,
          startTime: c1.time,
          endTime: bars[bars.length - 1].time,
          top: top,
          bottom: bottom,
          mid: (top + bottom) / 2,
          color: "#00c087",
          fillColor: "rgba(0, 192, 135, 0.18)",
          label: "Bull FVG",
          showMidLine: true,
        });

        if (typeof alertcondition === "function" && i === bars.length - 1) {
          alertcondition(true, "New Bullish FVG", "Unmitigated Bullish FVG formed at " + bottom.toFixed(2) + " - " + top.toFixed(2));
        }
      }
    }

    // 2. Bearish FVG: Candle 1 Low > Candle 3 High
    if (c3.high < c1.low) {
      const top = c1.low;
      const bottom = c3.high;
      const gapPct = ((top - bottom) / bottom) * 100;

      if (gapPct >= minGapPct) {
        activeFvgs.push({
          id: "bear-" + i,
          type: "BEARISH",
          createdIndex: i,
          startTime: c1.time,
          endTime: bars[bars.length - 1].time,
          top: top,
          bottom: bottom,
          mid: (top + bottom) / 2,
          color: "#ff3b30",
          fillColor: "rgba(255, 59, 48, 0.18)",
          label: "Bear FVG",
          showMidLine: true,
        });

        if (typeof alertcondition === "function" && i === bars.length - 1) {
          alertcondition(true, "New Bearish FVG", "Unmitigated Bearish FVG formed at " + bottom.toFixed(2) + " - " + top.toFixed(2));
        }
      }
    }

    // 3. Strict 0% Wick Touch Mitigation
    for (let f = activeFvgs.length - 1; f >= 0; f--) {
      const fvg = activeFvgs[f];
      if (i > fvg.createdIndex) {
        if ((fvg.type === "BULLISH" && c3.low <= fvg.top) ||
            (fvg.type === "BEARISH" && c3.high >= fvg.bottom)) {
          activeFvgs.splice(f, 1);
        }
      }
    }
  }

  // Extend all active unmitigated zones to current live bar
  const latestTime = bars[bars.length - 1].time;
  for (const fvg of activeFvgs) {
    fvg.endTime = latestTime;
  }

  // Return both colored boxes and plotted midline series
  return {
    boxes: activeFvgs,
    data: bars.map((bar) => {
      const active = activeFvgs.find((f) => bar.time >= f.startTime && bar.time <= f.endTime);
      return {
        time: bar.time,
        value: active ? active.mid : bar.close,
      };
    }),
  };
}`;

export const DEFAULT_OB_SCRIPT = `/**
 * Mochex Custom Indicator: Institutional Order Blocks (OB)
 * Identifies high-volume baseline candles before expansion moves with 50% Mean Threshold.
 */
function calculate(bars, inputs, ta, strategy, alertcondition) {
  const lookback = inputs.lookback || 3;
  const volMultiplier = inputs.volMultiplier || 1.1; // Volume multiplier (1.1x 20-period avg)
  const minBodyPct = inputs.minBodyPct || 0.0015; // Minimum candle body size (0.15%)

  const activeObs = [];

  function getAvgVol(endIdx, len = 20) {
    let sum = 0;
    let count = 0;
    for (let k = Math.max(0, endIdx - len + 1); k <= endIdx; k++) {
      sum += bars[k].volume || 1;
      count++;
    }
    return sum / (count || 1);
  }

  for (let i = lookback + 1; i < bars.length; i++) {
    const obCandle = bars[i - lookback];
    const avgVol = getAvgVol(i - lookback - 1, 20);
    const hasVolume = (obCandle.volume || 1) >= avgVol * volMultiplier;
    const bodySize = Math.abs(obCandle.close - obCandle.open);
    const bodyPct = bodySize / (obCandle.open || 1);

    // 1. Bullish Order Block (+OB): Bearish candle before strong upward expansion
    const isBearishCandle = obCandle.close < obCandle.open;
    const isBullishExpansion = bars[i].close > obCandle.high && 
                               bars[i - 1].close > obCandle.high;

    if (isBearishCandle && isBullishExpansion && hasVolume && bodyPct >= minBodyPct) {
      const top = Math.max(obCandle.open, obCandle.close);
      const bottom = obCandle.low;

      activeObs.push({
        id: "bull-ob-" + (i - lookback),
        type: "BULLISH",
        createdIndex: i - lookback,
        startTime: obCandle.time,
        endTime: bars[bars.length - 1].time,
        top: top,
        bottom: bottom,
        mid: (top + bottom) / 2,
        color: "#089981",
        fillColor: "rgba(8, 153, 129, 0.22)",
        label: "+OB",
        showMidLine: true,
      });

      if (typeof alertcondition === "function" && i === bars.length - 1) {
        alertcondition(true, "New Bullish OB", "Bullish Order Block formed at " + bottom.toFixed(2) + " - " + top.toFixed(2));
      }
    }

    // 2. Bearish Order Block (-OB): Bullish candle before strong downward expansion
    const isBullishCandle = obCandle.close > obCandle.open;
    const isBearishExpansion = bars[i].close < obCandle.low && 
                               bars[i - 1].close < obCandle.low;

    if (isBullishCandle && isBearishExpansion && hasVolume && bodyPct >= minBodyPct) {
      const top = obCandle.high;
      const bottom = Math.min(obCandle.open, obCandle.close);

      activeObs.push({
        id: "bear-ob-" + (i - lookback),
        type: "BEARISH",
        createdIndex: i - lookback,
        startTime: obCandle.time,
        endTime: bars[bars.length - 1].time,
        top: top,
        bottom: bottom,
        mid: (top + bottom) / 2,
        color: "#f23645",
        fillColor: "rgba(242, 54, 69, 0.22)",
        label: "-OB",
        showMidLine: true,
      });

      if (typeof alertcondition === "function" && i === bars.length - 1) {
        alertcondition(true, "New Bearish OB", "Bearish Order Block formed at " + bottom.toFixed(2) + " - " + top.toFixed(2));
      }
    }

    // 3. Invalidation / Mitigation Check (Price sweeps through the entire zone)
    for (let k = activeObs.length - 1; k >= 0; k--) {
      const ob = activeObs[k];
      if (i > ob.createdIndex) {
        if ((ob.type === "BULLISH" && bars[i].low < ob.bottom) ||
            (ob.type === "BEARISH" && bars[i].high > ob.top)) {
          activeObs.splice(k, 1);
        }
      }
    }
  }

  // Extend all active unmitigated zones to current live bar
  const latestTime = bars[bars.length - 1].time;
  for (const ob of activeObs) {
    ob.endTime = latestTime;
  }

  return {
    boxes: activeObs,
  };
}`;

/**
 * Retrieves all saved custom scripts from localStorage
 */
export function getCustomScripts(): CustomScript[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Seed initial FVG and Order Block scripts if clean state
      const initial: CustomScript[] = [
        {
          id: "script-fvg-unmitigated",
          name: "Unmitigated FVG (0% Hit)",
          description: "Strict 0% wick touch Fair Value Gap detector with 50% equilibrium level.",
          code: DEFAULT_FVG_SCRIPT,
          type: "indicator",
          color: "#00d8ff",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: "script-order-blocks",
          name: "Institutional Order Blocks (OB)",
          description: "Identifies unmitigated baseline order block candles with 50% Mean Threshold.",
          code: DEFAULT_OB_SCRIPT,
          type: "indicator",
          color: "#089981",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to load custom scripts from localStorage", err);
    return [];
  }
}

/**
 * Saves or updates a custom script
 */
export function saveCustomScript(script: {
  id?: string;
  name: string;
  description?: string;
  code: string;
  type?: "indicator" | "strategy";
  color?: string;
  isPublished?: boolean;
}): CustomScript {
  const current = getCustomScripts();
  const id = script.id || `custom-script-${Date.now()}`;
  const now = Date.now();

  const isStrategy = script.code.includes("strategy.") || script.code.includes("strategy_");
  const scriptType = script.type || (isStrategy ? "strategy" : "indicator");

  const existingIndex = current.findIndex((s) => s.id === id);
  let savedItem: CustomScript;

  if (existingIndex >= 0) {
    savedItem = {
      ...current[existingIndex],
      name: script.name,
      description: script.description || current[existingIndex].description,
      code: script.code,
      type: scriptType,
      color: script.color || current[existingIndex].color || "#00d8ff",
      isPublished: script.isPublished !== undefined ? script.isPublished : current[existingIndex].isPublished,
      updatedAt: now,
    };
    current[existingIndex] = savedItem;
  } else {
    savedItem = {
      id,
      name: script.name || "Untitled Script",
      description: script.description || "Custom user script compiled via Web Worker sandbox.",
      code: script.code,
      type: scriptType,
      color: script.color || "#00d8ff",
      isPublished: script.isPublished || false,
      createdAt: now,
      updatedAt: now,
    };
    current.unshift(savedItem);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.error("Failed to persist custom script", err);
  }

  return savedItem;
}

/**
 * Deletes a custom script by ID
 */
export function deleteCustomScript(id: string): CustomScript[] {
  const current = getCustomScripts();
  const filtered = current.filter((s) => s.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error("Failed to delete custom script", err);
  }
  return filtered;
}

/**
 * Saves the working draft in Script Studio
 */
export function saveStudioDraft(draft: { name: string; code: string; scriptId?: string }): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {}
}

/**
 * Retrieves the working draft
 */
export function getStudioDraft(): { name: string; code: string; scriptId?: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const DEFAULT_EMA_RIBBON_SCRIPT = `/**
 * 4 EMA Ribbon (20, 50, 100, 200)
 * Line Styling:
 * - 20 EMA: White (Thin, 1px)
 * - 50 EMA: Blue (Medium, 1.5px)
 * - 100 EMA: Yellow (Thick, 2px)
 * - 200 EMA: Orange (Thickest, 3px)
 */
function calculate(bars, inputs, ta, strategy, alertcondition) {
  const closes = bars.map(b => b.close);
  const ema20 = ta.ema(closes, 20);
  const ema50 = ta.ema(closes, 50);
  const ema100 = ta.ema(closes, 100);
  const ema200 = ta.ema(closes, 200);

  if (typeof alertcondition === "function" && bars.length >= 200) {
    const last = bars.length - 1;
    const isGoldenCross = ema50[last] > ema200[last] && ema50[last - 1] <= ema200[last - 1];
    alertcondition(isGoldenCross, "EMA Golden Cross", "50 EMA crossed above 200 EMA");
  }

  // Returns primary 20 EMA plot points
  return bars.map((bar, i) => ({
    time: bar.time,
    value: ema20[i] !== undefined ? ema20[i] : bar.close
  }));
}`;

export const DEFAULT_BOLLINGER_SCRIPT = `/**
 * Bollinger Bands (20, 2)
 */
function calculate(bars, inputs, ta, strategy, alertcondition) {
  const period = inputs.period || 20;
  const mult = inputs.mult || 2;
  const closes = bars.map(b => b.close);
  const bb = ta.bollinger(closes, period, mult);

  if (typeof alertcondition === "function" && bars.length > 0) {
    const last = bars.length - 1;
    const isSqueeze = (bb.upper[last] - bb.lower[last]) / bb.middle[last] < 0.025;
    alertcondition(isSqueeze, "BB Squeeze", "Bollinger Bandwidth is below 2.5%");
  }

  return bars.map((bar, i) => ({
    time: bar.time,
    value: bb.middle[i] !== undefined ? bb.middle[i] : bar.close
  }));
}`;

export const DEFAULT_RSI_SCRIPT = `/**
 * Relative Strength Index (RSI 14)
 */
function calculate(bars, inputs, ta, strategy, alertcondition) {
  const period = inputs.period || 14;
  const closes = bars.map(b => b.close);
  const rsi = ta.rsi(closes, period);

  if (typeof alertcondition === "function" && bars.length > 0) {
    const last = bars.length - 1;
    alertcondition(rsi[last] <= 30, "RSI Oversold", "RSI reached oversold zone (<= 30)");
    alertcondition(rsi[last] >= 70, "RSI Overbought", "RSI reached overbought zone (>= 70)");
  }

  return bars.map((bar, i) => ({
    time: bar.time,
    value: rsi[i] !== undefined ? rsi[i] : 50
  }));
}`;

export const DEFAULT_MACD_SCRIPT = `/**
 * Moving Average Convergence Divergence (MACD 12, 26, 9)
 */
function calculate(bars, inputs, ta, strategy, alertcondition) {
  const closes = bars.map(b => b.close);
  const macd = ta.macd(closes, 12, 26, 9);

  if (typeof alertcondition === "function" && bars.length > 1) {
    const last = bars.length - 1;
    const isCrossUp = macd.histogram[last] > 0 && macd.histogram[last - 1] <= 0;
    alertcondition(isCrossUp, "MACD Bullish Cross", "MACD Histogram crossed above zero");
  }

  return bars.map((bar, i) => ({
    time: bar.time,
    value: macd.histogram[i] !== undefined ? macd.histogram[i] : 0
  }));
}`;

/**
 * Resolves appropriate script code for any catalog indicator
 */
export function resolveCatalogScriptCode(id?: string, name?: string): string {
  const n = (name || id || "").toLowerCase();
  if (n.includes("fvg") || n.includes("fair value")) {
    return DEFAULT_FVG_SCRIPT;
  }
  if (n.includes("ema") || n.includes("ribbon") || n.includes("moving average")) {
    return DEFAULT_EMA_RIBBON_SCRIPT;
  }
  if (n.includes("bollinger") || n.includes("squeeze") || n.includes("bb")) {
    return DEFAULT_BOLLINGER_SCRIPT;
  }
  if (n.includes("rsi") || n.includes("divergence")) {
    return DEFAULT_RSI_SCRIPT;
  }
  if (n.includes("macd")) {
    return DEFAULT_MACD_SCRIPT;
  }
  return DEFAULT_STARTER_SCRIPT;
}
