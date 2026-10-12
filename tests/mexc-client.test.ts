import { describe, it, expect, vi } from "vitest";
import { MexcClient } from "@/lib/mexc/client";
import { MexcRawKline, parseRawKline } from "@/lib/mexc/types";

describe("MexcClient & Data Transformations", () => {
  const client = new MexcClient("https://api.mexc.com", "/api/mexc");

  it("should correctly map TradingView resolutions to MEXC intervals", () => {
    expect(client.toMexcInterval("1")).toBe("1m");
    expect(client.toMexcInterval("5")).toBe("5m");
    expect(client.toMexcInterval("15")).toBe("15m");
    expect(client.toMexcInterval("60")).toBe("60m");
    expect(client.toMexcInterval("240")).toBe("4h");
    expect(client.toMexcInterval("1D")).toBe("1d");
    expect(client.toMexcInterval("1W")).toBe("1W");
    expect(client.toMexcInterval("1M")).toBe("1M");
    expect(client.toMexcInterval("unknown")).toBe("15m");
  });

  it("should accurately parse raw MEXC kline array into typed CandlestickBar", () => {
    const rawKline: MexcRawKline = [
      1672531200000, // Open time
      "16540.50",    // Open
      "16550.00",    // High
      "16520.10",    // Low
      "16535.20",    // Close
      "120.45",      // Volume
      1672531259999, // Close time
      "1991823.12",  // Turnover
    ];

    const bar = parseRawKline(rawKline);

    expect(bar.time).toBe(1672531200000);
    expect(bar.open).toBe(16540.5);
    expect(bar.high).toBe(16550.0);
    expect(bar.low).toBe(16520.1);
    expect(bar.close).toBe(16535.2);
    expect(bar.volume).toBe(120.45);
  });

  it("should sort raw klines chronologically", () => {
    const rawKlines: MexcRawKline[] = [
      [2000, "10", "12", "9", "11", "5", 2059, "50"],
      [1000, "9", "11", "8", "10", "4", 1059, "40"],
      [3000, "11", "13", "10", "12", "6", 3059, "60"],
    ];

    const transformed = client.transformKlines(rawKlines);

    expect(transformed[0].time).toBe(1000);
    expect(transformed[1].time).toBe(2000);
    expect(transformed[2].time).toBe(3000);
  });
});
