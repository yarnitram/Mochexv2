import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const mexcBase = process.env.NEXT_PUBLIC_MEXC_API_BASE || "https://api.mexc.co";

  try {
    const [infoRes, tickerRes] = await Promise.all([
      fetch(`${mexcBase}/api/v3/exchangeInfo`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 300 }, // 5 min cache
      }),
      fetch(`${mexcBase}/api/v3/ticker/24hr`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 30 }, // 30 sec cache
      }),
    ]);

    if (!infoRes.ok || !tickerRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch from upstream MEXC" },
        { status: 502 }
      );
    }

    const infoData = await infoRes.json();
    const tickerData = await tickerRes.json();

    const tickerMap = new Map<string, any>();
    if (Array.isArray(tickerData)) {
      for (const t of tickerData) {
        if (t.symbol) tickerMap.set(t.symbol, t);
      }
    }

    const usdtSymbols = (infoData.symbols || [])
      .filter((s: any) => s.quoteAsset === "USDT" && s.status === "1")
      .map((s: any) => {
        const ticker = tickerMap.get(s.symbol);
        const lastPrice = ticker ? parseFloat(ticker.lastPrice) || 0 : 0;
        const change24h = ticker ? parseFloat(ticker.priceChangePercent) * 100 : 0;
        const quoteVolume = ticker ? parseFloat(ticker.quoteVolume) || 0 : 0;

        // Categorize based on conceptPlates and token conventions
        const plates: string[] = s.conceptPlates || [];
        const platesStr = plates.join(" ").toLowerCase();
        const base = (s.baseAsset || "").toUpperCase();

        let category = "ALL";
        const isL1 =
          platesStr.includes("layer 1") ||
          platesStr.includes("public chain") ||
          ["BTC", "ETH", "SOL", "SUI", "BNB", "AVAX", "NEAR", "ADA", "DOT", "APT", "SEI", "INJ", "TON"].includes(base);
        const isDefi =
          platesStr.includes("defi") ||
          platesStr.includes("dex") ||
          ["UNI", "AAVE", "MKR", "CRV", "ENA", "LDO", "PENDLE", "CAKE", "RAY"].includes(base);
        const isMeme =
          platesStr.includes("meme") ||
          ["DOGE", "SHIB", "PEPE", "WIF", "BONK", "FLOKI", "BOME", "POPCAT", "MEME"].includes(base);
        const isAi =
          platesStr.includes("ai") ||
          platesStr.includes("artificial intelligence") ||
          ["FET", "RENDER", "NEAR", "TAO", "AGIX", "OCEAN", "WLD", "ARKM", "IO"].includes(base);

        if (quoteVolume > 10_000_000 || ["BTC", "ETH", "SOL", "SUI", "XRP", "DOGE"].includes(base)) {
          category = "TOP_FUTURES";
        } else if (isAi) {
          category = "AI";
        } else if (isMeme) {
          category = "MEME";
        } else if (isDefi) {
          category = "DEFI";
        } else if (isL1) {
          category = "LAYER1";
        }

        return {
          symbol: s.symbol,
          baseAsset: s.baseAsset,
          quoteAsset: s.quoteAsset,
          fullName: s.fullName || s.baseAsset,
          price: lastPrice,
          change24h: parseFloat(change24h.toFixed(2)),
          quoteVolume,
          category,
          isFuturesPopular: quoteVolume >= 2_000_000 || category === "TOP_FUTURES",
        };
      })
      .sort((a: any, b: any) => b.quoteVolume - a.quoteVolume);

    return NextResponse.json({
      success: true,
      count: usdtSymbols.length,
      updatedAt: Date.now(),
      symbols: usdtSymbols,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error fetching symbols" },
      { status: 500 }
    );
  }
}
