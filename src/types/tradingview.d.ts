/**
 * TradingView Charting Library JS API Type Definitions
 */

export interface DatafeedConfiguration {
  supported_resolutions?: string[];
  supports_marks?: boolean;
  supports_timescale_marks?: boolean;
  supports_time?: boolean;
  symbols_types?: Array<{ name: string; value: string }>;
}

export interface LibrarySymbolInfo {
  name: string;
  ticker?: string;
  description: string;
  type: string;
  session: string;
  exchange: string;
  listed_exchange: string;
  timezone: string;
  format: "price" | "volume";
  pricescale: number;
  minmov: number;
  has_intraday?: boolean;
  supported_resolutions: string[];
  intraday_multipliers?: string[];
  has_empty_bars?: boolean;
  volume_precision?: number;
  data_status?: "streaming" | "endofday" | "pulsed" | "delayed_streaming";
}

export interface PeriodParams {
  from: number; // Unix timestamp in seconds
  to: number;   // Unix timestamp in seconds
  countBack: number;
  firstDataRequest: boolean;
}

export interface Bar {
  time: number; // ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type OnReadyCallback = (configuration: DatafeedConfiguration) => void;
export type ResolveCallback = (symbolInfo: LibrarySymbolInfo) => void;
export type ErrorCallback = (reason: string) => void;
export type HistoryCallback = (bars: Bar[], meta: { noData?: boolean }) => void;
export type SubscribeBarsCallback = (bar: Bar) => void;

export interface IBasicDataFeed {
  onReady(callback: OnReadyCallback): void;
  searchSymbols?(userInput: string, exchange: string, symbolType: string, onResultReadyCallback: (result: any[]) => void): void;
  resolveSymbol(symbolName: string, onResolve: ResolveCallback, onError: ErrorCallback): void;
  getBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: string,
    periodParams: PeriodParams,
    onResult: HistoryCallback,
    onError: ErrorCallback
  ): void;
  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: string,
    onTick: SubscribeBarsCallback,
    listenerGuid: string,
    onResetCacheNeededCallback: () => void
  ): void;
  unsubscribeBars(listenerGuid: string): void;
}
