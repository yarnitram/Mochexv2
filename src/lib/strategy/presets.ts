/**
 * Core Quant Strategy Suite: Built-in Strategy Templates
 */

export interface StrategyPreset {
  id: string;
  name: string;
  description: string;
  category: "Trend" | "Mean Reversion" | "Volatility";
  code: string;
}

export const STRATEGY_PRESETS: StrategyPreset[] = [
  {
    id: "ema-trend-ribbon",
    name: "EMA Momentum Trend Crossover",
    description: "Dual EMA crossover strategy with dynamic ATR risk management. Enters Long when Fast EMA crosses above Slow EMA.",
    category: "Trend",
    code: `// Mochex Strategy: EMA Momentum Trend Crossover
function calculate(bars, inputs, ta, strategy) {
  const fastPeriod = inputs.fastPeriod || 9;
  const slowPeriod = inputs.slowPeriod || 21;
  const atrPeriod = inputs.atrPeriod || 14;

  const closes = bars.map(b => b.close);
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);

  const fastEma = ta.ema(closes, fastPeriod);
  const slowEma = ta.ema(closes, slowPeriod);
  const atr = ta.atr(highs, lows, closes, atrPeriod);

  for (let i = 1; i < bars.length; i++) {
    const fPrev = fastEma[i - 1];
    const fCurr = fastEma[i];
    const sPrev = slowEma[i - 1];
    const sCurr = slowEma[i];
    const currentAtr = atr[i] || (bars[i].close * 0.02);

    if (fPrev === undefined || sPrev === undefined) continue;

    // Golden Cross: Fast EMA crosses above Slow EMA
    if (fPrev <= sPrev && fCurr > sCurr) {
      const stopLoss = bars[i].close - currentAtr * 2.0;
      const takeProfit = bars[i].close + currentAtr * 3.5;

      strategy.at(i).entry("EMALong", "long", { qtyPercent: 100 });
      strategy.at(i).exit("EMALong", { stopLoss, takeProfit });
    }

    // Death Cross: Fast EMA crosses below Slow EMA
    if (fPrev >= sPrev && fCurr < sCurr) {
      strategy.at(i).close("EMALong");
    }
  }

  return bars.map((bar, i) => ({
    time: bar.time,
    value: fastEma[i] || bar.close
  }));
}`,
  },
  {
    id: "rsi-mean-reversion",
    name: "RSI Mean Reversion & Divergence",
    description: "Counter-trend strategy entering when RSI is oversold (< 30) and turning upward, exiting on overbought (> 70) or target PnL.",
    category: "Mean Reversion",
    code: `// Mochex Strategy: RSI Mean Reversion
function calculate(bars, inputs, ta, strategy) {
  const rsiPeriod = inputs.rsiPeriod || 14;
  const oversold = inputs.oversold || 30;
  const overbought = inputs.overbought || 70;

  const closes = bars.map(b => b.close);
  const rsi = ta.rsi(closes, rsiPeriod);

  for (let i = 2; i < bars.length; i++) {
    const rsiPrev = rsi[i - 1];
    const rsiCurr = rsi[i];

    if (rsiPrev === undefined || rsiCurr === undefined) continue;

    // Enters when RSI crosses back above oversold threshold
    if (rsiPrev < oversold && rsiCurr >= oversold) {
      const entryPrice = bars[i].close;
      const stopLoss = entryPrice * 0.975;  // 2.5% stop loss
      const takeProfit = entryPrice * 1.045; // 4.5% take profit

      strategy.at(i).entry("RSILong", "long", { qtyPercent: 100 });
      strategy.at(i).exit("RSILong", { stopLoss, takeProfit });
    }

    // Exits when RSI reaches overbought
    if (rsiCurr >= overbought) {
      strategy.at(i).close("RSILong");
    }
  }

  return bars.map((bar, i) => ({
    time: bar.time,
    value: rsi[i] !== undefined ? rsi[i] : 50
  }));
}`,
  },
  {
    id: "bollinger-squeeze",
    name: "Bollinger Squeeze Volatility Breakout",
    description: "Breakout strategy detecting volatility contraction squeeze followed by strong candle penetration above the upper band.",
    category: "Volatility",
    code: `// Mochex Strategy: Bollinger Bands Squeeze Breakout
function calculate(bars, inputs, ta, strategy) {
  const period = inputs.period || 20;
  const stdDev = inputs.stdDev || 2;

  const closes = bars.map(b => b.close);
  const bb = ta.bollingerbands(closes, period, stdDev);

  for (let i = 1; i < bars.length; i++) {
    const bPrev = bb[i - 1];
    const bCurr = bb[i];
    if (!bPrev || !bCurr || !bCurr.upper || !bCurr.middle) continue;

    const prevClose = bars[i - 1].close;
    const currClose = bars[i].close;

    // Breakout above Upper Band
    if (prevClose <= bPrev.upper && currClose > bCurr.upper) {
      const stopLoss = bCurr.middle; // Stop loss at middle band (SMA 20)
      const takeProfit = currClose * 1.05; // 5% take profit target

      strategy.at(i).entry("BBLong", "long", { qtyPercent: 100 });
      strategy.at(i).exit("BBLong", { stopLoss, takeProfit });
    }

    // Close if price drops back below middle SMA band
    if (currClose < bCurr.middle) {
      strategy.at(i).close("BBLong");
    }
  }

  return bars.map((bar, i) => ({
    time: bar.time,
    value: bb[i]?.middle || bar.close
  }));
}`,
  },
];
