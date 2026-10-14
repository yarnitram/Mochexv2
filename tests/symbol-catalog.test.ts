import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  getCachedSymbolCatalog,
  filterAndSearchSymbols,
  formatSymbolVolume,
  POPULAR_FUTURES_SYMBOLS,
  MexcMarketSymbol,
} from "../src/lib/mexc/symbol-catalog";

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

describe("MEXC Symbol Catalog & Scraper Engine (DEC-089)", () => {
  beforeAll(() => {
    (globalThis as any).window = globalThis;
    (globalThis as any).localStorage = new MockLocalStorage();
  });

  beforeEach(() => {
    (globalThis as any).localStorage.clear();
  });

  it("returns pre-populated popular futures symbols when cache is empty", () => {
    const catalog = getCachedSymbolCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(25);
    expect(catalog.some((s) => s.symbol === "BTCUSDT")).toBe(true);
    expect(catalog.some((s) => s.symbol === "SOLUSDT")).toBe(true);
    expect(catalog.some((s) => s.symbol === "SUIUSDT")).toBe(true);
  });

  it("formats quote volumes into human-readable notation", () => {
    expect(formatSymbolVolume(1_500_000_000)).toBe("$1.5B");
    expect(formatSymbolVolume(403_200_000)).toBe("$403.2M");
    expect(formatSymbolVolume(950_000)).toBe("$950K");
    expect(formatSymbolVolume(500)).toBe("$500");
  });

  it("filters symbols by query substring across symbol, baseAsset, and fullName", () => {
    const results = filterAndSearchSymbols("SUI", "ALL", POPULAR_FUTURES_SYMBOLS);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].symbol).toBe("SUIUSDT");

    const ethResults = filterAndSearchSymbols("Ethereum", "ALL", POPULAR_FUTURES_SYMBOLS);
    expect(ethResults.some((s) => s.symbol === "ETHUSDT")).toBe(true);
  });

  it("filters symbols by institutional category tabs", () => {
    const memeResults = filterAndSearchSymbols("", "MEME", POPULAR_FUTURES_SYMBOLS);
    expect(memeResults.length).toBeGreaterThan(0);
    expect(memeResults.some((s) => s.symbol === "PEPEUSDT" || s.symbol === "DOGEUSDT")).toBe(true);

    const aiResults = filterAndSearchSymbols("", "AI", POPULAR_FUTURES_SYMBOLS);
    expect(aiResults.length).toBeGreaterThan(0);
    expect(aiResults.some((s) => s.symbol === "NEARUSDT" || s.symbol === "FETUSDT")).toBe(true);

    const l1Results = filterAndSearchSymbols("", "LAYER1", POPULAR_FUTURES_SYMBOLS);
    expect(l1Results.length).toBeGreaterThan(0);
    expect(l1Results.some((s) => s.symbol === "SOLUSDT" || s.symbol === "AVAXUSDT")).toBe(true);
  });

  it("prioritizes high-volume futures symbols first in default sorting", () => {
    expect(POPULAR_FUTURES_SYMBOLS[0].symbol).toBe("BTCUSDT");
    expect(POPULAR_FUTURES_SYMBOLS[0].quoteVolume).toBeGreaterThan(POPULAR_FUTURES_SYMBOLS[1].quoteVolume);
  });
});
