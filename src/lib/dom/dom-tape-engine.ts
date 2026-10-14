import { DepthLevel, MexcDealItem } from "@/lib/mexc/types";
import { PaperLimitOrder } from "@/lib/trading/paper-trading-engine";

export type TradeSizeTier = "normal" | "large" | "whale" | "megalodon";

export interface CumulativeVolumeDelta {
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  netDelta: number;
  buyRatioPct: number;
  sellRatioPct: number;
}

export interface DOMProcessedLevel {
  price: number;
  amount: number;
  total: number;
  depthRatio: number; // 0 to 100%
  side: "ask" | "bid";
  userOrders: PaperLimitOrder[];
}

export interface DOMSummary {
  processedAsks: DOMProcessedLevel[];
  processedBids: DOMProcessedLevel[];
  bestAsk: number;
  bestBid: number;
  spread: number;
  spreadPct: number;
  bidDepthTotal: number;
  askDepthTotal: number;
  bidDepthRatioPct: number;
  maxTotal: number;
}

/**
 * Classifies trade print by notional quote volume ($ value).
 * - Normal: < $5,000
 * - Large: >= $5,000
 * - Whale: >= $20,000
 * - Megalodon: >= $100,000
 */
export function classifyTradeSize(quoteAmount: number): TradeSizeTier {
  if (quoteAmount >= 100_000) return "megalodon";
  if (quoteAmount >= 20_000) return "whale";
  if (quoteAmount >= 5_000) return "large";
  return "normal";
}

export function getSizeTierLabel(tier: TradeSizeTier): string {
  switch (tier) {
    case "megalodon":
      return "👑 MEGALODON";
    case "whale":
      return "🐋 WHALE";
    case "large":
      return "LARGE";
    default:
      return "NORMAL";
  }
}

/**
 * Calculates Cumulative Volume Delta (CVD) for a batch or stream of trades.
 */
export function calculateCumulativeDelta(deals: MexcDealItem[]): CumulativeVolumeDelta {
  let buyVolume = 0;
  let sellVolume = 0;

  for (const deal of deals) {
    if (deal.side === "buy") {
      buyVolume += deal.quoteAmount || deal.price * deal.amount;
    } else {
      sellVolume += deal.quoteAmount || deal.price * deal.amount;
    }
  }

  const totalVolume = buyVolume + sellVolume;
  const netDelta = buyVolume - sellVolume;
  const buyRatioPct = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 50;
  const sellRatioPct = totalVolume > 0 ? (sellVolume / totalVolume) * 100 : 50;

  return {
    buyVolume,
    sellVolume,
    totalVolume,
    netDelta,
    buyRatioPct,
    sellRatioPct,
  };
}

/**
 * Incrementally updates Cumulative Volume Delta with new incoming trades.
 */
export function updateCumulativeDelta(
  prev: CumulativeVolumeDelta,
  incoming: MexcDealItem[]
): CumulativeVolumeDelta {
  let addBuy = 0;
  let addSell = 0;

  for (const deal of incoming) {
    if (deal.side === "buy") {
      addBuy += deal.quoteAmount || deal.price * deal.amount;
    } else {
      addSell += deal.quoteAmount || deal.price * deal.amount;
    }
  }

  const buyVolume = prev.buyVolume + addBuy;
  const sellVolume = prev.sellVolume + addSell;
  const totalVolume = buyVolume + sellVolume;
  const netDelta = buyVolume - sellVolume;
  const buyRatioPct = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 50;
  const sellRatioPct = totalVolume > 0 ? (sellVolume / totalVolume) * 100 : 50;

  return {
    buyVolume,
    sellVolume,
    totalVolume,
    netDelta,
    buyRatioPct,
    sellRatioPct,
  };
}

/**
 * Processes Level 2 Order Book Depth into a structured DOM ladder.
 * Computes relative volume bars, spread, and attaches matching paper orders.
 */
export function processDOMLevels(
  asks: DepthLevel[],
  bids: DepthLevel[],
  currentPrice: number,
  openOrders: PaperLimitOrder[] = [],
  depthCount: number = 12
): DOMSummary {
  // Sort Asks ascending (lowest ask to highest ask) and take bottom N closest to mid
  const validAsks = [...asks].filter((a) => a.price > 0 && a.amount > 0).sort((a, b) => a.price - b.price);
  const slicedAsks = validAsks.slice(0, depthCount);

  // Sort Bids descending (highest bid to lowest bid) and take top N closest to mid
  const validBids = [...bids].filter((b) => b.price > 0 && b.amount > 0).sort((a, b) => b.price - a.price);
  const slicedBids = validBids.slice(0, depthCount);

  // Compute cumulative running totals for the visible slice
  let askRunning = 0;
  const processedAsksReversed: DOMProcessedLevel[] = [];
  for (const ask of slicedAsks) {
    askRunning += ask.amount;
    const matchingOrders = openOrders.filter(
      (o) => Math.abs(o.limitPrice - ask.price) < 0.0001
    );
    processedAsksReversed.push({
      price: ask.price,
      amount: ask.amount,
      total: askRunning,
      depthRatio: 0,
      side: "ask",
      userOrders: matchingOrders,
    });
  }

  let bidRunning = 0;
  const processedBids: DOMProcessedLevel[] = [];
  for (const bid of slicedBids) {
    bidRunning += bid.amount;
    const matchingOrders = openOrders.filter(
      (o) => Math.abs(o.limitPrice - bid.price) < 0.0001
    );
    processedBids.push({
      price: bid.price,
      amount: bid.amount,
      total: bidRunning,
      depthRatio: 0,
      side: "bid",
      userOrders: matchingOrders,
    });
  }

  const maxTotal = Math.max(askRunning, bidRunning, 1);

  // Asks are displayed top-to-bottom descending in price towards mid
  const processedAsks = [...processedAsksReversed].reverse().map((lvl) => ({
    ...lvl,
    depthRatio: Math.min((lvl.total / maxTotal) * 100, 100),
  }));

  const normalizedBids = processedBids.map((lvl) => ({
    ...lvl,
    depthRatio: Math.min((lvl.total / maxTotal) * 100, 100),
  }));

  const bestAsk = slicedAsks.length > 0 ? slicedAsks[0].price : currentPrice + 0.1;
  const bestBid = slicedBids.length > 0 ? slicedBids[0].price : currentPrice - 0.1;
  const spread = Math.max(0, bestAsk - bestBid);
  const spreadPct = bestAsk > 0 ? (spread / bestAsk) * 100 : 0;

  const bidDepthTotal = bidRunning;
  const askDepthTotal = askRunning;
  const totalBoth = bidDepthTotal + askDepthTotal;
  const bidDepthRatioPct = totalBoth > 0 ? (bidDepthTotal / totalBoth) * 100 : 50;

  return {
    processedAsks,
    processedBids: normalizedBids,
    bestAsk,
    bestBid,
    spread,
    spreadPct,
    bidDepthTotal,
    askDepthTotal,
    bidDepthRatioPct,
    maxTotal,
  };
}

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Web Audio Synthesizer for Institutional Trade Prints.
 * Distinct acoustic tone depending on trade size tier and side.
 */
export function playTradeSound(tier: TradeSizeTier, side: "buy" | "sell"): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const baseFreq = side === "buy" ? 660 : 440;

    if (tier === "megalodon") {
      // 3-note triumphant triad
      const freqs = side === "buy" ? [523.25, 659.25, 783.99] : [440.0, 349.23, 293.66];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, now + i * 0.05);

        gain.gain.setValueAtTime(0.001, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.05 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.26);
      });
    } else if (tier === "whale") {
      // 2-tone harmonic chime
      const f1 = side === "buy" ? 880 : 440;
      const f2 = side === "buy" ? 1174.66 : 329.63;

      [f1, f2].forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(f, now + i * 0.04);

        gain.gain.setValueAtTime(0.001, now + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.08, now + i * 0.04 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.04);
        osc.stop(now + i * 0.04 + 0.2);
      });
    } else if (tier === "large") {
      // Subtle pop
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(baseFreq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.04, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    }
  } catch {
    // Graceful fallback for strict browser autoplay policies
  }
}
