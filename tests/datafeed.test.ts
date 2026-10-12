import { describe, it, expect, vi } from "vitest";
import { MexcDatafeed } from "@/lib/mexc/datafeed";
import { MexcClient } from "@/lib/mexc/client";
import { MexcWebSocketManager } from "@/lib/mexc/websocket";

describe("MexcDatafeed TradingView JS API Compliance", () => {
  const mockClient = {
    getKlines: vi.fn().mockResolvedValue([
      { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 50 },
      { time: 2000, open: 105, high: 115, low: 95, close: 110, volume: 60 },
    ]),
    toMexcInterval: vi.fn().mockReturnValue("15m"),
  } as unknown as MexcClient;

  const mockWsManager = {
    connect: vi.fn(),
    subscribeKline: vi.fn().mockReturnValue("channel_kline"),
    unsubscribeKline: vi.fn(),
  } as unknown as MexcWebSocketManager;

  const datafeed = new MexcDatafeed({ client: mockClient, wsManager: mockWsManager });

  it("should respond to onReady with valid TradingView configuration", async () => {
    return new Promise<void>((resolve) => {
      datafeed.onReady((config) => {
        expect(config.supported_resolutions).toBeDefined();
        expect(config.supported_resolutions).toContain("15");
        expect(config.supported_resolutions).toContain("1D");
        expect(config.supports_time).toBe(true);
        resolve();
      });
    });
  });

  it("should resolve symbols with MEXC exchange specs and price scales", async () => {
    return new Promise<void>((resolve) => {
      datafeed.resolveSymbol(
        "BTCUSDT",
        (symbolInfo) => {
          expect(symbolInfo.name).toBe("BTCUSDT");
          expect(symbolInfo.exchange).toBe("MEXC");
          expect(symbolInfo.session).toBe("24x7");
          expect(symbolInfo.pricescale).toBe(100);
          expect(symbolInfo.has_intraday).toBe(true);
          resolve();
        },
        (error) => {
          throw new Error(error);
        }
      );
    });
  });

  it("should fetch historical bars through getBars and trigger history callback", async () => {
    return new Promise<void>((resolve) => {
      datafeed.getBars(
        {
          name: "BTCUSDT",
          description: "MEXC Spot BTCUSDT",
          type: "crypto",
          session: "24x7",
          exchange: "MEXC",
          listed_exchange: "MEXC",
          timezone: "Etc/UTC",
          format: "price",
          pricescale: 100,
          minmov: 1,
          supported_resolutions: ["15"],
        },
        "15",
        { from: 1, to: 2, countBack: 2, firstDataRequest: true },
        (bars, meta) => {
          expect(bars.length).toBe(2);
          expect(bars[0].close).toBe(105);
          expect(meta.noData).toBe(false);
          resolve();
        },
        (err) => {
          throw new Error(err);
        }
      );
    });
  });

  it("should manage subscribeBars and unsubscribeBars correctly", () => {
    const onTick = vi.fn();
    datafeed.subscribeBars(
      {
        name: "BTCUSDT",
        description: "MEXC Spot BTCUSDT",
        type: "crypto",
        session: "24x7",
        exchange: "MEXC",
        listed_exchange: "MEXC",
        timezone: "Etc/UTC",
        format: "price",
        pricescale: 100,
        minmov: 1,
        supported_resolutions: ["15"],
      },
      "15",
      onTick,
      "guid_1",
      () => {}
    );

    expect(mockWsManager.connect).toHaveBeenCalled();
    expect(mockWsManager.subscribeKline).toHaveBeenCalled();

    datafeed.unsubscribeBars("guid_1");
    expect(mockWsManager.unsubscribeKline).toHaveBeenCalled();
  });
});
