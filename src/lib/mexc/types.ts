/**
 * MEXC Spot V3 Market Data Types & Schemas
 */

export type MexcResolution = "1m" | "5m" | "15m" | "30m" | "60m" | "4h" | "1d" | "1W" | "1M";

export const RESOLUTION_MAP: Record<string, MexcResolution> = {
  "1": "1m",
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "60": "60m",
  "240": "4h",
  "1D": "1d",
  "D": "1d",
  "1W": "1W",
  "W": "1W",
  "1M": "1M",
  "M": "1M",
};

export const WS_INTERVAL_MAP: Record<string, string> = {
  "1m": "Min1",
  "5m": "Min5",
  "15m": "Min15",
  "30m": "Min30",
  "60m": "Min60",
  "4h": "Hour4",
  "1d": "Day1",
  "1W": "Week1",
  "1M": "Month1",
};

/**
 * Raw MEXC Kline array format:
 * [0] Open time (ms)
 * [1] Open price (string)
 * [2] High price (string)
 * [3] Low price (string)
 * [4] Close price (string)
 * [5] Volume (string)
 * [6] Close time (ms)
 * [7] Turnover amount (string)
 */
export type MexcRawKline = [
  number, // 0: Open time
  string, // 1: Open
  string, // 2: High
  string, // 3: Low
  string, // 4: Close
  string, // 5: Volume
  number, // 6: Close time
  string  // 7: Turnover
];

export interface CandlestickBar {
  time: number; // UTC timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MexcKlineWsPayload {
  d: {
    k: {
      t: number;  // Bar start time (ms)
      o: string;  // Open
      c: string;  // Close
      h: string;  // High
      l: string;  // Low
      v: string;  // Volume
      a: string;  // Amount (Turnover)
      T: number;  // Bar end time (ms)
    };
  };
  c: string;      // Channel name (e.g. spot@public.kline.v3.api@BTCUSDT@Min15)
  s: string;      // Symbol (e.g. BTCUSDT)
  t: number;      // Message timestamp
}

export interface MexcMiniTickerItem {
  s: string; // Symbol
  p: string; // Last price
  r: string; // 24h percentage change
  h: string; // 24h High
  l: string; // 24h Low
  v: string; // 24h Volume
  a: string; // 24h Turnover
}

export interface MexcMiniTickerWsPayload {
  d: MexcMiniTickerItem[];
  c: string;
  t: number;
}

export function parseRawKline(raw: MexcRawKline): CandlestickBar {
  return {
    time: Number(raw[0]),
    open: parseFloat(raw[1]),
    high: parseFloat(raw[2]),
    low: parseFloat(raw[3]),
    close: parseFloat(raw[4]),
    volume: parseFloat(raw[5]),
  };
}

export function parseWsKline(data: MexcKlineWsPayload["d"]["k"]): CandlestickBar {
  return {
    time: Number(data.t),
    open: parseFloat(data.o),
    high: parseFloat(data.h),
    low: parseFloat(data.l),
    close: parseFloat(data.c),
    volume: parseFloat(data.v),
  };
}
