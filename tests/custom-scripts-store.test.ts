import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import {
  getCustomScripts,
  saveCustomScript,
  deleteCustomScript,
  saveStudioDraft,
  getStudioDraft,
  DEFAULT_FVG_SCRIPT,
} from "../src/lib/indicators/custom-scripts-store";

class MockLocalStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

describe("CustomScriptsStore", () => {
  beforeAll(() => {
    (globalThis as any).window = globalThis;
    (globalThis as any).localStorage = new MockLocalStorage();
  });

  beforeEach(() => {
    (globalThis as any).localStorage.clear();
  });

  it("seeds default FVG script when local storage is empty", () => {
    const scripts = getCustomScripts();
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts[0].id).toBe("script-fvg-unmitigated");
    expect(scripts[0].name).toContain("Unmitigated FVG");
  });

  it("saves and updates a custom script with persistence", () => {
    const saved = saveCustomScript({
      name: "My Custom RSI Band",
      description: "Custom RSI indicator test",
      code: "function calculate(bars, inputs, ta) { return []; }",
      type: "indicator",
    });

    expect(saved.id).toBeDefined();
    expect(saved.name).toBe("My Custom RSI Band");

    const scripts = getCustomScripts();
    expect(scripts.some((s) => s.id === saved.id)).toBe(true);

    // Update
    const updated = saveCustomScript({
      id: saved.id,
      name: "My Custom RSI Band (Updated)",
      code: "function calculate(bars, inputs, ta) { return [{ time: 100, value: 50 }]; }",
    });

    expect(updated.name).toBe("My Custom RSI Band (Updated)");
    const reloaded = getCustomScripts().find((s) => s.id === saved.id);
    expect(reloaded?.name).toBe("My Custom RSI Band (Updated)");
  });

  it("deletes a custom script by id", () => {
    const saved = saveCustomScript({
      name: "To Delete",
      code: "// delete me",
    });

    let current = getCustomScripts();
    expect(current.some((s) => s.id === saved.id)).toBe(true);

    const remaining = deleteCustomScript(saved.id);
    expect(remaining.some((s) => s.id === saved.id)).toBe(false);
  });

  it("saves and restores script studio working drafts", () => {
    saveStudioDraft({
      name: "Unfinished Strategy",
      code: "function calculate() { ... }",
      scriptId: "draft-123",
    });

    const draft = getStudioDraft();
    expect(draft).toBeDefined();
    expect(draft?.name).toBe("Unfinished Strategy");
    expect(draft?.scriptId).toBe("draft-123");
  });

  it("resolves catalog script code for built-in indicators including 4 EMA Ribbon", async () => {
    const { resolveCatalogScriptCode, DEFAULT_EMA_RIBBON_SCRIPT } = await import(
      "../src/lib/indicators/custom-scripts-store"
    );

    const emaCode = resolveCatalogScriptCode("ind-ema-ribbon", "4 EMA Ribbon (20, 50, 100, 200)");
    expect(emaCode).toBe(DEFAULT_EMA_RIBBON_SCRIPT);
    expect(emaCode).toContain("ta.ema(closes, 20)");
    expect(emaCode).toContain("ta.ema(closes, 50)");
    expect(emaCode).toContain("ta.ema(closes, 100)");
    expect(emaCode).toContain("ta.ema(closes, 200)");

    const bbCode = resolveCatalogScriptCode("ind-bollinger", "Bollinger Bands Squeeze Breakout");
    expect(bbCode).toContain("ta.bollinger");

    const rsiCode = resolveCatalogScriptCode("ind-rsi", "RSI Divergence Engine Pro");
    expect(rsiCode).toContain("ta.rsi");

    const macdCode = resolveCatalogScriptCode("ind-macd", "Zero-Lag MACD Histogram");
    expect(macdCode).toContain("ta.macd");
  });

  it("seeds and executes DEFAULT_OB_SCRIPT in indicator sandbox returning boxes", async () => {
    const { DEFAULT_OB_SCRIPT } = await import("../src/lib/indicators/custom-scripts-store");
    const { indicatorSandbox } = await import("../src/lib/indicators/sandbox");

    const scripts = getCustomScripts();
    expect(scripts.some((s) => s.id === "script-order-blocks")).toBe(true);

    const bars = [
      { time: 1000, open: 100, high: 105, low: 98, close: 102, volume: 50 },
      { time: 2000, open: 102, high: 103, low: 95, close: 96, volume: 150 }, // Bearish OB candle
      { time: 3000, open: 96, high: 115, low: 96, close: 114, volume: 180 },  // Bullish expansion candle 1
      { time: 4000, open: 114, high: 125, low: 112, close: 122, volume: 120 }, // Bullish expansion candle 2
      { time: 5000, open: 122, high: 126, low: 118, close: 124, volume: 100 },
    ];

    const res = await indicatorSandbox.execute({
      scriptId: "ob-test",
      code: DEFAULT_OB_SCRIPT,
      bars,
      inputs: { lookback: 2, volMultiplier: 1.0, minBodyPct: 0.001 },
    });

    expect(res.success).toBe(true);
    expect(Array.isArray(res.boxes)).toBe(true);
    expect(res.boxes!.length).toBeGreaterThan(0);
    expect(res.boxes![0].type).toBe("BULLISH");
    expect(res.boxes![0].showMidLine).toBe(true);
  });
});
