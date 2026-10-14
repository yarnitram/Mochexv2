import { CandlestickBar } from "@/lib/mexc/types";
import { ta } from "@/lib/indicators/ta-math";

export type ScreenerTimeframe = "5" | "15" | "60" | "240" | "1D";

export const SCREENER_TIMEFRAMES: Array<{ value: ScreenerTimeframe; label: string }> = [
  { value: "5", label: "5m" },
  { value: "15", label: "15m" },
  { value: "60", label: "1H" },
  { value: "240", label: "4H" },
  { value: "1D", label: "1D" },
];

export const CONFLUENCE_TIMEFRAMES: ScreenerTimeframe[] = ["15", "60", "240", "1D"];

export type TechnicalRating =
  | "STRONG_BUY"
  | "BUY"
  | "NEUTRAL"
  | "SELL"
  | "STRONG_SELL";

export type MacdCrossState =
  | "bullish_cross"
  | "bearish_cross"
  | "bullish"
  | "bearish"
  | "neutral";

export type EmaTrendState =
  | "strong_uptrend"
  | "uptrend"
  | "sideways"
  | "downtrend"
  | "strong_downtrend";

export type BollingerStatus =
  | "squeeze"
  | "upper_breakout"
  | "lower_breakout"
  | "normal";

export type ScreenerFilterPreset =
  | "all"
  | "oversold"
  | "overbought"
  | "macd_bull_cross"
  | "macd_bear_cross"
  | "volume_breakout"
  | "mtf_strong_buy"
  | "mtf_strong_sell"
  | "bb_squeeze";

export type ScreenerSortField =
  | "symbol"
  | "price"
  | "change24h"
  | "volume24h"
  | "rvol"
  | "rsi14"
  | "macdHistogram"
  | "bbWidthPct"
  | "score"
  | "mtfScore";

export type HeatmapColorMode = "change24h" | "rsi14" | "rating";

export interface TimeframeTechnicalMetrics {
  timeframe: ScreenerTimeframe;
  rsi14: number;
  rsiZone: "oversold" | "neutral" | "overbought";
  macdValue: number;
  macdSignal: number;
  macdHistogram: number;
  macdCross: MacdCrossState;
  ema20: number;
  ema50: number;
  ema200: number;
  emaTrend: EmaTrendState;
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  bbWidthPct: number;
  bbPercentB: number;
  bbStatus: BollingerStatus;
  rvol: number;
  isVolumeBreakout: boolean;
  score: number; // -100 to +100
  rating: TechnicalRating;
}

export interface ScreenerPairMetadata {
  symbol: string;
  name: string;
  category: "Layer 1" | "DeFi & Infra" | "Meme";
  basePrice: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number; // USDT quote volume
  seedProfile:
    | "oversold_bounce"
    | "overbought_rally"
    | "macd_bull_cross"
    | "macd_bear_cross"
    | "bb_squeeze"
    | "vol_breakout"
    | "strong_uptrend"
    | "strong_downtrend";
}

export interface ScreenerPairRow {
  symbol: string;
  name: string;
  category: "Layer 1" | "DeFi & Infra" | "Meme";
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timeframes: Record<ScreenerTimeframe, TimeframeTechnicalMetrics>;
  mtfScore: number; // average score across 15m, 1H, 4H, 1D
  mtfRating: TechnicalRating;
  bullishTfCount: number; // out of 4 confluence TFs
  bearishTfCount: number; // out of 4 confluence TFs
  lastUpdatedMs: number;
  isLiveSynced?: boolean;
}

export interface HeatmapTileItem {
  symbol: string;
  baseAsset: string;
  name: string;
  category: string;
  price: number;
  change24h: number;
  volume24h: number;
  rsi14: number;
  rvol: number;
  rating: TechnicalRating;
  mtfRating: TechnicalRating;
  weightPct: number; // relative tile weight (5 - 100)
  bgColor: string;
  borderColor: string;
  textColor: string;
}

export const MEXC_SCREENER_UNIVERSE: ScreenerPairMetadata[] = [
  {
    symbol: "BTCUSDT",
    name: "Bitcoin",
    category: "Layer 1",
    basePrice: 68420.5,
    change24h: 3.42,
    high24h: 69120.0,
    low24h: 67200.0,
    volume24h: 148500000,
    seedProfile: "strong_uptrend",
  },
  {
    symbol: "ETHUSDT",
    name: "Ethereum",
    category: "Layer 1",
    basePrice: 3485.2,
    change24h: -1.15,
    high24h: 3560.0,
    low24h: 3410.0,
    volume24h: 86400000,
    seedProfile: "oversold_bounce",
  },
  {
    symbol: "SOLUSDT",
    name: "Solana",
    category: "Layer 1",
    basePrice: 178.65,
    change24h: 7.82,
    high24h: 182.0,
    low24h: 165.2,
    volume24h: 92450000,
    seedProfile: "vol_breakout",
  },
  {
    symbol: "SUIUSDT",
    name: "Sui Network",
    category: "Layer 1",
    basePrice: 1.94,
    change24h: 12.4,
    high24h: 2.05,
    low24h: 1.72,
    volume24h: 48900000,
    seedProfile: "overbought_rally",
  },
  {
    symbol: "BNBUSDT",
    name: "BNB",
    category: "Layer 1",
    basePrice: 588.4,
    change24h: 1.25,
    high24h: 595.0,
    low24h: 580.0,
    volume24h: 31200000,
    seedProfile: "bb_squeeze",
  },
  {
    symbol: "XRPUSDT",
    name: "Ripple",
    category: "Layer 1",
    basePrice: 0.542,
    change24h: -0.45,
    high24h: 0.555,
    low24h: 0.538,
    volume24h: 39800000,
    seedProfile: "bb_squeeze",
  },
  {
    symbol: "DOGEUSDT",
    name: "Dogecoin",
    category: "Meme",
    basePrice: 0.128,
    change24h: 4.12,
    high24h: 0.134,
    low24h: 0.122,
    volume24h: 54200000,
    seedProfile: "macd_bull_cross",
  },
  {
    symbol: "PEPEUSDT",
    name: "Pepe",
    category: "Meme",
    basePrice: 0.0000095,
    change24h: 15.8,
    high24h: 0.0000099,
    low24h: 0.0000081,
    volume24h: 62500000,
    seedProfile: "overbought_rally",
  },
  {
    symbol: "SHIBUSDT",
    name: "Shiba Inu",
    category: "Meme",
    basePrice: 0.0000185,
    change24h: -3.25,
    high24h: 0.0000194,
    low24h: 0.0000179,
    volume24h: 27400000,
    seedProfile: "macd_bear_cross",
  },
  {
    symbol: "AVAXUSDT",
    name: "Avalanche",
    category: "Layer 1",
    basePrice: 28.45,
    change24h: 5.12,
    high24h: 29.1,
    low24h: 26.9,
    volume24h: 24600000,
    seedProfile: "macd_bull_cross",
  },
  {
    symbol: "NEARUSDT",
    name: "NEAR Protocol",
    category: "DeFi & Infra",
    basePrice: 4.88,
    change24h: 8.64,
    high24h: 5.02,
    low24h: 4.45,
    volume24h: 29100000,
    seedProfile: "vol_breakout",
  },
  {
    symbol: "LINKUSDT",
    name: "Chainlink",
    category: "DeFi & Infra",
    basePrice: 11.24,
    change24h: -2.85,
    high24h: 11.75,
    low24h: 11.05,
    volume24h: 19800000,
    seedProfile: "oversold_bounce",
  },
  {
    symbol: "ADAUSDT",
    name: "Cardano",
    category: "Layer 1",
    basePrice: 0.354,
    change24h: -4.15,
    high24h: 0.372,
    low24h: 0.348,
    volume24h: 18400000,
    seedProfile: "strong_downtrend",
  },
  {
    symbol: "DOTUSDT",
    name: "Polkadot",
    category: "DeFi & Infra",
    basePrice: 4.15,
    change24h: -1.92,
    high24h: 4.28,
    low24h: 4.09,
    volume24h: 14900000,
    seedProfile: "macd_bear_cross",
  },
  {
    symbol: "MXUSDT",
    name: "MEXC Token",
    category: "DeFi & Infra",
    basePrice: 3.84,
    change24h: 2.52,
    high24h: 3.92,
    low24h: 3.74,
    volume24h: 12800000,
    seedProfile: "strong_uptrend",
  },
];

/**
 * Maps a numeric technical score (-100 to +100) to an institutional TradingView rating.
 */
export function scoreToTechnicalRating(score: number): TechnicalRating {
  if (score >= 45) return "STRONG_BUY";
  if (score >= 15) return "BUY";
  if (score <= -45) return "STRONG_SELL";
  if (score <= -15) return "SELL";
  return "NEUTRAL";
}

/**
 * Computes full single-timeframe technical indicators (RSI 14, MACD 12/26/9, EMA 20/50/200,
 * Bollinger Bands 20/2, RVOL 20-period surge, and composite Technical Rating) from OHLCV bars.
 */
export function computeTimeframeTechnicals(
  bars: CandlestickBar[],
  timeframe: ScreenerTimeframe
): TimeframeTechnicalMetrics {
  if (!bars || bars.length === 0) {
    return {
      timeframe,
      rsi14: 50,
      rsiZone: "neutral",
      macdValue: 0,
      macdSignal: 0,
      macdHistogram: 0,
      macdCross: "neutral",
      ema20: 0,
      ema50: 0,
      ema200: 0,
      emaTrend: "sideways",
      bbUpper: 0,
      bbMiddle: 0,
      bbLower: 0,
      bbWidthPct: 0,
      bbPercentB: 0.5,
      bbStatus: "normal",
      rvol: 1,
      isVolumeBreakout: false,
      score: 0,
      rating: "NEUTRAL",
    };
  }

  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);
  const lastClose = closes[closes.length - 1];

  // 1. RSI (14)
  const rsiSeries = ta.rsi(closes, 14);
  const rawRsi = rsiSeries.length > 0 ? rsiSeries[rsiSeries.length - 1] : 50;
  const rsi14 = Number.isFinite(rawRsi) ? Number(rawRsi.toFixed(2)) : 50;
  const rsiZone: TimeframeTechnicalMetrics["rsiZone"] =
    rsi14 <= 30 ? "oversold" : rsi14 >= 70 ? "overbought" : "neutral";

  // 2. MACD (12, 26, 9)
  const macdSeries = ta.macd(closes, 12, 26, 9);
  const lastMacd = macdSeries.length > 0 ? macdSeries[macdSeries.length - 1] : undefined;
  const prevMacd = macdSeries.length > 1 ? macdSeries[macdSeries.length - 2] : undefined;

  const macdValue = lastMacd?.macd ?? 0;
  const macdSignal = lastMacd?.signal ?? 0;
  const macdHistogram = lastMacd?.histogram ?? 0;
  const prevHist = prevMacd?.histogram ?? 0;

  let macdCross: MacdCrossState = "neutral";
  if (macdHistogram > 0 && prevHist <= 0) {
    macdCross = "bullish_cross";
  } else if (macdHistogram < 0 && prevHist >= 0) {
    macdCross = "bearish_cross";
  } else if (macdHistogram > 0) {
    macdCross = "bullish";
  } else if (macdHistogram < 0) {
    macdCross = "bearish";
  }

  // 3. EMA 20 / 50 / 200 Trend Alignment
  const ema20Arr = ta.ema(closes, Math.min(20, Math.max(2, closes.length)));
  const ema50Arr = ta.ema(closes, Math.min(50, Math.max(2, closes.length)));
  const ema200Arr = ta.ema(closes, Math.min(200, Math.max(2, closes.length)));

  const ema20 = ema20Arr.length > 0 ? ema20Arr[ema20Arr.length - 1] : lastClose;
  const ema50 = ema50Arr.length > 0 ? ema50Arr[ema50Arr.length - 1] : lastClose;
  const ema200 = ema200Arr.length > 0 ? ema200Arr[ema200Arr.length - 1] : lastClose;

  let emaTrend: EmaTrendState = "sideways";
  if (lastClose > ema20 && ema20 > ema50 && ema50 >= ema200) {
    emaTrend = "strong_uptrend";
  } else if (lastClose > ema20 && lastClose >= ema50) {
    emaTrend = "uptrend";
  } else if (lastClose < ema20 && ema20 < ema50 && ema50 <= ema200) {
    emaTrend = "strong_downtrend";
  } else if (lastClose < ema20 && lastClose <= ema50) {
    emaTrend = "downtrend";
  }

  // 4. Bollinger Bands (20, 2)
  const bbPeriod = Math.min(20, Math.max(5, closes.length));
  const bbSeries = ta.bollingerbands(closes, bbPeriod, 2);
  const lastBb = bbSeries.length > 0 ? bbSeries[bbSeries.length - 1] : undefined;
  const bbUpper = lastBb?.upper ?? lastClose * 1.02;
  const bbMiddle = lastBb?.middle ?? lastClose;
  const bbLower = lastBb?.lower ?? lastClose * 0.98;
  const bandRange = Math.max(1e-12, bbUpper - bbLower);
  const bbWidthPct = bbMiddle > 0 ? Number((((bbUpper - bbLower) / bbMiddle) * 100).toFixed(2)) : 0;
  const bbPercentB = Number(((lastClose - bbLower) / bandRange).toFixed(2));

  let bbStatus: BollingerStatus = "normal";
  if (bbWidthPct > 0 && bbWidthPct <= 2.2) {
    bbStatus = "squeeze";
  } else if (lastClose > bbUpper) {
    bbStatus = "upper_breakout";
  } else if (lastClose < bbLower) {
    bbStatus = "lower_breakout";
  }

  // 5. Relative Volume (RVOL vs 20-bar average)
  const volSlice = volumes.slice(-21, -1);
  const avgVol =
    volSlice.length > 0
      ? volSlice.reduce((acc, v) => acc + v, 0) / volSlice.length
      : volumes[volumes.length - 1] || 1;
  const currentVol = volumes[volumes.length - 1] || avgVol;
  const rvol = avgVol > 0 ? Number((currentVol / avgVol).toFixed(2)) : 1.0;
  const isVolumeBreakout = rvol >= 1.8;

  // 6. Composite Institutional Technical Score (-100 to +100)
  let score = 0;

  // EMA Trend component (-40 to +40)
  if (emaTrend === "strong_uptrend") score += 40;
  else if (emaTrend === "uptrend") score += 20;
  else if (emaTrend === "strong_downtrend") score -= 40;
  else if (emaTrend === "downtrend") score -= 20;

  // MACD component (-30 to +30)
  if (macdCross === "bullish_cross") score += 30;
  else if (macdCross === "bullish") score += 15;
  else if (macdCross === "bearish_cross") score -= 30;
  else if (macdCross === "bearish") score -= 15;

  // RSI momentum / mean-reversion component (-20 to +20)
  if (rsi14 >= 55 && rsi14 <= 68) score += 15;
  else if (rsi14 < 30) score += 10; // oversold bounce potential
  else if (rsi14 > 75) score -= 10; // overextended
  else if (rsi14 <= 45 && rsi14 >= 30) score -= 15;

  // Volume & Breakout boost (-10 to +10)
  if (isVolumeBreakout) {
    score += emaTrend === "strong_downtrend" || emaTrend === "downtrend" ? -10 : 10;
  }

  const clampedScore = Math.max(-100, Math.min(100, Math.round(score)));
  const rating = scoreToTechnicalRating(clampedScore);

  return {
    timeframe,
    rsi14,
    rsiZone,
    macdValue,
    macdSignal,
    macdHistogram,
    macdCross,
    ema20,
    ema50,
    ema200,
    emaTrend,
    bbUpper,
    bbMiddle,
    bbLower,
    bbWidthPct,
    bbPercentB,
    bbStatus,
    rvol,
    isVolumeBreakout,
    score: clampedScore,
    rating,
  };
}

/**
 * Generates deterministic, realistic OHLCV candlestick series for a given pair and timeframe
 * so initial hydration is instantaneous and each seed profile exhibits authentic indicator states.
 */
export function generateDeterministicPairBars(
  meta: ScreenerPairMetadata,
  timeframe: ScreenerTimeframe,
  count = 120
): CandlestickBar[] {
  const tfMultiplier: Record<ScreenerTimeframe, number> = {
    "5": 1,
    "15": 2,
    "60": 3,
    "240": 4,
    "1D": 5,
  };
  const stepMsMap: Record<ScreenerTimeframe, number> = {
    "5": 5 * 60 * 1000,
    "15": 15 * 60 * 1000,
    "60": 60 * 60 * 1000,
    "240": 4 * 60 * 60 * 1000,
    "1D": 24 * 60 * 60 * 1000,
  };

  const stepMs = stepMsMap[timeframe];
  const nowAligned = Math.floor(1760330000000 / stepMs) * stepMs;
  const seedHash = meta.symbol
    .split("")
    .reduce((acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 1), tfMultiplier[timeframe] * 17);

  const bars: CandlestickBar[] = [];
  let price = meta.basePrice * 0.96;

  // Adjust starting price so the trajectory lands near meta.basePrice with the desired technical profile
  if (meta.seedProfile === "oversold_bounce") {
    price = meta.basePrice * 1.09;
  } else if (meta.seedProfile === "overbought_rally") {
    price = meta.basePrice * 0.86;
  } else if (meta.seedProfile === "strong_downtrend") {
    price = meta.basePrice * 1.12;
  } else if (meta.seedProfile === "bb_squeeze") {
    price = meta.basePrice * 0.998;
  }

  const baseBarVol = Math.max(100, meta.volume24h / 96);

  for (let i = 0; i < count; i++) {
    const progress = i / count;
    const wave = Math.sin((i + seedHash) * 0.35) * 0.004;
    let drift = 0.0005;

    switch (meta.seedProfile) {
      case "oversold_bounce":
        // Steady decline especially in the last 18 bars to drive RSI(14) < 28
        drift = i > count - 20 ? -0.0068 : -0.0004;
        break;
      case "overbought_rally":
        // Strong rally in the last 20 bars to drive RSI(14) > 74
        drift = i > count - 22 ? 0.0078 : 0.0008;
        break;
      case "macd_bull_cross":
        // Pullback then sharp turn up on the very last 2 bars to trigger fresh MACD histogram flip <=0 to >0
        if (i < count - 15) drift = 0.0012;
        else if (i < count - 2) drift = -0.0032;
        else drift = 0.0115;
        break;
      case "macd_bear_cross":
        // Rally then sharp drop on the last 2 bars to trigger fresh MACD histogram flip >=0 to <0
        if (i < count - 15) drift = -0.001;
        else if (i < count - 2) drift = 0.0032;
        else drift = -0.0115;
        break;
      case "bb_squeeze":
        // Ultra-tight volatility compression in final 25 bars (BB width < 2.0%)
        drift = Math.sin(i * 0.5) * 0.0004;
        break;
      case "vol_breakout":
        // Strong trend with massive volume surge on final bar
        drift = i > count - 12 ? 0.0048 : 0.0009;
        break;
      case "strong_uptrend":
        drift = 0.0022 + progress * 0.0015;
        break;
      case "strong_downtrend":
        drift = -0.0024 - progress * 0.0015;
        break;
    }

    const noise =
      meta.seedProfile === "bb_squeeze" && i >= count - 25
        ? Math.sin(i * 0.9) * 0.0006
        : wave;

    const open = price;
    const close = Math.max(meta.basePrice * 0.1, open * (1 + drift + noise));
    const spreadPct =
      meta.seedProfile === "bb_squeeze" && i >= count - 25 ? 0.0015 : 0.006;
    const high = Math.max(open, close) * (1 + spreadPct);
    const low = Math.min(open, close) * (1 - spreadPct);

    let volume = baseBarVol * (0.85 + ((i * 13 + seedHash) % 35) / 100);
    if (
      i === count - 1 &&
      (meta.seedProfile === "vol_breakout" ||
        meta.seedProfile === "overbought_rally" ||
        meta.seedProfile === "macd_bull_cross")
    ) {
      volume = baseBarVol * (meta.seedProfile === "vol_breakout" ? 2.65 : 1.95);
    }

    bars.push({
      time: nowAligned - (count - 1 - i) * stepMs,
      open,
      high,
      low,
      close,
      volume,
    });

    price = close;
  }

  // Scale series so final bar close exactly matches meta.basePrice
  const finalClose = bars[bars.length - 1]?.close || meta.basePrice;
  const scale = finalClose > 0 ? meta.basePrice / finalClose : 1;

  return bars.map((b) => ({
    time: b.time,
    open: b.open * scale,
    high: b.high * scale,
    low: b.low * scale,
    close: b.close * scale,
    volume: b.volume,
  }));
}

/**
 * Computes multi-timeframe confluence summary from a pair's timeframe metrics map.
 */
export function computeMultiTimeframeConfluence(
  timeframes: Record<ScreenerTimeframe, TimeframeTechnicalMetrics>
): {
  mtfScore: number;
  mtfRating: TechnicalRating;
  bullishTfCount: number;
  bearishTfCount: number;
} {
  let totalScore = 0;
  let bullishTfCount = 0;
  let bearishTfCount = 0;

  for (const tf of CONFLUENCE_TIMEFRAMES) {
    const m = timeframes[tf];
    if (!m) continue;
    totalScore += m.score;
    if (m.rating === "STRONG_BUY" || m.rating === "BUY") bullishTfCount++;
    if (m.rating === "STRONG_SELL" || m.rating === "SELL") bearishTfCount++;
  }

  const mtfScore = Math.round(totalScore / CONFLUENCE_TIMEFRAMES.length);
  const mtfRating = scoreToTechnicalRating(mtfScore);

  return {
    mtfScore,
    mtfRating,
    bullishTfCount,
    bearishTfCount,
  };
}

/**
 * Builds the initial 15-pair multi-timeframe screener snapshot with zero latency.
 */
export function buildInitialScreenerSnapshot(
  universe: ScreenerPairMetadata[] = MEXC_SCREENER_UNIVERSE
): ScreenerPairRow[] {
  const now = Date.now();
  return universe.map((meta) => {
    const timeframes = {} as Record<ScreenerTimeframe, TimeframeTechnicalMetrics>;
    for (const tf of SCREENER_TIMEFRAMES) {
      const bars = generateDeterministicPairBars(meta, tf.value, 120);
      timeframes[tf.value] = computeTimeframeTechnicals(bars, tf.value);
    }

    const confluence = computeMultiTimeframeConfluence(timeframes);

    return {
      symbol: meta.symbol,
      name: meta.name,
      category: meta.category,
      price: meta.basePrice,
      change24h: meta.change24h,
      high24h: meta.high24h,
      low24h: meta.low24h,
      volume24h: meta.volume24h,
      timeframes,
      ...confluence,
      lastUpdatedMs: now,
      isLiveSynced: false,
    };
  });
}

/**
 * Updates a pair row when live MEXC klines arrive for a given timeframe.
 */
export function updateScreenerPairWithKlines(
  row: ScreenerPairRow,
  timeframe: ScreenerTimeframe,
  bars: CandlestickBar[]
): ScreenerPairRow {
  if (!bars || bars.length < 20) return row;

  const updatedTfMetrics = computeTimeframeTechnicals(bars, timeframe);
  const nextTimeframes: Record<ScreenerTimeframe, TimeframeTechnicalMetrics> = {
    ...row.timeframes,
    [timeframe]: updatedTfMetrics,
  };
  const confluence = computeMultiTimeframeConfluence(nextTimeframes);
  const latestBar = bars[bars.length - 1];

  return {
    ...row,
    price: latestBar ? latestBar.close : row.price,
    timeframes: nextTimeframes,
    ...confluence,
    lastUpdatedMs: Date.now(),
    isLiveSynced: true,
  };
}

export interface ScreenerFilterOptions {
  timeframe: ScreenerTimeframe;
  preset: ScreenerFilterPreset;
  category?: "ALL" | "Layer 1" | "DeFi & Infra" | "Meme";
  searchQuery?: string;
  sortField?: ScreenerSortField;
  sortDirection?: "asc" | "desc";
}

/**
 * Evaluates whether a ScreenerPairRow matches the selected institutional preset on the active timeframe.
 */
export function matchesScreenerPreset(
  row: ScreenerPairRow,
  timeframe: ScreenerTimeframe,
  preset: ScreenerFilterPreset
): boolean {
  const tf = row.timeframes[timeframe];
  if (!tf) return false;

  switch (preset) {
    case "all":
      return true;
    case "oversold":
      return tf.rsi14 <= 32;
    case "overbought":
      return tf.rsi14 >= 68;
    case "macd_bull_cross":
      return tf.macdCross === "bullish_cross";
    case "macd_bear_cross":
      return tf.macdCross === "bearish_cross";
    case "volume_breakout":
      return tf.isVolumeBreakout || tf.rvol >= 1.8;
    case "mtf_strong_buy":
      return row.mtfRating === "STRONG_BUY" || row.bullishTfCount >= 3;
    case "mtf_strong_sell":
      return row.mtfRating === "STRONG_SELL" || row.bearishTfCount >= 3;
    case "bb_squeeze":
      return tf.bbStatus === "squeeze";
    default:
      return true;
  }
}

/**
 * Filters and sorts screener rows according to active timeframe, preset, category, search, and column sort.
 */
export function filterAndSortScreenerRows(
  rows: ScreenerPairRow[],
  options: ScreenerFilterOptions
): ScreenerPairRow[] {
  const {
    timeframe,
    preset,
    category = "ALL",
    searchQuery = "",
    sortField = "volume24h",
    sortDirection = "desc",
  } = options;

  const trimmedQuery = searchQuery.trim().toLowerCase();

  const filtered = rows.filter((row) => {
    if (category !== "ALL" && row.category !== category) {
      return false;
    }
    if (trimmedQuery) {
      const matchSym = row.symbol.toLowerCase().includes(trimmedQuery);
      const matchName = row.name.toLowerCase().includes(trimmedQuery);
      if (!matchSym && !matchName) return false;
    }
    return matchesScreenerPreset(row, timeframe, preset);
  });

  const dir = sortDirection === "asc" ? 1 : -1;

  return [...filtered].sort((a, b) => {
    const tfA = a.timeframes[timeframe];
    const tfB = b.timeframes[timeframe];

    switch (sortField) {
      case "symbol":
        return a.symbol.localeCompare(b.symbol) * dir;
      case "price":
        return (a.price - b.price) * dir;
      case "change24h":
        return (a.change24h - b.change24h) * dir;
      case "volume24h":
        return (a.volume24h - b.volume24h) * dir;
      case "rvol":
        return ((tfA?.rvol ?? 0) - (tfB?.rvol ?? 0)) * dir;
      case "rsi14":
        return ((tfA?.rsi14 ?? 50) - (tfB?.rsi14 ?? 50)) * dir;
      case "macdHistogram":
        return ((tfA?.macdHistogram ?? 0) - (tfB?.macdHistogram ?? 0)) * dir;
      case "bbWidthPct":
        return ((tfA?.bbWidthPct ?? 0) - (tfB?.bbWidthPct ?? 0)) * dir;
      case "score":
        return ((tfA?.score ?? 0) - (tfB?.score ?? 0)) * dir;
      case "mtfScore":
        return (a.mtfScore - b.mtfScore) * dir;
      default:
        return 0;
    }
  });
}

/**
 * Computes 2D Market Heatmap tiles sized by 24h Volume and colored by the active HeatmapColorMode.
 */
export function computeHeatmapTiles(
  rows: ScreenerPairRow[],
  timeframe: ScreenerTimeframe,
  colorMode: HeatmapColorMode
): HeatmapTileItem[] {
  if (rows.length === 0) return [];

  const logVolumes = rows.map((r) => Math.log10(Math.max(1000, r.volume24h)));
  const minLog = Math.min(...logVolumes);
  const maxLog = Math.max(...logVolumes);
  const logRange = Math.max(0.001, maxLog - minLog);

  return rows.map((row) => {
    const tf = row.timeframes[timeframe];
    const rsi14 = tf?.rsi14 ?? 50;
    const rvol = tf?.rvol ?? 1;
    const rating = tf?.rating ?? "NEUTRAL";

    const logVol = Math.log10(Math.max(1000, row.volume24h));
    const weightPct = Number((25 + ((logVol - minLog) / logRange) * 75).toFixed(1));

    let bgColor = "rgba(30, 36, 50, 0.85)";
    let borderColor = "rgba(148, 163, 184, 0.25)";
    let textColor = "#e2e8f0";

    if (colorMode === "change24h") {
      if (row.change24h >= 5) {
        bgColor = "rgba(0, 192, 135, 0.32)";
        borderColor = "rgba(0, 192, 135, 0.7)";
        textColor = "#6ee7b7";
      } else if (row.change24h >= 0) {
        bgColor = "rgba(0, 192, 135, 0.16)";
        borderColor = "rgba(0, 192, 135, 0.4)";
        textColor = "#a7f3d0";
      } else if (row.change24h <= -3) {
        bgColor = "rgba(255, 59, 48, 0.32)";
        borderColor = "rgba(255, 59, 48, 0.7)";
        textColor = "#fca5a5";
      } else {
        bgColor = "rgba(255, 59, 48, 0.16)";
        borderColor = "rgba(255, 59, 48, 0.4)";
        textColor = "#fecaca";
      }
    } else if (colorMode === "rsi14") {
      if (rsi14 <= 30) {
        // Oversold Emerald
        bgColor = "rgba(0, 192, 135, 0.3)";
        borderColor = "rgba(0, 192, 135, 0.75)";
        textColor = "#6ee7b7";
      } else if (rsi14 >= 70) {
        // Overbought Crimson
        bgColor = "rgba(255, 59, 48, 0.3)";
        borderColor = "rgba(255, 59, 48, 0.75)";
        textColor = "#fca5a5";
      } else if (rsi14 >= 55) {
        bgColor = "rgba(41, 98, 255, 0.22)";
        borderColor = "rgba(41, 98, 255, 0.5)";
        textColor = "#93c5fd";
      } else {
        bgColor = "rgba(30, 41, 59, 0.75)";
        borderColor = "rgba(100, 116, 139, 0.35)";
        textColor = "#cbd5e1";
      }
    } else if (colorMode === "rating") {
      if (rating === "STRONG_BUY") {
        bgColor = "rgba(0, 192, 135, 0.34)";
        borderColor = "rgba(0, 192, 135, 0.75)";
        textColor = "#6ee7b7";
      } else if (rating === "BUY") {
        bgColor = "rgba(0, 192, 135, 0.18)";
        borderColor = "rgba(0, 192, 135, 0.45)";
        textColor = "#a7f3d0";
      } else if (rating === "STRONG_SELL") {
        bgColor = "rgba(255, 59, 48, 0.34)";
        borderColor = "rgba(255, 59, 48, 0.75)";
        textColor = "#fca5a5";
      } else if (rating === "SELL") {
        bgColor = "rgba(255, 59, 48, 0.18)";
        borderColor = "rgba(255, 59, 48, 0.45)";
        textColor = "#fecaca";
      }
    }

    return {
      symbol: row.symbol,
      baseAsset: row.symbol.replace(/USDT$/, ""),
      name: row.name,
      category: row.category,
      price: row.price,
      change24h: row.change24h,
      volume24h: row.volume24h,
      rsi14,
      rvol,
      rating,
      mtfRating: row.mtfRating,
      weightPct,
      bgColor,
      borderColor,
      textColor,
    };
  });
}
