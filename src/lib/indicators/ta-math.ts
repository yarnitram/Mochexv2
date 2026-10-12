import * as TI from "technicalindicators";

export interface TaLibrary {
  sma(values: number[], period: number): number[];
  ema(values: number[], period: number): number[];
  rsi(values: number[], period?: number): number[];
  macd(values: number[], fastPeriod?: number, slowPeriod?: number, signalPeriod?: number): Array<{ macd?: number; signal?: number; histogram?: number }>;
  bollingerbands(values: number[], period?: number, stdDev?: number): Array<{ upper?: number; middle?: number; lower?: number }>;
  atr(high: number[], low: number[], close: number[], period?: number): number[];
}

export const ta: TaLibrary = {
  sma: (values: number[], period: number): number[] => {
    return TI.SMA.calculate({ period, values });
  },

  ema: (values: number[], period: number): number[] => {
    return TI.EMA.calculate({ period, values });
  },

  rsi: (values: number[], period = 14): number[] => {
    return TI.RSI.calculate({ period, values });
  },

  macd: (values: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
    return TI.MACD.calculate({
      values,
      fastPeriod,
      slowPeriod,
      signalPeriod,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    }).map((res) => ({
      macd: res.MACD,
      signal: res.signal,
      histogram: res.histogram,
    }));
  },

  bollingerbands: (values: number[], period = 20, stdDev = 2) => {
    return TI.BollingerBands.calculate({
      period,
      stdDev,
      values,
    }).map((b) => ({
      upper: b.upper,
      middle: b.middle,
      lower: b.lower,
    }));
  },

  atr: (high: number[], low: number[], close: number[], period = 14): number[] => {
    return TI.ATR.calculate({
      high,
      low,
      close,
      period,
    });
  },
};
