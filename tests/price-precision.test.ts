import { describe, it, expect } from "vitest";
import { calculatePricePrecision } from "../src/lib/chart/price-precision";

describe("Dynamic Price Precision Engine (DEC-097)", () => {
  it("formats ETH and BTC (>= $100) with 2 decimals and grouping", () => {
    const ethInfo = calculatePricePrecision(2450.75);
    expect(ethInfo.precision).toBe(2);
    expect(ethInfo.minMove).toBe(0.01);
    expect(ethInfo.formatPrice(2450.75)).toBe("2,450.75");
    expect(ethInfo.formatPrice(2000)).toBe("2,000.00");

    const btcInfo = calculatePricePrecision(68420.5);
    expect(btcInfo.precision).toBe(2);
    expect(btcInfo.minMove).toBe(0.01);
    expect(btcInfo.formatPrice(68420.5)).toBe("68,420.50");
  });

  it("formats tokens between $1 and $100 with 4 decimals", () => {
    const solInfo = calculatePricePrecision(24.5678);
    expect(solInfo.precision).toBe(4);
    expect(solInfo.minMove).toBe(0.0001);
    expect(solInfo.formatPrice(24.5678)).toBe("24.5678");
  });

  it("formats cents tokens ($0.01 to $1.00) with 5 decimals eliminating scale gaps", () => {
    const centsInfo = calculatePricePrecision(0.0342);
    expect(centsInfo.precision).toBe(5);
    expect(centsInfo.minMove).toBe(0.00001);
    expect(centsInfo.formatPrice(0.0342)).toBe("0.03420");
    expect(centsInfo.formatPrice(0.04)).toBe("0.04000");
  });

  it("formats sub-cent tokens ($0.0001 to $0.01) with 6 decimals", () => {
    const subCentInfo = calculatePricePrecision(0.00582);
    expect(subCentInfo.precision).toBe(6);
    expect(subCentInfo.minMove).toBe(0.000001);
    expect(subCentInfo.formatPrice(0.00582)).toBe("0.005820");
  });

  it("formats micro-cent tokens (< $0.0001) with 8 decimals", () => {
    const memeInfo = calculatePricePrecision(0.0000185);
    expect(memeInfo.precision).toBe(8);
    expect(memeInfo.minMove).toBe(0.00000001);
    expect(memeInfo.formatPrice(0.0000185)).toBe("0.00001850");
  });

  it("auto-expands precision when candle bars exhibit higher granularity", () => {
    const sampleBars = [
      { close: 0.034567, open: 0.034500, high: 0.034600, low: 0.034400 },
    ];
    const expandedInfo = calculatePricePrecision(0.034567, sampleBars);
    expect(expandedInfo.precision).toBe(6);
    expect(expandedInfo.minMove).toBe(0.000001);
    expect(expandedInfo.formatPrice(0.034567)).toBe("0.034567");
  });
});
