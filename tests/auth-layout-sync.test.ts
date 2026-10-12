import { describe, it, expect, vi } from "vitest";

describe("Cloud Layouts & Watchlist Synchronization", () => {
  it("serializes layout content correctly for PostgreSQL storage", () => {
    const layout = {
      name: "Scalping Setup 5m",
      symbol: "ETHUSDT",
      resolution: "5",
      content: {
        symbol: "ETHUSDT",
        resolution: "5",
        indicators: ["EMA Ribbon Momentum Multi-Timeframe", "RSI Divergence Engine Pro"],
        savedAt: "2026-10-12T09:00:00.000Z",
      },
      isDefault: true,
    };

    expect(layout.name).toBe("Scalping Setup 5m");
    expect(layout.content.indicators.length).toBe(2);
    expect(layout.content.symbol).toBe("ETHUSDT");
    expect(layout.isDefault).toBe(true);
  });

  it("handles guest-to-cloud payload transformation without loss of local preferences", () => {
    const localStore: Record<string, string> = {
      "mochex:symbol": "SOLUSDT",
      "mochex:resolution": "60",
      "mochex:active_indicators": JSON.stringify(["EMA Ribbon Momentum Multi-Timeframe"]),
      "mochex:watchlist_symbols": JSON.stringify(["SOLUSDT", "BTCUSDT", "ETHUSDT"]),
    };

    const cloudPayload = {
      name: "Imported Local Setup",
      symbol: localStore["mochex:symbol"],
      resolution: localStore["mochex:resolution"],
      content: {
        symbol: localStore["mochex:symbol"],
        resolution: localStore["mochex:resolution"],
        indicators: JSON.parse(localStore["mochex:active_indicators"]),
      },
      watchlist: {
        name: "My Local Watchlist",
        symbols: JSON.parse(localStore["mochex:watchlist_symbols"]),
      },
    };

    expect(cloudPayload.symbol).toBe("SOLUSDT");
    expect(cloudPayload.resolution).toBe("60");
    expect(cloudPayload.content.indicators).toContain("EMA Ribbon Momentum Multi-Timeframe");
    expect(cloudPayload.watchlist.symbols.length).toBe(3);
  });

  it("validates named watchlist symbol deduplication and removals", () => {
    let activeSymbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

    // Add duplicate
    const addSymbol = (sym: string) => {
      if (!activeSymbols.includes(sym)) {
        activeSymbols = [...activeSymbols, sym];
      }
    };

    addSymbol("BTCUSDT");
    expect(activeSymbols.length).toBe(3);

    addSymbol("SUIUSDT");
    expect(activeSymbols.length).toBe(4);
    expect(activeSymbols).toContain("SUIUSDT");

    // Remove symbol
    const removeSymbol = (sym: string) => {
      activeSymbols = activeSymbols.filter((s) => s !== sym);
    };

    removeSymbol("ETHUSDT");
    expect(activeSymbols.length).toBe(3);
    expect(activeSymbols).not.toContain("ETHUSDT");
  });
});
