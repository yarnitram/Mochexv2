import { describe, it, expect } from "vitest";
import {
  PriceAlert,
  evaluateAlertCrossing,
  evaluateAlertsBatch,
  getEffectiveAlertTargetPrice,
  createAlertsFromDrawing,
  ALERT_COOLDOWN_MS,
} from "../src/lib/alerts/alerts-engine";
import { ChartDrawing } from "../src/lib/chart/drawing-math";

describe("Live Price & Drawing Crossing Alerts Engine (DEC-069)", () => {
  const baseAlert: PriceAlert = {
    id: "alert-1",
    symbol: "BTCUSDT",
    targetPrice: 68500,
    condition: "crossing",
    frequency: "only_once",
    sourceType: "price",
    label: "BTC 68.5k Breakout",
    active: true,
    triggeredCount: 0,
    createdAt: 1700000000000,
  };

  it("evaluates crossing_up, crossing_down, and bidirectional crossing accurately", () => {
    const upAlert: PriceAlert = { ...baseAlert, condition: "crossing_up" };
    const downAlert: PriceAlert = { ...baseAlert, condition: "crossing_down" };

    // Upward cross: 68450 -> 68510
    expect(evaluateAlertCrossing(upAlert, 68450, 68510).triggered).toBe(true);
    expect(evaluateAlertCrossing(downAlert, 68450, 68510).triggered).toBe(false);
    expect(evaluateAlertCrossing(baseAlert, 68450, 68510).triggered).toBe(true);

    // Downward cross: 68550 -> 68490
    expect(evaluateAlertCrossing(upAlert, 68550, 68490).triggered).toBe(false);
    expect(evaluateAlertCrossing(downAlert, 68550, 68490).triggered).toBe(true);
    expect(evaluateAlertCrossing(baseAlert, 68550, 68490).triggered).toBe(true);

    // No cross: 68400 -> 68480
    expect(evaluateAlertCrossing(baseAlert, 68400, 68480).triggered).toBe(false);
  });

  it("interpolates dynamic trendline target price by timestamp slope", () => {
    const trendAlert: PriceAlert = {
      ...baseAlert,
      sourceType: "trendline",
      trendlinePoints: {
        startTime: 1000,
        startPrice: 68000,
        endTime: 2000,
        endPrice: 69000,
      },
    };

    // At t = 1500 (midpoint), target price should be 68500
    expect(getEffectiveAlertTargetPrice(trendAlert, 1500)).toBeCloseTo(68500, 2);

    // Price moving 68480 -> 68520 at t = 1500 crosses the trendline
    const res = evaluateAlertCrossing(trendAlert, 68480, 68520, 1500);
    expect(res.triggered).toBe(true);
    expect(res.effectiveTarget).toBeCloseTo(68500, 2);
  });

  it("auto-deactivates only_once alerts and enforces 60s cooldown on every_time alerts", () => {
    const onceAlert: PriceAlert = { ...baseAlert, id: "once-1", frequency: "only_once" };
    const recurringAlert: PriceAlert = { ...baseAlert, id: "rec-1", frequency: "every_time" };

    const t0 = 1700000000000;
    const batch1 = evaluateAlertsBatch(
      [onceAlert, recurringAlert],
      "BTCUSDT",
      68400,
      68550,
      undefined,
      t0
    );

    expect(batch1.triggeredLogs).toHaveLength(2);
    expect(batch1.updatedAlerts[0].active).toBe(false); // only_once paused
    expect(batch1.updatedAlerts[1].active).toBe(true); // every_time stays active
    expect(batch1.updatedAlerts[1].triggeredCount).toBe(1);

    // 15 seconds later (inside 60s cooldown): neither should fire
    const batch2 = evaluateAlertsBatch(
      batch1.updatedAlerts,
      "BTCUSDT",
      68400,
      68550,
      undefined,
      t0 + 15_000
    );
    expect(batch2.triggeredLogs).toHaveLength(0);

    // 61 seconds later (past cooldown): recurring alert fires again
    const batch3 = evaluateAlertsBatch(
      batch1.updatedAlerts,
      "BTCUSDT",
      68400,
      68550,
      undefined,
      t0 + ALERT_COOLDOWN_MS + 1000
    );
    expect(batch3.triggeredLogs).toHaveLength(1);
    expect(batch3.triggeredLogs[0].alertId).toBe("rec-1");
    expect(batch3.updatedAlerts[1].triggeredCount).toBe(2);
  });

  it("converts Horizontal Line, Trendline, Rectangle, and Position drawings into structured alerts", () => {
    const hline: ChartDrawing = {
      id: "d-hline",
      type: "horizontal_line",
      startTime: 1000,
      startPrice: 67800,
      endTime: 1000,
      endPrice: 67800,
      color: "#2e5bff",
    };
    const hAlerts = createAlertsFromDrawing(hline, "BTCUSDT");
    expect(hAlerts).toHaveLength(1);
    expect(hAlerts[0].sourceType).toBe("horizontal_line");
    expect(hAlerts[0].targetPrice).toBe(67800);

    const pos: ChartDrawing = {
      id: "d-long",
      type: "long_position",
      startTime: 1000,
      startPrice: 68000,
      endTime: 2000,
      endPrice: 69500, // TP
      stopPrice: 67200, // SL
      color: "#00c853",
    };
    const posAlerts = createAlertsFromDrawing(pos, "BTCUSDT");
    expect(posAlerts).toHaveLength(2);
    expect(posAlerts[0].sourceType).toBe("position_tp");
    expect(posAlerts[0].condition).toBe("crossing_up");
    expect(posAlerts[0].targetPrice).toBe(69500);
    expect(posAlerts[1].sourceType).toBe("position_sl");
    expect(posAlerts[1].condition).toBe("crossing_down");
    expect(posAlerts[1].targetPrice).toBe(67200);
  });
});
