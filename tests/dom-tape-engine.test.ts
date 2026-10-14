import { describe, it, expect } from "vitest";
import {
  classifyTradeSize,
  getSizeTierLabel,
  calculateCumulativeDelta,
  updateCumulativeDelta,
  processDOMLevels,
} from "../src/lib/dom/dom-tape-engine";
import { MexcDealItem, DepthLevel } from "../src/lib/mexc/types";
import { PaperLimitOrder } from "../src/lib/trading/paper-trading-engine";

describe("Depth of Market (DOM) & Aggressor Tape Engine (DEC-080)", () => {
  describe("classifyTradeSize and labels", () => {
    it("correctly categorizes trade amounts into institutional tiers", () => {
      expect(classifyTradeSize(4999)).toBe("normal");
      expect(classifyTradeSize(5000)).toBe("large");
      expect(classifyTradeSize(19999)).toBe("large");
      expect(classifyTradeSize(20000)).toBe("whale");
      expect(classifyTradeSize(99999)).toBe("whale");
      expect(classifyTradeSize(100000)).toBe("megalodon");
      expect(classifyTradeSize(500000)).toBe("megalodon");
    });

    it("returns formatted tier badges", () => {
      expect(getSizeTierLabel("normal")).toBe("NORMAL");
      expect(getSizeTierLabel("large")).toBe("LARGE");
      expect(getSizeTierLabel("whale")).toContain("WHALE");
      expect(getSizeTierLabel("megalodon")).toContain("MEGALODON");
    });
  });

  describe("Cumulative Volume Delta (CVD)", () => {
    const deals: MexcDealItem[] = [
      { id: "1", price: 68000, amount: 0.1, quoteAmount: 6800, side: "buy", time: 1000 },
      { id: "2", price: 68000, amount: 0.2, quoteAmount: 13600, side: "buy", time: 1001 },
      { id: "3", price: 68000, amount: 0.15, quoteAmount: 10200, side: "sell", time: 1002 },
    ];

    it("calculates initial cumulative volume delta and ratios accurately", () => {
      const cvd = calculateCumulativeDelta(deals);

      expect(cvd.buyVolume).toBe(20400); // 6800 + 13600
      expect(cvd.sellVolume).toBe(10200);
      expect(cvd.totalVolume).toBe(30600);
      expect(cvd.netDelta).toBe(10200); // 20400 - 10200
      expect(cvd.buyRatioPct).toBeCloseTo((20400 / 30600) * 100, 2);
      expect(cvd.sellRatioPct).toBeCloseTo((10200 / 30600) * 100, 2);
    });

    it("incrementally accumulates incoming trades into prior CVD state", () => {
      const initial = calculateCumulativeDelta(deals);
      const incoming: MexcDealItem[] = [
        { id: "4", price: 68100, amount: 0.5, quoteAmount: 34050, side: "sell", time: 1003 },
      ];

      const updated = updateCumulativeDelta(initial, incoming);
      expect(updated.buyVolume).toBe(20400);
      expect(updated.sellVolume).toBe(10200 + 34050);
      expect(updated.totalVolume).toBe(64650);
      expect(updated.netDelta).toBe(20400 - 44250);
    });

    it("handles empty deal collections gracefully with 50/50 fallback", () => {
      const emptyCvd = calculateCumulativeDelta([]);
      expect(emptyCvd.totalVolume).toBe(0);
      expect(emptyCvd.netDelta).toBe(0);
      expect(emptyCvd.buyRatioPct).toBe(50);
      expect(emptyCvd.sellRatioPct).toBe(50);
    });
  });

  describe("processDOMLevels (Level 2 Orderbook Ladder)", () => {
    const rawAsks: DepthLevel[] = [
      { price: 68423, amount: 1.5 },
      { price: 68421, amount: 1.0 },
      { price: 68422, amount: 2.0 },
    ];

    const rawBids: DepthLevel[] = [
      { price: 68419, amount: 3.0 },
      { price: 68418, amount: 2.5 },
      { price: 68420, amount: 1.0 },
    ];

    const mockOrders: PaperLimitOrder[] = [
      {
        id: "ord-1",
        symbol: "BTCUSDT",
        side: "long",
        limitPrice: 68420,
        quantity: 0.1,
        marginReserved: 100,
        leverage: 10,
        createdAt: 1000,
      },
    ];

    it("sorts and structures Asks descending towards mid and Bids descending from mid", () => {
      const summary = processDOMLevels(rawAsks, rawBids, 68420.5, mockOrders, 5);

      // Best Ask = 68421, Best Bid = 68420
      expect(summary.bestAsk).toBe(68421);
      expect(summary.bestBid).toBe(68420);
      expect(summary.spread).toBe(1);
      expect(summary.spreadPct).toBeCloseTo((1 / 68421) * 100, 3);

      // Asks rendered top-to-bottom descending in price: 68423 -> 68422 -> 68421
      expect(summary.processedAsks[0].price).toBe(68423);
      expect(summary.processedAsks[1].price).toBe(68422);
      expect(summary.processedAsks[2].price).toBe(68421);

      // Bids rendered top-to-bottom descending in price: 68420 -> 68419 -> 68418
      expect(summary.processedBids[0].price).toBe(68420);
      expect(summary.processedBids[1].price).toBe(68419);
      expect(summary.processedBids[2].price).toBe(68418);

      // Matches open paper order on Bid 68420
      expect(summary.processedBids[0].userOrders).toHaveLength(1);
      expect(summary.processedBids[0].userOrders[0].id).toBe("ord-1");
      expect(summary.processedBids[1].userOrders).toHaveLength(0);

      // Depth totals and max total
      expect(summary.bidDepthTotal).toBe(6.5); // 1.0 + 3.0 + 2.5
      expect(summary.askDepthTotal).toBe(4.5); // 1.0 + 2.0 + 1.5
      expect(summary.maxTotal).toBe(6.5);
      expect(summary.bidDepthRatioPct).toBeCloseTo((6.5 / 11) * 100, 2);
    });
  });
});
