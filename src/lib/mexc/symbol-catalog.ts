/**
 * MEXC Universal Market Symbol Catalog & Dynamic Scraper Engine
 * Caches and indexes all 1,480+ MEXC USDT pairs for high-speed search across Mochex.
 */

export type SymbolCategory = "ALL" | "TOP_FUTURES" | "LAYER1" | "DEFI" | "MEME" | "AI";

export interface MexcMarketSymbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  fullName: string;
  price: number;
  change24h: number;
  quoteVolume: number;
  category: string;
  isFuturesPopular: boolean;
}

const STORAGE_KEY = "mochex:mexc_symbol_catalog";
const TIMESTAMP_KEY = "mochex:mexc_symbol_catalog_ts";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * High-speed fallback catalog containing top 30 most active perpetual futures pairs
 */
export const POPULAR_FUTURES_SYMBOLS: MexcMarketSymbol[] = [
  { symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT", fullName: "Bitcoin", price: 81820.0, change24h: -2.05, quoteVolume: 403200000, category: "TOP_FUTURES", isFuturesPopular: true },
  { symbol: "ETHUSDT", baseAsset: "ETH", quoteAsset: "USDT", fullName: "Ethereum", price: 2430.5, change24h: -3.35, quoteVolume: 180400000, category: "TOP_FUTURES", isFuturesPopular: true },
  { symbol: "SOLUSDT", baseAsset: "SOL", quoteAsset: "USDT", fullName: "Solana", price: 104.2, change24h: -3.20, quoteVolume: 67000000, category: "TOP_FUTURES", isFuturesPopular: true },
  { symbol: "XRPUSDT", baseAsset: "XRP", quoteAsset: "USDT", fullName: "Ripple", price: 1.334, change24h: -2.90, quoteVolume: 39700000, category: "TOP_FUTURES", isFuturesPopular: true },
  { symbol: "ENAUSDT", baseAsset: "ENA", quoteAsset: "USDT", fullName: "Ethena", price: 0.197, change24h: -6.45, quoteVolume: 30000000, category: "DEFI", isFuturesPopular: true },
  { symbol: "SUIUSDT", baseAsset: "SUI", quoteAsset: "USDT", fullName: "Sui Network", price: 1.94, change24h: 12.40, quoteVolume: 25400000, category: "LAYER1", isFuturesPopular: true },
  { symbol: "PUMPUSDT", baseAsset: "PUMP", quoteAsset: "USDT", fullName: "Pump.fun", price: 0.0048, change24h: -4.25, quoteVolume: 16500000, category: "MEME", isFuturesPopular: true },
  { symbol: "BNBUSDT", baseAsset: "BNB", quoteAsset: "USDT", fullName: "BNB", price: 732.9, change24h: -1.54, quoteVolume: 10100000, category: "LAYER1", isFuturesPopular: true },
  { symbol: "DOGEUSDT", baseAsset: "DOGE", quoteAsset: "USDT", fullName: "Dogecoin", price: 0.0822, change24h: -2.80, quoteVolume: 9500000, category: "MEME", isFuturesPopular: true },
  { symbol: "LTCUSDT", baseAsset: "LTC", quoteAsset: "USDT", fullName: "Litecoin", price: 59.46, change24h: -2.65, quoteVolume: 6400000, category: "LAYER1", isFuturesPopular: true },
  { symbol: "NEARUSDT", baseAsset: "NEAR", quoteAsset: "USDT", fullName: "NEAR Protocol", price: 4.96, change24h: -1.00, quoteVolume: 5600000, category: "AI", isFuturesPopular: true },
  { symbol: "INJUSDT", baseAsset: "INJ", quoteAsset: "USDT", fullName: "Injective", price: 7.84, change24h: -0.17, quoteVolume: 5500000, category: "DEFI", isFuturesPopular: true },
  { symbol: "FILUSDT", baseAsset: "FIL", quoteAsset: "USDT", fullName: "Filecoin", price: 1.09, change24h: -4.72, quoteVolume: 5300000, category: "LAYER1", isFuturesPopular: true },
  { symbol: "ADAUSDT", baseAsset: "ADA", quoteAsset: "USDT", fullName: "Cardano", price: 0.228, change24h: -3.18, quoteVolume: 4800000, category: "LAYER1", isFuturesPopular: true },
  { symbol: "AVAXUSDT", baseAsset: "AVAX", quoteAsset: "USDT", fullName: "Avalanche", price: 28.45, change24h: 5.12, quoteVolume: 4500000, category: "LAYER1", isFuturesPopular: true },
  { symbol: "AEROUSDT", baseAsset: "AERO", quoteAsset: "USDT", fullName: "Aerodrome", price: 0.862, change24h: -4.78, quoteVolume: 4200000, category: "DEFI", isFuturesPopular: true },
  { symbol: "DOTUSDT", baseAsset: "DOT", quoteAsset: "USDT", fullName: "Polkadot", price: 1.122, change24h: -5.24, quoteVolume: 3900000, category: "LAYER1", isFuturesPopular: true },
  { symbol: "PEPEUSDT", baseAsset: "PEPE", quoteAsset: "USDT", fullName: "Pepe", price: 0.0000095, change24h: 15.80, quoteVolume: 12400000, category: "MEME", isFuturesPopular: true },
  { symbol: "SHIBUSDT", baseAsset: "SHIB", quoteAsset: "USDT", fullName: "Shiba Inu", price: 0.0000185, change24h: 3.25, quoteVolume: 8200000, category: "MEME", isFuturesPopular: true },
  { symbol: "WIFUSDT", baseAsset: "WIF", quoteAsset: "USDT", fullName: "dogwifhat", price: 1.45, change24h: 6.80, quoteVolume: 7800000, category: "MEME", isFuturesPopular: true },
  { symbol: "FETUSDT", baseAsset: "FET", quoteAsset: "USDT", fullName: "Artificial Superintelligence Alliance", price: 0.88, change24h: 4.15, quoteVolume: 6100000, category: "AI", isFuturesPopular: true },
  { symbol: "RENDERUSDT", baseAsset: "RENDER", quoteAsset: "USDT", fullName: "Render", price: 4.25, change24h: 3.40, quoteVolume: 5800000, category: "AI", isFuturesPopular: true },
  { symbol: "APTUSDT", baseAsset: "APT", quoteAsset: "USDT", fullName: "Aptos", price: 6.42, change24h: -1.85, quoteVolume: 4900000, category: "LAYER1", isFuturesPopular: true },
  { symbol: "TIAUSDT", baseAsset: "TIA", quoteAsset: "USDT", fullName: "Celestia", price: 3.12, change24h: -3.20, quoteVolume: 4700000, category: "LAYER1", isFuturesPopular: true },
  { symbol: "SEIUSDT", baseAsset: "SEI", quoteAsset: "USDT", fullName: "Sei", price: 0.28, change24h: 2.10, quoteVolume: 4100000, category: "LAYER1", isFuturesPopular: true },
  { symbol: "LINKUSDT", baseAsset: "LINK", quoteAsset: "USDT", fullName: "Chainlink", price: 11.24, change24h: -0.85, quoteVolume: 3800000, category: "DEFI", isFuturesPopular: true },
  { symbol: "MXUSDT", baseAsset: "MX", quoteAsset: "USDT", fullName: "MEXC Token", price: 3.84, change24h: 0.52, quoteVolume: 3500000, category: "TOP_FUTURES", isFuturesPopular: true },
  { symbol: "ARBUSDT", baseAsset: "ARB", quoteAsset: "USDT", fullName: "Arbitrum", price: 0.48, change24h: -2.40, quoteVolume: 3400000, category: "LAYER1", isFuturesPopular: true },
  { symbol: "OPUSDT", baseAsset: "OP", quoteAsset: "USDT", fullName: "Optimism", price: 1.15, change24h: -1.95, quoteVolume: 3200000, category: "LAYER1", isFuturesPopular: true },
  { symbol: "TRXUSDT", baseAsset: "TRX", quoteAsset: "USDT", fullName: "TRON", price: 0.334, change24h: 1.92, quoteVolume: 9700000, category: "LAYER1", isFuturesPopular: true },
];

/**
 * Formats quote volume in millions or thousands
 */
export function formatSymbolVolume(vol: number): string {
  if (vol >= 1_000_000_000) return `$${(vol / 1_000_000_000).toFixed(1)}B`;
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(0)}K`;
  return `$${vol.toFixed(0)}`;
}

/**
 * Retrieves the cached catalog from localStorage
 */
export function getCachedSymbolCatalog(): MexcMarketSymbol[] {
  if (typeof window === "undefined") return POPULAR_FUTURES_SYMBOLS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return POPULAR_FUTURES_SYMBOLS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : POPULAR_FUTURES_SYMBOLS;
  } catch {
    return POPULAR_FUTURES_SYMBOLS;
  }
}

/**
 * Fetches the full 1,480+ MEXC USDT symbol universe, with fallback to proxy route
 */
export async function fetchMexcSymbolCatalog(forceRefresh = false): Promise<MexcMarketSymbol[]> {
  if (typeof window === "undefined") return POPULAR_FUTURES_SYMBOLS;

  // 1. Check local cache validity
  if (!forceRefresh) {
    try {
      const tsRaw = localStorage.getItem(TIMESTAMP_KEY);
      const ts = tsRaw ? parseInt(tsRaw, 10) : 0;
      if (Date.now() - ts < CACHE_TTL_MS) {
        const cached = getCachedSymbolCatalog();
        if (cached.length > 100) return cached;
      }
    } catch {}
  }

  // 2. Fetch from Next.js proxy route
  try {
    const res = await fetch("/api/mexc/symbols", {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.symbols) && data.symbols.length > 0) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.symbols));
          localStorage.setItem(TIMESTAMP_KEY, Date.now().toString());
        } catch {}
        return data.symbols;
      }
    }
  } catch (err) {
    console.warn("Proxy /api/mexc/symbols fetch failed, attempting direct fetch", err);
  }

  // 3. Fallback to direct MEXC public endpoint
  try {
    const mexcBase = process.env.NEXT_PUBLIC_MEXC_API_BASE || "https://api.mexc.co";
    const [infoRes, tickerRes] = await Promise.all([
      fetch(`${mexcBase}/api/v3/exchangeInfo`, { headers: { Accept: "application/json" } }),
      fetch(`${mexcBase}/api/v3/ticker/24hr`, { headers: { Accept: "application/json" } }),
    ]);

    if (infoRes.ok && tickerRes.ok) {
      const infoData = await infoRes.json();
      const tickerData = await tickerRes.json();

      const tickerMap = new Map<string, any>();
      if (Array.isArray(tickerData)) {
        for (const t of tickerData) {
          if (t.symbol) tickerMap.set(t.symbol, t);
        }
      }

      const symbols: MexcMarketSymbol[] = (infoData.symbols || [])
        .filter((s: any) => s.quoteAsset === "USDT" && s.status === "1")
        .map((s: any) => {
          const ticker = tickerMap.get(s.symbol);
          const price = ticker ? parseFloat(ticker.lastPrice) || 0 : 0;
          const change24h = ticker ? parseFloat(ticker.priceChangePercent) * 100 : 0;
          const quoteVolume = ticker ? parseFloat(ticker.quoteVolume) || 0 : 0;

          const base = (s.baseAsset || "").toUpperCase();
          const plates: string[] = s.conceptPlates || [];
          const platesStr = plates.join(" ").toLowerCase();

          let category = "ALL";
          if (quoteVolume > 10_000_000 || ["BTC", "ETH", "SOL", "SUI", "XRP", "DOGE"].includes(base)) {
            category = "TOP_FUTURES";
          } else if (platesStr.includes("ai") || ["FET", "RENDER", "NEAR", "TAO"].includes(base)) {
            category = "AI";
          } else if (platesStr.includes("meme") || ["PEPE", "SHIB", "DOGE", "WIF"].includes(base)) {
            category = "MEME";
          } else if (platesStr.includes("defi") || ["ENA", "AAVE", "UNI", "CRV"].includes(base)) {
            category = "DEFI";
          } else if (platesStr.includes("layer 1") || ["BTC", "ETH", "SOL", "SUI", "BNB"].includes(base)) {
            category = "LAYER1";
          }

          return {
            symbol: s.symbol,
            baseAsset: s.baseAsset,
            quoteAsset: s.quoteAsset,
            fullName: s.fullName || s.baseAsset,
            price,
            change24h: parseFloat(change24h.toFixed(2)),
            quoteVolume,
            category,
            isFuturesPopular: quoteVolume >= 2_000_000 || category === "TOP_FUTURES",
          };
        })
        .sort((a: MexcMarketSymbol, b: MexcMarketSymbol) => b.quoteVolume - a.quoteVolume);

      if (symbols.length > 0) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
          localStorage.setItem(TIMESTAMP_KEY, Date.now().toString());
        } catch {}
        return symbols;
      }
    }
  } catch (err) {
    console.error("Direct MEXC symbol fetch failed, returning cached/popular", err);
  }

  return getCachedSymbolCatalog();
}

/**
 * High-performance search and filter across the symbol catalog
 */
export function filterAndSearchSymbols(
  query: string,
  category: SymbolCategory,
  catalog: MexcMarketSymbol[]
): MexcMarketSymbol[] {
  const cleanQ = query.trim().toUpperCase();

  return catalog.filter((item) => {
    // 1. Category Filter
    if (category === "TOP_FUTURES" && !item.isFuturesPopular && item.category !== "TOP_FUTURES") {
      return false;
    }
    if (category !== "ALL" && category !== "TOP_FUTURES" && item.category !== category) {
      return false;
    }

    // 2. Query Search
    if (!cleanQ) return true;

    return (
      item.symbol.includes(cleanQ) ||
      item.baseAsset.toUpperCase().includes(cleanQ) ||
      item.fullName.toUpperCase().includes(cleanQ)
    );
  });
}
