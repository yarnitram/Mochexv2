import {
  CandlestickBar,
  MexcKlineWsPayload,
  MexcMiniTickerItem,
  MexcMiniTickerWsPayload,
  parseWsKline,
  WS_INTERVAL_MAP,
} from "./types";

export type KlineCallback = (bar: CandlestickBar) => void;
export type MiniTickerCallback = (tickers: MexcMiniTickerItem[]) => void;

export class MexcWebSocketManager {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private klineSubscriptions: Map<string, Set<KlineCallback>> = new Map();
  private miniTickerSubscriptions: Set<MiniTickerCallback> = new Set();
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isExplicitlyClosed = false;

  constructor(wsUrl = process.env.NEXT_PUBLIC_MEXC_WS_BASE || "wss://wbs.mexc.co/ws") {
    this.wsUrl = wsUrl;
  }

  public connect(): void {
    if (typeof window === "undefined") return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      this.startHeartbeat();
      this.resubscribeAll();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data);
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      if (!this.isExplicitlyClosed) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (_err) => {
      this.ws?.close();
    };
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public subscribeKline(symbol: string, interval: string, callback: KlineCallback): string {
    const formattedInterval = WS_INTERVAL_MAP[interval] || "Min15";
    const channel = `spot@public.kline.v3.api@${symbol.toUpperCase()}@${formattedInterval}`;

    if (!this.klineSubscriptions.has(channel)) {
      this.klineSubscriptions.set(channel, new Set());
      this.sendSubscription(channel);
    }
    this.klineSubscriptions.get(channel)!.add(callback);
    return channel;
  }

  public unsubscribeKline(channel: string, callback?: KlineCallback): void {
    const listeners = this.klineSubscriptions.get(channel);
    if (!listeners) return;

    if (callback) {
      listeners.delete(callback);
    } else {
      listeners.clear();
    }

    if (listeners.size === 0) {
      this.klineSubscriptions.delete(channel);
      this.sendUnsubscription(channel);
    }
  }

  public subscribeMiniTickers(callback: MiniTickerCallback): void {
    const channel = "spot@public.miniTickers.v3.api@UTC+8";
    if (this.miniTickerSubscriptions.size === 0) {
      this.sendSubscription(channel);
    }
    this.miniTickerSubscriptions.add(callback);
  }

  public unsubscribeMiniTickers(callback: MiniTickerCallback): void {
    this.miniTickerSubscriptions.delete(callback);
    if (this.miniTickerSubscriptions.size === 0) {
      const channel = "spot@public.miniTickers.v3.api@UTC+8";
      this.sendUnsubscription(channel);
    }
  }

  private handleMessage(raw: string): void {
    if (raw === "pong" || raw === "PONG") return;

    try {
      const data = JSON.parse(raw);

      // Handle Kline Stream
      if (data?.c && data.c.includes("public.kline.v3.api") && data?.d?.k) {
        const payload = data as MexcKlineWsPayload;
        const channel = payload.c;
        const listeners = this.klineSubscriptions.get(channel);
        if (listeners && listeners.size > 0) {
          const bar = parseWsKline(payload.d.k);
          listeners.forEach((fn) => fn(bar));
        }
      }

      // Handle MiniTickers Stream
      if (data?.c && data.c.includes("public.miniTickers.v3.api") && Array.isArray(data?.d)) {
        const payload = data as MexcMiniTickerWsPayload;
        this.miniTickerSubscriptions.forEach((fn) => fn(payload.d));
      }
    } catch (_err) {
      // Ignore unparseable frames
    }
  }

  private sendSubscription(param: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          method: "SUBSCRIPTION",
          params: [param],
        })
      );
    }
  }

  private sendUnsubscription(param: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          method: "UNSUBSCRIPTION",
          params: [param],
        })
      );
    }
  }

  private resubscribeAll(): void {
    for (const channel of this.klineSubscriptions.keys()) {
      this.sendSubscription(channel);
    }
    if (this.miniTickerSubscriptions.size > 0) {
      this.sendSubscription("spot@public.miniTickers.v3.api@UTC+8");
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ method: "PING" }));
      }
    }, 20000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 3000);
  }
}

export const mexcWsManager = new MexcWebSocketManager();
