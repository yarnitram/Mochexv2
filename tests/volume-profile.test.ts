import { describe, it, expect } from "vitest";
import { calculateVisibleVolumeProfile } from "../src/lib/indicators/volume-profile";
import { CandlestickBar } from "../src/lib/mexc/types";

describe("Visible Range Volume Profile (VPVR) Engine (DEC-071)", () => {
  const sampleBars: CandlestickBar[] = [
    { time: 1000, open: 68000, high: 68200, low: 67900, close: 68150, volume: 120 },
    { time: 2000, open: 68150, high: 68500, low: 68100, close: 68450, volume: 300 },
    { time: 3000, open: 68450, high: 68600, low: 68350, close: 68420, volume: 950 }, // High volume node around 68350-68600
    { time: 4000, open: 68420, high: 68550, low: 68380, close: 68510, volume: 820 }, // High volume node around 68380-68550
    { time: 5000, open: 68510, high: 69000, low: 68480, close: 68920, volume: 180 },
    { time: 6000, open: 68920, high: 69100, low: 68800, close: 68850, volume: 110 },
  ];

  it("computes horizontal volume buckets, conserves total volume, and identifies POC, VAH, and VAL", () => {
    const profile = calculateVisibleVolumeProfile(sampleBars, 12, 0.7);
    expect(profile).not.toBeNull();
    if (!profile) return;

    expect(profile.buckets).toHaveLength(12);

    // Total volume across buckets should equal sum of bar volumes (2480)
    const sumBuckets = profile.buckets.reduce((acc, b) => acc + b.totalVolume, 0);
    expect(sumBuckets).toBeCloseTo(2480, 3);
    expect(profile.totalVolume).toBeCloseTo(2480, 3);

    // POC should lie inside the high-density 68350 - 68600 consolidation cluster
    expect(profile.pocPrice).toBeGreaterThanOrEqual(68300);
    expect(profile.pocPrice).toBeLessThanOrEqual(68650);

    // VAH >= POC >= VAL
    expect(profile.vahPrice).toBeGreaterThanOrEqual(profile.pocPrice);
    expect(profile.valPrice).toBeLessThanOrEqual(profile.pocPrice);

    // Value Area buckets should account for at least 70% of total volume
    const vaVolume = profile.buckets
      .filter((b) => b.isValueArea)
      .reduce((acc, b) => acc + b.totalVolume, 0);
    expect(vaVolume / profile.totalVolume).toBeGreaterThanOrEqual(0.7);
  });

  it("returns null for empty or flat-range bar arrays", () => {
    expect(calculateVisibleVolumeProfile([])).toBeNull();
    expect(
      calculateVisibleVolumeProfile([
        { time: 1000, open: 100, high: 100, low: 100, close: 100, volume: 50 },
      ])
    ).toBeNull();
  });
});
