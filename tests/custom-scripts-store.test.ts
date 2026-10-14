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
});
