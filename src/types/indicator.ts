import { BacktestPerformance, StrategyOrderIntent } from "@/lib/strategy/types";

export interface IndicatorWorkerMessageInput {
  scriptId: string;
  code: string;
  bars: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  inputs: Record<string, any>;
}

export interface CustomScriptBox {
  id?: string;
  type?: "BULLISH" | "BEARISH" | string;
  startTime: number;
  endTime?: number;
  top: number;
  bottom: number;
  mid?: number;
  color?: string;
  fillColor?: string;
  label?: string;
  showMidLine?: boolean;
}

export interface IndicatorWorkerMessageOutput {
  scriptId: string;
  success: boolean;
  data?: Array<{ time: number; value: number | number[] }>;
  boxes?: CustomScriptBox[];
  strategyResult?: BacktestPerformance;
  orderIntents?: StrategyOrderIntent[];
  alertConditions?: Array<{ title: string; message: string; triggered: boolean; barIndex: number }>;
  error?: string;
  durationMs: number;
}

