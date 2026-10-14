"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Activity,
  Layers,
  Volume2,
  VolumeX,
  Trash2,
  Zap,
  X,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { mexcWsManager } from "@/lib/mexc/websocket";
import { DepthLevel, MexcDealItem, MexcDepthData } from "@/lib/mexc/types";
import { PaperLimitOrder, PaperOrderInput } from "@/lib/trading/paper-trading-engine";
import {
  classifyTradeSize,
  getSizeTierLabel,
  processDOMLevels,
  updateCumulativeDelta,
  playTradeSound,
  CumulativeVolumeDelta,
  TradeSizeTier,
} from "@/lib/dom/dom-tape-engine";

interface DepthOfMarketTapeProps {
  symbol: string;
  currentPrice?: number;
  openOrders?: PaperLimitOrder[];
  onExecutePaperOrder?: (order: PaperOrderInput) => void;
  onCancelPaperOrder?: (orderId: string) => void;
}

export function DepthOfMarketTape({
  symbol,
  currentPrice = 68420.5,
  openOrders = [],
  onExecutePaperOrder,
  onCancelPaperOrder,
}: DepthOfMarketTapeProps) {
  const [activeSubTab, setActiveSubTab] = useState<"ladder" | "tape">("ladder");
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [minFilterUsd, setMinFilterUsd] = useState<number>(0);
  const [autoScroll, setAutoScroll] = useState(true);

  // Depth state
  const [depth, setDepth] = useState<MexcDepthData>({
    symbol,
    asks: [],
    bids: [],
    timestamp: Date.now(),
  });

  // Aggressor Tape state
  const [tapeDeals, setTapeDeals] = useState<MexcDealItem[]>([]);
  const [cvd, setCvd] = useState<CumulativeVolumeDelta>({
    buyVolume: 0,
    sellVolume: 0,
    totalVolume: 0,
    netDelta: 0,
    buyRatioPct: 50,
    sellRatioPct: 50,
  });

  const tapeContainerRef = useRef<HTMLDivElement>(null);
  const isAudioEnabledRef = useRef(false);

  useEffect(() => {
    isAudioEnabledRef.current = isAudioEnabled;
  }, [isAudioEnabled]);

  // Initial synthetic baseline depth
  useEffect(() => {
    const base = currentPrice || 68420;
    const initialAsks: DepthLevel[] = [
      { price: base + 2.5, amount: 0.954, total: 0.954 },
      { price: base + 2.0, amount: 1.250, total: 2.204 },
      { price: base + 1.6, amount: 0.720, total: 2.924 },
      { price: base + 1.2, amount: 2.115, total: 5.039 },
      { price: base + 0.9, amount: 1.423, total: 6.462 },
      { price: base + 0.6, amount: 0.512, total: 6.974 },
      { price: base + 0.4, amount: 3.450, total: 10.424 },
      { price: base + 0.2, amount: 4.810, total: 15.234 },
    ];
    const initialBids: DepthLevel[] = [
      { price: base - 0.2, amount: 3.240, total: 3.240 },
      { price: base - 0.4, amount: 2.132, total: 5.372 },
      { price: base - 0.7, amount: 1.811, total: 7.183 },
      { price: base - 1.0, amount: 2.945, total: 10.128 },
      { price: base - 1.4, amount: 1.450, total: 11.578 },
      { price: base - 1.8, amount: 3.650, total: 15.228 },
      { price: base - 2.2, amount: 0.880, total: 16.108 },
      { price: base - 2.6, amount: 2.150, total: 18.258 },
    ];

    setDepth({
      symbol,
      asks: initialAsks,
      bids: initialBids,
      timestamp: Date.now(),
    });
    setTapeDeals([]);
    setCvd({
      buyVolume: 0,
      sellVolume: 0,
      totalVolume: 0,
      netDelta: 0,
      buyRatioPct: 50,
      sellRatioPct: 50,
    });

    mexcWsManager.connect();

    // Subscribe to Level 2 Order Book Depth
    const depthChannel = mexcWsManager.subscribeDepth(
      symbol,
      (newDepth) => {
        setDepth(newDepth);
      },
      20
    );

    // Subscribe to Real-Time Deals (Aggressor Tape)
    const dealsChannel = mexcWsManager.subscribeDeals(symbol, (incomingDeals) => {
      setTapeDeals((prev) => {
        const next = [...incomingDeals, ...prev].slice(0, 150);
        return next;
      });

      setCvd((prevCvd) => updateCumulativeDelta(prevCvd, incomingDeals));

      // Play audio blip if enabled
      if (isAudioEnabledRef.current && incomingDeals.length > 0) {
        const primary = incomingDeals[0];
        const tier = classifyTradeSize(primary.quoteAmount);
        if (tier === "whale" || tier === "megalodon" || tier === "large") {
          playTradeSound(tier, primary.side);
        }
      }
    });

    return () => {
      mexcWsManager.unsubscribeDepth(depthChannel);
      mexcWsManager.unsubscribeDeals(dealsChannel);
    };
  }, [symbol, currentPrice]);

  // Process DOM summary
  const domSummary = useMemo(() => {
    return processDOMLevels(depth.asks, depth.bids, currentPrice, openOrders, 10);
  }, [depth.asks, depth.bids, currentPrice, openOrders]);

  // Filtered Tape trades
  const filteredDeals = useMemo(() => {
    if (minFilterUsd <= 0) return tapeDeals;
    return tapeDeals.filter((d) => d.quoteAmount >= minFilterUsd);
  }, [tapeDeals, minFilterUsd]);

  // Handle 1-Click DOM Order Placement
  const handleLevelClick = (levelPrice: number, side: "buy" | "sell", isShift: boolean) => {
    const input: PaperOrderInput = {
      symbol,
      side: side === "buy" ? "long" : "short",
      orderType: isShift ? "market" : "limit",
      price: levelPrice,
      marginAmountUsdt: 50, // default quick test lot
      leverage: 10,
    };

    if (onExecutePaperOrder) {
      onExecutePaperOrder(input);
    } else {
      window.dispatchEvent(
        new CustomEvent("mochex:execute-paper-order", {
          detail: { order: input },
        })
      );
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-container-low font-mono select-none">
      {/* Sub-Header Tabs & Quick Controls */}
      <div className="px-2.5 py-1.5 bg-surface border-b border-border flex items-center justify-between shrink-0 text-xs">
        {/* Switcher: Ladder vs Tape */}
        <div className="flex items-center gap-1 bg-surface-container-low p-0.5 rounded border border-border">
          <button
            onClick={() => setActiveSubTab("ladder")}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer ${
              activeSubTab === "ladder"
                ? "bg-primary-container text-white shadow-xs"
                : "text-muted hover:text-on-surface"
            }`}
          >
            <Layers size={11} />
            <span>DOM Ladder</span>
          </button>
          <button
            onClick={() => setActiveSubTab("tape")}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer ${
              activeSubTab === "tape"
                ? "bg-primary-container text-white shadow-xs"
                : "text-muted hover:text-on-surface"
            }`}
          >
            <Activity size={11} />
            <span>Aggressor Tape</span>
            {tapeDeals.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            )}
          </button>
        </div>

        {/* Right Tools: Audio Chime & Filter / Clear */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsAudioEnabled((prev) => !prev)}
            title={isAudioEnabled ? "Whale Chime Sound On" : "Audio Chime Muted"}
            className={`p-1 rounded border text-[10px] flex items-center gap-1 cursor-pointer transition-colors ${
              isAudioEnabled
                ? "bg-gold/15 text-gold border-gold/30"
                : "bg-surface text-muted border-border hover:text-on-surface"
            }`}
          >
            {isAudioEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
          </button>

          {activeSubTab === "tape" && tapeDeals.length > 0 && (
            <button
              onClick={() => setTapeDeals([])}
              title="Clear Tape History"
              className="p-1 rounded bg-surface border border-border text-muted hover:text-tertiary cursor-pointer transition-colors"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Cumulative Volume Delta (CVD) Ribbon */}
      <div className="px-3 py-1.5 bg-surface-container-lowest border-b border-border shrink-0 flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-secondary font-bold">
            BUY ${(cvd.buyVolume / 1000).toFixed(1)}k ({cvd.buyRatioPct.toFixed(0)}%)
          </span>
          <span
            className={`font-black px-1.5 py-0.2 rounded text-[9px] ${
              cvd.netDelta >= 0
                ? "bg-secondary/15 text-secondary border border-secondary/30"
                : "bg-tertiary/15 text-tertiary border border-tertiary/30"
            }`}
          >
            CVD: {cvd.netDelta >= 0 ? "+" : ""}${(cvd.netDelta / 1000).toFixed(1)}k
          </span>
          <span className="text-tertiary font-bold">
            SELL ${(cvd.sellVolume / 1000).toFixed(1)}k ({cvd.sellRatioPct.toFixed(0)}%)
          </span>
        </div>
        {/* CVD Delta Progress Bar */}
        <div className="w-full h-1 bg-tertiary/30 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-secondary transition-all duration-300"
            style={{ width: `${cvd.buyRatioPct}%` }}
          />
        </div>
      </div>

      {/* SUB-TAB 1: INTERACTIVE DOM HEATMAP LADDER */}
      {activeSubTab === "ladder" ? (
        <div className="flex-1 flex flex-col overflow-hidden text-[11px]">
          {/* Column Header */}
          <div className="grid grid-cols-12 px-3 py-1 bg-surface-container-high/60 border-b border-border text-[10px] text-muted">
            <span className="col-span-3 text-left">Orders</span>
            <span className="col-span-3 text-right">Size</span>
            <span className="col-span-3 text-right">Price ($)</span>
            <span className="col-span-3 text-right">Total</span>
          </div>

          {/* Asks (Sell Orders - Top to Mid) */}
          <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col justify-end divide-y divide-border/20">
            {domSummary.processedAsks.map((ask) => {
              const hasOrders = ask.userOrders.length > 0;
              return (
                <div
                  key={`ask-${ask.price}`}
                  onClick={(e) => handleLevelClick(ask.price, "sell", e.shiftKey)}
                  title={`Click to place Limit SELL @ $${ask.price.toFixed(2)} (Shift+Click for Market)`}
                  className="relative grid grid-cols-12 px-3 py-0.5 hover:bg-tertiary/10 cursor-pointer transition-colors group"
                >
                  {/* Heatmap Bar */}
                  <div
                    className="absolute top-0 right-0 bottom-0 bg-tertiary/15 pointer-events-none transition-all duration-200"
                    style={{ width: `${ask.depthRatio}%` }}
                  />

                  {/* Orders pill */}
                  <div className="col-span-3 relative z-10 flex items-center gap-1">
                    {hasOrders && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onCancelPaperOrder && ask.userOrders[0]?.id) {
                            onCancelPaperOrder(ask.userOrders[0].id);
                          }
                        }}
                        className="px-1 py-0.2 rounded bg-tertiary/30 text-tertiary hover:bg-tertiary hover:text-white font-bold text-[9px] flex items-center gap-0.5 cursor-pointer"
                        title="Cancel Order"
                      >
                        <span>S {ask.userOrders.length}</span>
                        <X size={9} />
                      </span>
                    )}
                  </div>

                  <span className="col-span-3 relative z-10 text-right text-muted group-hover:text-on-surface">
                    {ask.amount.toFixed(3)}
                  </span>
                  <span className="col-span-3 relative z-10 text-right text-tertiary font-bold">
                    {ask.price.toFixed(2)}
                  </span>
                  <span className="col-span-3 relative z-10 text-right text-muted">
                    {ask.total.toFixed(3)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Mid-Market Spread Anchor */}
          <div className="px-3 py-1.5 bg-surface-container-lowest border-y-2 border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-on-surface">
                ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-muted">MEXC Mark</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted">
              <span>Spread: {domSummary.spread.toFixed(2)}</span>
              <span className="text-outline">({domSummary.spreadPct.toFixed(3)}%)</span>
            </div>
          </div>

          {/* Bids (Buy Orders - Mid to Bottom) */}
          <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col divide-y divide-border/20">
            {domSummary.processedBids.map((bid) => {
              const hasOrders = bid.userOrders.length > 0;
              return (
                <div
                  key={`bid-${bid.price}`}
                  onClick={(e) => handleLevelClick(bid.price, "buy", e.shiftKey)}
                  title={`Click to place Limit BUY @ $${bid.price.toFixed(2)} (Shift+Click for Market)`}
                  className="relative grid grid-cols-12 px-3 py-0.5 hover:bg-secondary/10 cursor-pointer transition-colors group"
                >
                  {/* Heatmap Bar */}
                  <div
                    className="absolute top-0 right-0 bottom-0 bg-secondary/15 pointer-events-none transition-all duration-200"
                    style={{ width: `${bid.depthRatio}%` }}
                  />

                  {/* Orders pill */}
                  <div className="col-span-3 relative z-10 flex items-center gap-1">
                    {hasOrders && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onCancelPaperOrder && bid.userOrders[0]?.id) {
                            onCancelPaperOrder(bid.userOrders[0].id);
                          }
                        }}
                        className="px-1 py-0.2 rounded bg-secondary/30 text-secondary hover:bg-secondary hover:text-surface font-bold text-[9px] flex items-center gap-0.5 cursor-pointer"
                        title="Cancel Order"
                      >
                        <span>B {bid.userOrders.length}</span>
                        <X size={9} />
                      </span>
                    )}
                  </div>

                  <span className="col-span-3 relative z-10 text-right text-muted group-hover:text-on-surface">
                    {bid.amount.toFixed(3)}
                  </span>
                  <span className="col-span-3 relative z-10 text-right text-secondary font-bold">
                    {bid.price.toFixed(2)}
                  </span>
                  <span className="col-span-3 relative z-10 text-right text-muted">
                    {bid.total.toFixed(3)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer: Bid/Ask Cumulative Balance */}
          <div className="p-2 bg-surface-container-lowest border-t border-border flex flex-col gap-1 shrink-0 text-[10px]">
            <div className="flex items-center justify-between text-muted">
              <span className="text-secondary font-bold">
                Bids: {domSummary.bidDepthTotal.toFixed(2)}
              </span>
              <span className="text-[9px] text-outline">Click row to place Limit order</span>
              <span className="text-tertiary font-bold">
                Asks: {domSummary.askDepthTotal.toFixed(2)}
              </span>
            </div>
            <div className="w-full h-1 bg-tertiary/40 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-secondary transition-all duration-300"
                style={{ width: `${domSummary.bidDepthRatioPct}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        /* SUB-TAB 2: REAL-TIME AGGRESSOR TAPE (TIME & SALES) */
        <div className="flex-1 flex flex-col overflow-hidden text-[11px]">
          {/* Filter Chips Bar */}
          <div className="px-2.5 py-1.5 bg-surface border-b border-border flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[10px] text-muted mr-1">Filter:</span>
            {[
              { label: "All", val: 0 },
              { label: "≥$1K", val: 1_000 },
              { label: "≥$5K", val: 5_000 },
              { label: "🐋 ≥$20K", val: 20_000 },
              { label: "👑 ≥$100K", val: 100_000 },
            ].map((f) => (
              <button
                key={f.label}
                onClick={() => setMinFilterUsd(f.val)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  minFilterUsd === f.val
                    ? "bg-primary-container text-white shadow-xs"
                    : "bg-surface-container-high text-muted hover:text-on-surface"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Table Headers */}
          <div className="grid grid-cols-12 px-3 py-1 bg-surface-container-high/60 border-b border-border text-[10px] text-muted shrink-0">
            <span className="col-span-3 text-left">Time</span>
            <span className="col-span-3 text-right">Price</span>
            <span className="col-span-3 text-right">Size</span>
            <span className="col-span-3 text-right">Notional</span>
          </div>

          {/* Tape Stream List */}
          <div
            ref={tapeContainerRef}
            className="flex-1 overflow-y-auto no-scrollbar divide-y divide-border/20"
          >
            {filteredDeals.length === 0 ? (
              <div className="p-6 text-center text-[11px] text-muted">
                Waiting for live trades on {symbol.replace("USDT", "/USDT")}...
              </div>
            ) : (
              filteredDeals.map((deal) => {
                const tier = classifyTradeSize(deal.quoteAmount);
                const isBuy = deal.side === "buy";

                return (
                  <div
                    key={deal.id}
                    onClick={() => handleLevelClick(deal.price, deal.side, false)}
                    title={`Click to match Limit ${deal.side.toUpperCase()} @ $${deal.price.toFixed(2)}`}
                    className={`grid grid-cols-12 px-3 py-1 items-center transition-colors hover:bg-surface-container cursor-pointer ${
                      tier === "megalodon"
                        ? "bg-primary/20 border-l-2 border-primary"
                        : tier === "whale"
                        ? "bg-gold/15 border-l-2 border-gold"
                        : tier === "large"
                        ? "bg-surface-container-high/40"
                        : ""
                    }`}
                  >
                    <span className="col-span-3 text-[10px] text-muted">
                      {new Date(deal.time).toLocaleTimeString(undefined, {
                        hour12: false,
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                    <span
                      className={`col-span-3 text-right font-bold ${
                        isBuy ? "text-secondary" : "text-tertiary"
                      }`}
                    >
                      ${deal.price >= 1 ? deal.price.toFixed(2) : deal.price.toFixed(4)}
                    </span>
                    <span className="col-span-3 text-right text-on-surface">
                      {deal.amount.toFixed(3)}
                    </span>
                    <div className="col-span-3 text-right flex items-center justify-end gap-1">
                      <span className="font-semibold text-muted">
                        ${(deal.quoteAmount / 1000).toFixed(1)}k
                      </span>
                      {tier !== "normal" && (
                        <span
                          className={`text-[8px] font-black px-1 rounded ${
                            tier === "megalodon"
                              ? "bg-primary text-white"
                              : tier === "whale"
                              ? "bg-gold text-surface"
                              : "bg-surface-container-highest text-on-surface"
                          }`}
                        >
                          {tier === "megalodon" ? "MEG" : tier === "whale" ? "WHL" : "LRG"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Tape Counter */}
          <div className="px-3 py-1 bg-surface-container-lowest border-t border-border flex items-center justify-between shrink-0 text-[10px] text-muted">
            <span>Prints: {filteredDeals.length}</span>
            <span className="text-secondary font-semibold">Taker Aggressor Stream</span>
          </div>
        </div>
      )}
    </div>
  );
}
