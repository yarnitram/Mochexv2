import { ChartDrawing } from "@/lib/chart/drawing-math";

export type AlertCondition = "crossing" | "crossing_up" | "crossing_down";
export type AlertFrequency = "only_once" | "every_time";
export type AlertSourceType =
  | "price"
  | "horizontal_line"
  | "trendline"
  | "rectangle"
  | "position_tp"
  | "position_sl";

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  /** Optional 2-point time/price anchors for dynamic Trendline slope interpolation */
  trendlinePoints?: {
    startTime: number;
    startPrice: number;
    endTime: number;
    endPrice: number;
  };
  condition: AlertCondition;
  frequency: AlertFrequency;
  sourceType: AlertSourceType;
  drawingId?: string;
  label: string;
  active: boolean;
  triggeredCount: number;
  lastTriggeredAt?: number;
  createdAt: number;
}

export interface AlertLogEntry {
  id: string;
  alertId: string;
  symbol: string;
  triggerPrice: number;
  targetPrice: number;
  condition: AlertCondition;
  label: string;
  triggeredAt: number;
}

export const ALERT_COOLDOWN_MS = 60_000;

/**
 * Computes the effective target price of an alert at `currentTimeSec`.
 * For dynamic trendline alerts with distinct start/end times, linearly interpolates the ray price.
 */
export function getEffectiveAlertTargetPrice(
  alert: PriceAlert,
  currentTimeSec?: number
): number {
  if (
    alert.sourceType === "trendline" &&
    alert.trendlinePoints &&
    typeof currentTimeSec === "number"
  ) {
    const { startTime, startPrice, endTime, endPrice } = alert.trendlinePoints;
    const dt = endTime - startTime;
    if (Math.abs(dt) > 0) {
      const slope = (endPrice - startPrice) / dt;
      return startPrice + slope * (currentTimeSec - startTime);
    }
  }
  return alert.targetPrice;
}

/**
 * Pure evaluation of whether a single price transition (`prevPrice` -> `currentPrice`)
 * triggers `alert` at `nowMs`.
 */
export function evaluateAlertCrossing(
  alert: PriceAlert,
  prevPrice: number,
  currentPrice: number,
  currentTimeSec?: number,
  nowMs: number = Date.now()
): { triggered: boolean; effectiveTarget: number } {
  const effectiveTarget = getEffectiveAlertTargetPrice(alert, currentTimeSec);

  if (!alert.active) {
    return { triggered: false, effectiveTarget };
  }
  if (!Number.isFinite(prevPrice) || !Number.isFinite(currentPrice) || prevPrice <= 0 || currentPrice <= 0) {
    return { triggered: false, effectiveTarget };
  }
  if (prevPrice === currentPrice) {
    return { triggered: false, effectiveTarget };
  }

  // Cooldown check for "every_time" frequency
  if (
    alert.frequency === "every_time" &&
    typeof alert.lastTriggeredAt === "number" &&
    nowMs - alert.lastTriggeredAt < ALERT_COOLDOWN_MS
  ) {
    return { triggered: false, effectiveTarget };
  }

  const crossedUp = prevPrice < effectiveTarget && currentPrice >= effectiveTarget;
  const crossedDown = prevPrice > effectiveTarget && currentPrice <= effectiveTarget;

  let triggered = false;
  if (alert.condition === "crossing_up") {
    triggered = crossedUp;
  } else if (alert.condition === "crossing_down") {
    triggered = crossedDown;
  } else {
    triggered = crossedUp || crossedDown;
  }

  return { triggered, effectiveTarget };
}

/**
 * Evaluates a batch of alerts for a specific `symbol` transition (`prevPrice` -> `currentPrice`).
 * Returns updated alerts list and any newly generated `AlertLogEntry` items.
 */
export function evaluateAlertsBatch(
  alerts: PriceAlert[],
  symbol: string,
  prevPrice: number,
  currentPrice: number,
  currentTimeSec?: number,
  nowMs: number = Date.now()
): { updatedAlerts: PriceAlert[]; triggeredLogs: AlertLogEntry[] } {
  let changed = false;
  const triggeredLogs: AlertLogEntry[] = [];

  const updatedAlerts = alerts.map((alert) => {
    if (alert.symbol !== symbol || !alert.active) return alert;

    const { triggered, effectiveTarget } = evaluateAlertCrossing(
      alert,
      prevPrice,
      currentPrice,
      currentTimeSec,
      nowMs
    );

    if (!triggered) return alert;

    changed = true;
    triggeredLogs.push({
      id: `log-${nowMs}-${alert.id}-${alert.triggeredCount + 1}`,
      alertId: alert.id,
      symbol: alert.symbol,
      triggerPrice: currentPrice,
      targetPrice: effectiveTarget,
      condition: alert.condition,
      label: alert.label,
      triggeredAt: nowMs,
    });

    return {
      ...alert,
      active: alert.frequency === "only_once" ? false : true,
      triggeredCount: alert.triggeredCount + 1,
      lastTriggeredAt: nowMs,
    };
  });

  return {
    updatedAlerts: changed ? updatedAlerts : alerts,
    triggeredLogs,
  };
}

/**
 * Converts a selected `ChartDrawing` into one or more `PriceAlert` definitions.
 * - Horizontal Line -> Crossing at `startPrice`
 * - Trendline -> Dynamic slope Crossing anchored to `(startTime, startPrice)` and `(endTime, endPrice)`
 * - Rectangle -> Resistance Crossing Up (`max`) and Support Crossing Down (`min`)
 * - Long / Short Position -> Take Profit and Stop Loss Crossing alerts
 */
export function createAlertsFromDrawing(
  drawing: ChartDrawing,
  symbol: string,
  nowMs: number = Date.now()
): PriceAlert[] {
  if (drawing.type === "horizontal_line") {
    return [
      {
        id: `alert-${drawing.id}-hline-${nowMs}`,
        symbol,
        targetPrice: drawing.startPrice,
        condition: "crossing",
        frequency: "only_once",
        sourceType: "horizontal_line",
        drawingId: drawing.id,
        label: drawing.text
          ? `H-Line (${drawing.text})`
          : `Horizontal Line @ $${drawing.startPrice.toFixed(2)}`,
        active: true,
        triggeredCount: 0,
        createdAt: nowMs,
      },
    ];
  }

  if (drawing.type === "trendline") {
    return [
      {
        id: `alert-${drawing.id}-tline-${nowMs}`,
        symbol,
        targetPrice: drawing.endPrice,
        trendlinePoints: {
          startTime: drawing.startTime,
          startPrice: drawing.startPrice,
          endTime: drawing.endTime,
          endPrice: drawing.endPrice,
        },
        condition: "crossing",
        frequency: "only_once",
        sourceType: "trendline",
        drawingId: drawing.id,
        label: drawing.text
          ? `Trendline (${drawing.text})`
          : `Trendline Ray Cross`,
        active: true,
        triggeredCount: 0,
        createdAt: nowMs,
      },
    ];
  }

  if (drawing.type === "rectangle") {
    const topPrice = Math.max(drawing.startPrice, drawing.endPrice);
    const bottomPrice = Math.min(drawing.startPrice, drawing.endPrice);
    return [
      {
        id: `alert-${drawing.id}-rect-top-${nowMs}`,
        symbol,
        targetPrice: topPrice,
        condition: "crossing_up",
        frequency: "only_once",
        sourceType: "rectangle",
        drawingId: drawing.id,
        label: `Rect Resistance Breakout @ $${topPrice.toFixed(2)}`,
        active: true,
        triggeredCount: 0,
        createdAt: nowMs,
      },
      {
        id: `alert-${drawing.id}-rect-bot-${nowMs}`,
        symbol,
        targetPrice: bottomPrice,
        condition: "crossing_down",
        frequency: "only_once",
        sourceType: "rectangle",
        drawingId: drawing.id,
        label: `Rect Support Breakdown @ $${bottomPrice.toFixed(2)}`,
        active: true,
        triggeredCount: 0,
        createdAt: nowMs,
      },
    ];
  }

  if (drawing.type === "long_position" || drawing.type === "short_position") {
    const isLong = drawing.type === "long_position";
    const tpPrice = drawing.endPrice;
    const slPrice =
      drawing.stopPrice ??
      (isLong ? drawing.startPrice * 0.99 : drawing.startPrice * 1.01);

    return [
      {
        id: `alert-${drawing.id}-tp-${nowMs}`,
        symbol,
        targetPrice: tpPrice,
        condition: isLong ? "crossing_up" : "crossing_down",
        frequency: "only_once",
        sourceType: "position_tp",
        drawingId: drawing.id,
        label: `${isLong ? "Long" : "Short"} Take Profit @ $${tpPrice.toFixed(2)}`,
        active: true,
        triggeredCount: 0,
        createdAt: nowMs,
      },
      {
        id: `alert-${drawing.id}-sl-${nowMs}`,
        symbol,
        targetPrice: slPrice,
        condition: isLong ? "crossing_down" : "crossing_up",
        frequency: "only_once",
        sourceType: "position_sl",
        drawingId: drawing.id,
        label: `${isLong ? "Long" : "Short"} Stop Loss @ $${slPrice.toFixed(2)}`,
        active: true,
        triggeredCount: 0,
        createdAt: nowMs,
      },
    ];
  }

  // Fallback for any other drawing tool: create a crossing alert at startPrice
  return [
    {
      id: `alert-${drawing.id}-generic-${nowMs}`,
      symbol,
      targetPrice: drawing.startPrice,
      condition: "crossing",
      frequency: "only_once",
      sourceType: "price",
      drawingId: drawing.id,
      label: `${drawing.type.replace("_", " ").toUpperCase()} @ $${drawing.startPrice.toFixed(2)}`,
      active: true,
      triggeredCount: 0,
      createdAt: nowMs,
    },
  ];
}

/**
 * Synthesizes an institutional dual-tone bell chime (A5 -> E6) using Web Audio API.
 */
export function playInstitutionalAlertChime(): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // First tone: A5 (880 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.14, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Second tone: E6 (1318.5 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(1318.5, now + 0.12);
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.16, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.48);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 600);
  } catch {
    // Ignore audio context autoplay restrictions
  }
}
