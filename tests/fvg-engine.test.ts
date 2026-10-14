import { describe, it, expect } from "vitest";
import { computeUnmitigatedFvgs, evaluateFvgMitigationOnTick, FvgZone } from "../src/lib/indicators/fvg-engine";
import { IndicatorSandbox } from "../src/lib/indicators/sandbox";
import { DEFAULT_FVG_SCRIPT } from "../src/lib/indicators/custom-scripts-store";
import { CandlestickBar } from "../src/lib/mexc/types";

describe("FVG Engine (Unmitigated 0% Wick Touch)", () => {
  it("returns empty array for fewer than 3 bars", () => {
    const bars: CandlestickBar[] = [
      { time: 1000, open: 100, high: 105, low: 95, close: 102, volume: 10 },
      { time: 2000, open: 102, high: 110, low: 101, close: 108, volume: 15 },
    ];
    expect(computeUnmitigatedFvgs(bars)).toEqual([]);
  });

  it("detects a Bullish Fair Value Gap (Candle 1 High < Candle 3 Low)", () => {
    const bars: CandlestickBar[] = [
      { time: 1000, open: 100, high: 105, low: 98, close: 104, volume: 10 },   // C1: high = 105
      { time: 2000, open: 104, high: 120, low: 104, close: 119, volume: 50 },  // C2: aggressive green expansion
      { time: 3000, open: 119, high: 125, low: 112, close: 122, volume: 20 },  // C3: low = 112 (> 105)
    ];

    const fvgs = computeUnmitigatedFvgs(bars, { minGapPct: 0 });
    expect(fvgs.length).toBe(1);
    expect(fvgs[0].type).toBe("BULLISH");
    expect(fvgs[0].bottom).toBe(105);
    expect(fvgs[0].top).toBe(112);
    expect(fvgs[0].mid).toBe((112 + 105) / 2); // 108.5
    expect(fvgs[0].endTime).toBe(3000);
  });

  it("detects a Bearish Fair Value Gap (Candle 1 Low > Candle 3 High)", () => {
    const bars: CandlestickBar[] = [
      { time: 1000, open: 120, high: 122, low: 115, close: 116, volume: 10 },  // C1: low = 115
      { time: 2000, open: 116, high: 116, low: 95, close: 96, volume: 60 },    // C2: aggressive red selloff
      { time: 3000, open: 96, high: 108, low: 92, close: 104, volume: 25 },    // C3: high = 108 (< 115)
    ];

    const fvgs = computeUnmitigatedFvgs(bars, { minGapPct: 0 });
    expect(fvgs.length).toBe(1);
    expect(fvgs[0].type).toBe("BEARISH");
    expect(fvgs[0].top).toBe(115);
    expect(fvgs[0].bottom).toBe(108);
    expect(fvgs[0].mid).toBe((115 + 108) / 2); // 111.5
    expect(fvgs[0].endTime).toBe(3000);
  });

  it("strictly mitigates and removes a Bullish FVG on 0% wick touch (Low <= FVG Top)", () => {
    const bars: CandlestickBar[] = [
      { time: 1000, open: 100, high: 105, low: 98, close: 104, volume: 10 },   // C1: high = 105
      { time: 2000, open: 104, high: 120, low: 104, close: 119, volume: 50 },  // C2: expansion
      { time: 3000, open: 119, high: 125, low: 112, close: 122, volume: 20 },  // C3: low = 112 -> FVG (105 - 112)
      // C4: touches 112 (wick enters the gap)
      { time: 4000, open: 122, high: 124, low: 112, close: 120, volume: 15 },
    ];

    const fvgs = computeUnmitigatedFvgs(bars, { minGapPct: 0 });
    // C4 touched 112 which is <= zone.top (112), so it is strictly mitigated
    expect(fvgs.length).toBe(0);
  });

  it("keeps Bullish FVG active if subsequent bar never wicks into the gap (Low > FVG Top)", () => {
    const bars: CandlestickBar[] = [
      { time: 1000, open: 100, high: 105, low: 98, close: 104, volume: 10 },
      { time: 2000, open: 104, high: 120, low: 104, close: 119, volume: 50 },
      { time: 3000, open: 119, high: 125, low: 112, close: 122, volume: 20 },
      // C4: low is 114, completely above 112
      { time: 4000, open: 122, high: 130, low: 114, close: 128, volume: 15 },
    ];

    const fvgs = computeUnmitigatedFvgs(bars, { minGapPct: 0 });
    expect(fvgs.length).toBe(1);
    expect(fvgs[0].endTime).toBe(4000); // Extended to current bar
  });

  it("strictly mitigates and removes a Bearish FVG on 0% wick touch (High >= FVG Bottom)", () => {
    const bars: CandlestickBar[] = [
      { time: 1000, open: 120, high: 122, low: 115, close: 116, volume: 10 },  // C1: low = 115
      { time: 2000, open: 116, high: 116, low: 95, close: 96, volume: 60 },    // C2
      { time: 3000, open: 96, high: 108, low: 92, close: 104, volume: 25 },    // C3: high = 108 -> FVG (108 - 115)
      // C4: touches 108.5 (wick touches above 108)
      { time: 4000, open: 104, high: 109, low: 98, close: 100, volume: 15 },
    ];

    const fvgs = computeUnmitigatedFvgs(bars, { minGapPct: 0 });
    expect(fvgs.length).toBe(0);
  });

  it("evaluates live tick mitigation dynamically via evaluateFvgMitigationOnTick", () => {
    const activeZones: FvgZone[] = [
      {
        id: "bull-1",
        type: "BULLISH",
        createdIndex: 2,
        startTime: 1000,
        endTime: 3000,
        top: 100,
        bottom: 90,
        mid: 95,
        gapPct: 10,
        color: "#00c087",
        fillColor: "rgba(0, 192, 135, 0.16)",
      },
      {
        id: "bear-1",
        type: "BEARISH",
        createdIndex: 2,
        startTime: 1000,
        endTime: 3000,
        top: 150,
        bottom: 140,
        mid: 145,
        gapPct: 7,
        color: "#ff3b30",
        fillColor: "rgba(255, 59, 48, 0.16)",
      },
    ];

    // Price is 110: Bullish top is 100 (110 > 100, safe), Bearish bottom is 140 (110 < 140, safe)
    let remaining = evaluateFvgMitigationOnTick(activeZones, 110);
    expect(remaining.length).toBe(2);

    // Price dips to 99.5: touches bullish zone top 100 -> bull zone mitigated
    remaining = evaluateFvgMitigationOnTick(activeZones, 99.5);
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe("bear-1");

    // Price spikes to 142: touches bearish zone bottom 140 -> bear zone mitigated
    remaining = evaluateFvgMitigationOnTick(activeZones, 142);
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe("bull-1");
  });

  it("executes DEFAULT_FVG_SCRIPT in IndicatorSandbox and returns boxes with midline", async () => {
    const bars: CandlestickBar[] = [
      { time: 1000, open: 100, high: 105, low: 98, close: 104, volume: 10 },
      { time: 2000, open: 104, high: 120, low: 104, close: 119, volume: 50 },
      { time: 3000, open: 119, high: 125, low: 112, close: 122, volume: 20 },
      { time: 4000, open: 122, high: 130, low: 115, close: 128, volume: 15 },
    ];

    const sandbox = new IndicatorSandbox();
    const result = await sandbox.execute({
      scriptId: "fvg-test",
      code: DEFAULT_FVG_SCRIPT,
      bars,
      inputs: {},
    });
    expect(result.success).toBe(true);
    expect(result.boxes).toBeDefined();
    expect(result.boxes!.length).toBeGreaterThan(0);

    const box = result.boxes![0];
    expect(box.type).toBe("BULLISH");
    expect(box.top).toBe(112);
    expect(box.bottom).toBe(105);
    expect(box.mid).toBe((112 + 105) / 2);
  });
});
