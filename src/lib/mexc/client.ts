import { CandlestickBar, MexcRawKline, MexcResolution, parseRawKline, RESOLUTION_MAP } from "./types";

export interface FetchKlinesOptions {
  symbol: string;
  resolution: string; // TradingView resolution string (e.g. "15", "60", "1D")
  startTime?: number; // ms
  endTime?: number;   // ms
  limit?: number;     // max 1000 (MEXC V3 returns max 500 per call)
  forceProxy?: boolean;
}

export interface FetchDeepKlinesOptions {
  symbol: string;
  resolution: string;
  targetCount?: number; // e.g. 1500 candles across multiple 500-bar batches
  endTime?: number;     // optional cutoff timestamp (ms)
  forceProxy?: boolean;
}

const INTERVAL_DURATION_MS: Record<MexcResolution, number> = {
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "60m": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
};

export class MexcClient {
  private apiBase: string;
  private proxyBase: string;

  constructor(
    apiBase = process.env.NEXT_PUBLIC_MEXC_API_BASE || "https://api.mexc.co",
    proxyBase = "/api/mexc"
  ) {
    this.apiBase = apiBase;
    this.proxyBase = proxyBase;
  }

  /**
   * Resolves TradingView resolution (e.g. "15", "1D") to MEXC interval (e.g. "15m", "1d")
   */
  public toMexcInterval(resolution: string): MexcResolution {
    return RESOLUTION_MAP[resolution] || "15m";
  }

  /**
   * Resolves TradingView resolution to bar duration in milliseconds
   */
  public toIntervalMs(resolution: string): number {
    const interval = this.toMexcInterval(resolution);
    return INTERVAL_DURATION_MS[interval] || 15 * 60 * 1000;
  }

  /**
   * Fetches klines using hybrid strategy:
   * 1. Direct fetch to MEXC public API (client-centric)
   * 2. Automatic fallback to internal Next.js proxy route on failure or CORS restriction
   * Note: MEXC V3 ignores `endTime` unless `startTime` is also provided; we automatically
   * compute `startTime` when `endTime` is supplied alone.
   */
  public async getKlines(options: FetchKlinesOptions): Promise<CandlestickBar[]> {
    const { symbol, resolution, startTime, endTime, limit = 1000, forceProxy = false } = options;
    const interval = this.toMexcInterval(resolution);
    const barDurationMs = this.toIntervalMs(resolution);
    const effectiveBatchSize = Math.min(limit, 500);

    const queryParams = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      interval,
      limit: Math.min(limit, 1000).toString(),
    });

    const computedStartTime =
      startTime !== undefined
        ? startTime
        : endTime !== undefined
          ? Math.max(0, endTime - effectiveBatchSize * barDurationMs)
          : undefined;

    if (computedStartTime !== undefined) queryParams.set("startTime", computedStartTime.toString());
    if (endTime !== undefined) queryParams.set("endTime", endTime.toString());

    // In the browser, ALWAYS use the internal Next.js proxy route (/api/mexc/klines)
    // because MEXC public REST endpoints do not permit cross-origin (CORS) browser requests.
    if (typeof window !== "undefined" || forceProxy) {
      return this.fetchFromProxy(queryParams);
    }

    // Direct server-side fetch (Node.js runtime / SSR / testing environments without CORS)
    try {
      const directUrl = `${this.apiBase}/api/v3/klines?${queryParams.toString()}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(directUrl, {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const rawKlines = (await response.json()) as MexcRawKline[];
        return this.transformKlines(rawKlines);
      }
    } catch (_err) {
      // Direct server fetch failed. Fall through to fallback proxy.
    }

    return this.fetchFromProxy(queryParams);
  }

  /**
   * Stitches multiple 500-bar historical batches backwards in time to provide deep
   * chart history (e.g. 1,500 initial bars or +1,000 backfill bars).
   */
  public async getDeepKlines(options: FetchDeepKlinesOptions): Promise<CandlestickBar[]> {
    const {
      symbol,
      resolution,
      targetCount = 1500,
      endTime,
      forceProxy = false,
    } = options;

    const clampedTarget = Math.max(100, Math.min(targetCount, 10000));
    const maxBatches = Math.ceil(clampedTarget / 500) + 1;
    const barMap = new Map<number, CandlestickBar>();
    let cursorEndTime: number | undefined = endTime;

    for (let i = 0; i < maxBatches && barMap.size < clampedTarget; i++) {
      const remaining = clampedTarget - barMap.size;
      const batchLimit = Math.max(200, Math.min(remaining, 500));

      const batch = await this.getKlines({
        symbol,
        resolution,
        limit: batchLimit,
        endTime: cursorEndTime,
        forceProxy,
      });

      if (!batch || batch.length === 0) break;

      let newBarsAdded = 0;
      for (const bar of batch) {
        if (!barMap.has(bar.time)) {
          barMap.set(bar.time, bar);
          newBarsAdded++;
        }
      }

      if (newBarsAdded === 0 || batch.length < 10) {
        break;
      }

      const oldestInBatch = batch[0].time;
      cursorEndTime = oldestInBatch - 1;
    }

    const sorted = Array.from(barMap.values()).sort((a, b) => a.time - b.time);
    if (sorted.length > clampedTarget) {
      return sorted.slice(sorted.length - clampedTarget);
    }
    return sorted;
  }

  private async fetchFromProxy(params: URLSearchParams): Promise<CandlestickBar[]> {
    const proxyUrl = `${this.proxyBase}/klines?${params.toString()}`;
    const response = await fetch(proxyUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`MEXC Proxy error: ${response.status} ${response.statusText}`);
    }

    const rawKlines = (await response.json()) as MexcRawKline[];
    return this.transformKlines(rawKlines);
  }

  public transformKlines(rawKlines: MexcRawKline[]): CandlestickBar[] {
    if (!Array.isArray(rawKlines)) return [];
    return rawKlines
      .map(parseRawKline)
      .sort((a, b) => a.time - b.time);
  }
}

export const mexcClient = new MexcClient();

