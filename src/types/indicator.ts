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

export interface IndicatorWorkerMessageOutput {
  scriptId: string;
  success: boolean;
  data?: Array<{ time: number; value: number | number[] }>;
  error?: string;
  durationMs: number;
}
