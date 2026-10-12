"use client";

import React, { useEffect, useState } from "react";
import { mexcWsManager } from "@/lib/mexc/websocket";
import { DepthLevel, MexcDepthData } from "@/lib/mexc/types";

interface OrderDepthLadderProps {
  symbol: string;
  currentPrice?: number;
}

export function OrderDepthLadder({ symbol, currentPrice = 68420.5 }: OrderDepthLadderProps) {
  const [depth, setDepth] = useState<MexcDepthData>({
    symbol,
    asks: [],
    bids: [],
    timestamp: Date.now(),
  });

  useEffect(() => {
    // Generate initial baseline depth while waiting for WS
    const basePrice = currentPrice || 68420;
    const initialAsks: DepthLevel[] = [
      { price: basePrice + 1.2, amount: 0.854, total: 0.854 },
      { price: basePrice + 0.9, amount: 1.423, total: 2.277 },
      { price: basePrice + 0.6, amount: 0.512, total: 2.789 },
      { price: basePrice + 0.4, amount: 2.115, total: 4.904 },
      { price: basePrice + 0.1, amount: 3.450, total: 8.354 },
    ];
    const initialBids: DepthLevel[] = [
      { price: basePrice - 0.1, amount: 2.840, total: 2.840 },
      { price: basePrice - 0.3, amount: 1.632, total: 4.472 },
      { price: basePrice - 0.5, amount: 3.011, total: 7.483 },
      { price: basePrice - 0.8, amount: 0.945, total: 8.428 },
      { price: basePrice - 1.1, amount: 2.450, total: 10.878 },
    ];

    setDepth({
      symbol,
      asks: initialAsks,
      bids: initialBids,
      timestamp: Date.now(),
    });

    mexcWsManager.connect();
    const channel = mexcWsManager.subscribeDepth(symbol, (newDepth) => {
      setDepth(newDepth);
    });

    return () => {
      mexcWsManager.unsubscribeDepth(channel);
    };
  }, [symbol, currentPrice]);

  const topAsks = depth.asks.slice(0, 5);
  const topBids = depth.bids.slice(0, 5);

  const maxTotal = Math.max(
    ...topAsks.map((a) => a.total || a.amount),
    ...topBids.map((b) => b.total || b.amount),
    1
  );

  const bestAsk = topAsks.length > 0 ? topAsks[topAsks.length - 1].price : currentPrice + 0.1;
  const bestBid = topBids.length > 0 ? topBids[0].price : currentPrice - 0.1;
  const spread = Math.abs(bestAsk - bestBid);
  const spreadPct = bestAsk > 0 ? (spread / bestAsk) * 100 : 0;

  return (
    <div className="flex flex-col bg-surface-container-low border-t border-border select-none text-[11px] font-mono">
      {/* Header bar */}
      <div className="px-3 py-1.5 bg-surface-container-lowest flex items-center justify-between border-b border-border text-muted text-[10px]">
        <span className="font-semibold uppercase tracking-wider text-outline">Order Depth (Top 5)</span>
        <div className="flex items-center gap-2">
          <span>Spread: {spread.toFixed(2)}</span>
          <span className="text-outline">({spreadPct.toFixed(3)}%)</span>
        </div>
      </div>

      {/* Columns Header */}
      <div className="grid grid-cols-3 px-3 py-1 text-[10px] text-muted border-b border-border/50">
        <span className="text-left">Price (USDT)</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks (Sell Orders - Red, Displayed descending) */}
      <div className="flex flex-col">
        {topAsks.map((ask, idx) => {
          const depthRatio = Math.min(((ask.total || ask.amount) / maxTotal) * 100, 100);
          return (
            <div
              key={`ask-${idx}`}
              className="relative grid grid-cols-3 px-3 py-0.5 hover:bg-surface-container transition-colors"
            >
              <div
                className="absolute top-0 right-0 bottom-0 bg-tertiary/15 pointer-events-none"
                style={{ width: `${depthRatio}%` }}
              />
              <span className="relative z-10 text-left text-tertiary font-semibold">
                {ask.price.toFixed(2)}
              </span>
              <span className="relative z-10 text-right text-on-surface">
                {ask.amount.toFixed(3)}
              </span>
              <span className="relative z-10 text-right text-muted">
                {(ask.total || ask.amount).toFixed(3)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mid Market Price Reference */}
      <div className="px-3 py-1.5 bg-surface-container-lowest/80 border-y border-border flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-on-surface">
            ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-muted">MEXC Spot</span>
        </div>
        <div className="text-[10px] text-muted">
          <span>Index: ${(currentPrice - 0.25).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Bids (Buy Orders - Green, Displayed descending) */}
      <div className="flex flex-col">
        {topBids.map((bid, idx) => {
          const depthRatio = Math.min(((bid.total || bid.amount) / maxTotal) * 100, 100);
          return (
            <div
              key={`bid-${idx}`}
              className="relative grid grid-cols-3 px-3 py-0.5 hover:bg-surface-container transition-colors"
            >
              <div
                className="absolute top-0 right-0 bottom-0 bg-secondary/15 pointer-events-none"
                style={{ width: `${depthRatio}%` }}
              />
              <span className="relative z-10 text-left text-secondary font-semibold">
                {bid.price.toFixed(2)}
              </span>
              <span className="relative z-10 text-right text-on-surface">
                {bid.amount.toFixed(3)}
              </span>
              <span className="relative z-10 text-right text-muted">
                {(bid.total || bid.amount).toFixed(3)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
