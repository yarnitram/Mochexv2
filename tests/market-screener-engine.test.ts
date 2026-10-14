import { describe, it, expect } from "vitest";
import {
  MEXC_SCREENER_UNIVERSE,
  SCREENER_TIMEFRAMES,
  CONFLUENCE_TIMEFRAMES,
  scoreToTechnicalRating,
  computeTimeframeTechnicals,
  generateDeterministicPairBars,
  buildInitialScreenerSnapshot,
  updateScreenerPairWithKlines,
  matchesScreenerPreset,
  filterAndSortScreenerRows,
  computeHeatmapTiles,
} from "../src/lib/screener/market-screener-engine";

describe("Market Screener & Multi-Timeframe Technical Scanner Engine (DEC-078)", () => {
  it("hydrates all 15 MEXC Spot pairs across 5 timeframes with multi-timeframe confluence", () => {
    const snapshot = buildInitialScreenerSnapshot();
    expect(snapshot).toHaveLength(MEXC_SCREENER_UNIVERSE.length);
    expect(snapshot).toHaveLength(15);

    for (const row of snapshot) {
      expect(row.price).toBeGreaterThan(0);
      for (const tf of SCREENER_TIMEFRAMES) {
        const metrics = row.timeframes[tf.value];
        expect(metrics).toBeDefined();
        expect(metrics.rsi14).toBeGreaterThanOrEqual(0);
        expect(metrics.rsi14).toBeLessThanOrEqual(100);
        expect(metrics.rvol).toBeGreaterThan(0);
      }
      expect(row.bullishTfCount + row.bearishTfCount).toBeLessThanOrEqual(
        CONFLUENCE_TIMEFRAMES.length
      );
    }
  });

  it("maps numeric composite scores to TradingView technical ratings accurately", () => {
    expect(scoreToTechnicalRating(65)).toBe("STRONG_BUY");
    expect(scoreToTechnicalRating(25)).toBe("BUY");
    expect(scoreToTechnicalRating(0)).toBe("NEUTRAL");
    expect(scoreToTechnicalRating(-25)).toBe("SELL");
    expect(scoreToTechnicalRating(-60)).toBe("STRONG_SELL");
  });

  it("identifies oversold, overbought, Bollinger squeeze, and volume breakout profiles", () => {
    const snapshot = buildInitialScreenerSnapshot();

    const oversoldMatches = filterAndSortScreenerRows(snapshot, {
      timeframe: "15",
      preset: "oversold",
    });
    expect(oversoldMatches.length).toBeGreaterThan(0);
    expect(oversoldMatches.every((r) => r.timeframes["15"].rsi14 <= 32)).toBe(true);

    const overboughtMatches = filterAndSortScreenerRows(snapshot, {
      timeframe: "15",
      preset: "overbought",
    });
    expect(overboughtMatches.length).toBeGreaterThan(0);
    expect(overboughtMatches.every((r) => r.timeframes["15"].rsi14 >= 68)).toBe(true);

    const squeezeMatches = filterAndSortScreenerRows(snapshot, {
      timeframe: "15",
      preset: "bb_squeeze",
    });
    expect(squeezeMatches.length).toBeGreaterThan(0);
    expect(squeezeMatches.every((r) => r.timeframes["15"].bbStatus === "squeeze")).toBe(true);

    const volBreakoutMatches = filterAndSortScreenerRows(snapshot, {
      timeframe: "15",
      preset: "volume_breakout",
    });
    expect(volBreakoutMatches.length).toBeGreaterThan(0);
    expect(volBreakoutMatches.every((r) => r.timeframes["15"].rvol >= 1.8)).toBe(true);
  });

  it("filters by sector category, search query, and sorts columns ascending/descending", () => {
    const snapshot = buildInitialScreenerSnapshot();

    const memes = filterAndSortScreenerRows(snapshot, {
      timeframe: "60",
      preset: "all",
      category: "Meme",
    });
    expect(memes.length).toBe(3);
    expect(memes.map((m) => m.symbol)).toEqual(
      expect.arrayContaining(["DOGEUSDT", "PEPEUSDT", "SHIBUSDT"])
    );

    const searchSol = filterAndSortScreenerRows(snapshot, {
      timeframe: "60",
      preset: "all",
      searchQuery: "solana",
    });
    expect(searchSol).toHaveLength(1);
    expect(searchSol[0].symbol).toBe("SOLUSDT");

    const sortedByRsiDesc = filterAndSortScreenerRows(snapshot, {
      timeframe: "15",
      preset: "all",
      sortField: "rsi14",
      sortDirection: "desc",
    });
    expect(sortedByRsiDesc[0].timeframes["15"].rsi14).toBeGreaterThanOrEqual(
      sortedByRsiDesc[sortedByRsiDesc.length - 1].timeframes["15"].rsi14
    );
  });

  it("recalculates timeframe technicals and confluence when live MEXC klines arrive", () => {
    const snapshot = buildInitialScreenerSnapshot();
    const btcRow = snapshot.find((r) => r.symbol === "BTCUSDT")!;
    const customBars = generateDeterministicPairBars(
      {
        ...MEXC_SCREENER_UNIVERSE[0],
        basePrice: 71250,
        seedProfile: "vol_breakout",
      },
      "60",
      100
    );

    const updated = updateScreenerPairWithKlines(btcRow, "60", customBars);
    expect(updated.isLiveSynced).toBe(true);
    expect(updated.price).toBeCloseTo(71250, 1);
    expect(updated.timeframes["60"].isVolumeBreakout).toBe(true);
  });

  it("generates volume-weighted 2D heatmap tiles across change24h, rsi14, and rating color modes", () => {
    const snapshot = buildInitialScreenerSnapshot();

    const tilesByChange = computeHeatmapTiles(snapshot, "15", "change24h");
    expect(tilesByChange).toHaveLength(15);
    expect(tilesByChange[0].weightPct).toBeGreaterThanOrEqual(25);
    expect(tilesByChange[0].weightPct).toBeLessThanOrEqual(100);

    const tilesByRsi = computeHeatmapTiles(snapshot, "15", "rsi14");
    expect(tilesByRsi).toHaveLength(15);

    const tilesByRating = computeHeatmapTiles(snapshot, "15", "rating");
    expect(tilesByRating).toHaveLength(15);
  });

  it("handles empty bars gracefully in computeTimeframeTechnicals and matchesScreenerPreset", () => {
    const emptyMetrics = computeTimeframeTechnicals([], "15");
    expect(emptyMetrics.rsi14).toBe(50);
    expect(emptyMetrics.rating).toBe("NEUTRAL");

    const snapshot = buildInitialScreenerSnapshot();
    expect(matchesScreenerPreset(snapshot[0], "15", "all")).toBe(true);
  });
});
