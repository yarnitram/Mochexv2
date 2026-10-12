import { CandlestickBar, MexcRawKline, MexcResolution, parseRawKline, RESOLUTION_MAP } from "./types";

export interface FetchKlinesOptions {
  symbol: string;
  resolution: string; // TradingView resolution string (e.g. "15", "60", "1D")
  startTime?: number; // ms
  endTime?: number;   // ms
  limit?: number;     // max 1000
  forceProxy?: boolean;
}

export class MexcClient {
  private apiBase: string;
  private proxyBase: string;

  constructor(
    apiBase = process.env.NEXT_PUBLIC_MEXC_API_BASE || "https://api.mexc.com",
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
   * Fetches klines using hybrid strategy:
   * 1. Direct fetch to MEXC public API (client-centric)
   * 2. Automatic fallback to internal Next.js proxy route on failure or CORS restriction
   */
  public async getKlines(options: FetchKlinesOptions): Promise<CandlestickBar[]> {
    const { symbol, resolution, startTime, endTime, limit = 1000, forceProxy = false } = options;
    const interval = this.toMexcInterval(resolution);

    const queryParams = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      interval,
      limit: Math.min(limit, 1000).toString(),
    });

    if (startTime) queryParams.set("startTime", startTime.toString());
    if (endTime) queryParams.set("endTime", endTime.toString());

    if (!forceProxy && typeof window !== "undefined") {
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
        // Direct fetch failed (CORS or network error). Fall through to fallback proxy.
      }
    }

    // Fallback: Internal Next.js proxy route
    return this.fetchFromProxy(queryParams);
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
