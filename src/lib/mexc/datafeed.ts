import { MexcClient, mexcClient } from "./client";
import { MexcWebSocketManager, mexcWsManager } from "./websocket";
import {
  Bar,
  DatafeedConfiguration,
  ErrorCallback,
  HistoryCallback,
  IBasicDataFeed,
  LibrarySymbolInfo,
  OnReadyCallback,
  PeriodParams,
  ResolveCallback,
  SubscribeBarsCallback,
} from "@/types/tradingview";
import { RESOLUTION_MAP } from "./types";

export interface DatafeedOptions {
  client?: MexcClient;
  wsManager?: MexcWebSocketManager;
}

export class MexcDatafeed implements IBasicDataFeed {
  private client: MexcClient;
  private wsManager: MexcWebSocketManager;
  private subscribers: Map<string, { channel: string; callback: SubscribeBarsCallback }> = new Map();
  private lastBars: Map<string, Bar> = new Map();
  private isReplayActive = false;
  private replayCallback: SubscribeBarsCallback | null = null;

  constructor(options: DatafeedOptions = {}) {
    this.client = options.client || mexcClient;
    this.wsManager = options.wsManager || mexcWsManager;
  }

  public onReady(callback: OnReadyCallback): void {
    setTimeout(() => {
      const config: DatafeedConfiguration = {
        supported_resolutions: ["1", "5", "15", "30", "60", "240", "1D", "1W", "1M"],
        supports_marks: false,
        supports_timescale_marks: false,
        supports_time: true,
        symbols_types: [{ name: "Crypto", value: "crypto" }],
      };
      callback(config);
    }, 0);
  }

  public resolveSymbol(symbolName: string, onResolve: ResolveCallback, _onError: ErrorCallback): void {
    const symbol = symbolName.toUpperCase();
    const pricescale = symbol.endsWith("USDT") && (symbol.startsWith("SHIB") || symbol.startsWith("PEPE") || symbol.startsWith("BONK"))
      ? 100000000
      : 100;

    const symbolInfo: LibrarySymbolInfo = {
      name: symbol,
      ticker: symbol,
      description: `MEXC Spot ${symbol}`,
      type: "crypto",
      session: "24x7",
      exchange: "MEXC",
      listed_exchange: "MEXC",
      timezone: "Etc/UTC",
      format: "price",
      pricescale,
      minmov: 1,
      has_intraday: true,
      supported_resolutions: ["1", "5", "15", "30", "60", "240", "1D", "1W", "1M"],
      intraday_multipliers: ["1", "5", "15", "30", "60", "240"],
      has_empty_bars: false,
      volume_precision: 4,
      data_status: "streaming",
    };

    setTimeout(() => onResolve(symbolInfo), 0);
  }

  public async getBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: string,
    periodParams: PeriodParams,
    onResult: HistoryCallback,
    onError: ErrorCallback
  ): Promise<void> {
    try {
      const startTime = periodParams.from * 1000;
      const endTime = periodParams.to * 1000;

      const bars = await this.client.getKlines({
        symbol: symbolInfo.name,
        resolution,
        startTime,
        endTime,
        limit: Math.min(periodParams.countBack || 500, 1000),
      });

      if (bars.length > 0) {
        const cacheKey = `${symbolInfo.name}_${resolution}`;
        this.lastBars.set(cacheKey, bars[bars.length - 1]);
        onResult(bars, { noData: false });
      } else {
        onResult([], { noData: true });
      }
    } catch (err: any) {
      onError(err?.message || "Failed to fetch historical bars");
    }
  }

  public subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: string,
    onTick: SubscribeBarsCallback,
    listenerGuid: string,
    _onResetCacheNeededCallback: () => void
  ): void {
    if (this.isReplayActive) {
      this.replayCallback = onTick;
      return;
    }

    const interval = RESOLUTION_MAP[resolution] || "15m";
    this.wsManager.connect();

    const channel = this.wsManager.subscribeKline(symbolInfo.name, interval, (bar) => {
      onTick(bar);
    });

    this.subscribers.set(listenerGuid, { channel, callback: onTick });
  }

  public unsubscribeBars(listenerGuid: string): void {
    if (this.isReplayActive) {
      this.replayCallback = null;
    }

    const sub = this.subscribers.get(listenerGuid);
    if (!sub) return;

    this.wsManager.unsubscribeKline(sub.channel, sub.callback);
    this.subscribers.delete(listenerGuid);
  }

  // Bar Replay coordination methods
  public setReplayMode(active: boolean): void {
    this.isReplayActive = active;
    if (active) {
      // Disconnect live listeners when in replay
      this.subscribers.forEach(({ channel, callback }) => {
        this.wsManager.unsubscribeKline(channel, callback);
      });
    }
  }

  public dispatchReplayTick(bar: Bar): void {
    if (this.replayCallback) {
      this.replayCallback(bar);
    }
  }
}
