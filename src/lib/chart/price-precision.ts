export interface PricePrecisionInfo {
  precision: number;
  minMove: number;
  formatPrice: (price: number) => string;
}

/**
 * Calculates optimal price precision and minMove tick size for Lightweight Charts and drawings.
 * Dynamically scales from 2 decimal places for major assets (BTC, ETH >= $100)
 * down to 5-6 decimal places for cents tokens ($0.03 - $0.04)
 * and up to 8 decimal places for micro-cent meme tokens (< $0.0001).
 */
export function calculatePricePrecision(
  currentPrice: number,
  sampleBars?: Array<{ close: number; open?: number; high?: number; low?: number }>
): PricePrecisionInfo {
  const price = Math.abs(currentPrice || 0);

  // 1. Base precision tier based on price magnitude
  let precision = 2;
  if (price === 0) {
    precision = 4;
  } else if (price < 0.0001) {
    precision = 8;
  } else if (price < 0.01) {
    precision = 6;
  } else if (price < 1.0) {
    precision = 5; // Cents tokens (e.g. 0.03450)
  } else if (price < 100.0) {
    precision = 4;
  } else {
    precision = 2; // ETH ($2,000 - $3,000), BTC ($60,000+)
  }

  // 2. Expand precision if recent historical candles show higher decimal granularity
  if (sampleBars && sampleBars.length > 0) {
    const recent = sampleBars.slice(-30);
    let maxObservedDecimals = 0;

    for (const b of recent) {
      const pricesToCheck = [b.close, b.open, b.high, b.low].filter(
        (p): p is number => typeof p === "number" && !isNaN(p) && p > 0
      );
      for (const p of pricesToCheck) {
        const str = p.toString();
        if (str.includes(".") && !str.includes("e") && !str.includes("E")) {
          const decimals = str.split(".")[1].length;
          if (decimals > maxObservedDecimals) {
            maxObservedDecimals = decimals;
          }
        }
      }
    }

    if (maxObservedDecimals > precision) {
      precision = Math.min(8, maxObservedDecimals);
    }
  }

  // Calculate minimum tick increment
  const minMove = Number((1 / Math.pow(10, precision)).toFixed(precision));

  const formatPrice = (p: number): string => {
    if (typeof p !== "number" || isNaN(p)) return "0.00";
    return p.toLocaleString("en-US", {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
      useGrouping: p >= 1000,
    });
  };

  return {
    precision,
    minMove,
    formatPrice,
  };
}
