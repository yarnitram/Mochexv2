"use client";

import React, { useState } from "react";
import { indicatorSandbox } from "@/lib/indicators/sandbox";
import { CandlestickBar } from "@/lib/mexc/types";
import { Code2, Play, Save, X, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

interface IndicatorEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sampleBars: CandlestickBar[];
  onApplyIndicator?: (name: string, code: string) => void;
}

const DEFAULT_SCRIPT = `/**
 * Custom Technical Analysis Indicator
 * @param {Array} bars - Candlestick dataset [{ time, open, high, low, close, volume }]
 * @param {Object} inputs - User configurable parameters
 * @param {Object} ta - Technical analysis library (ta.rsi, ta.sma, ta.ema, ta.macd, ta.bollingerbands, ta.atr)
 */
function calculate(bars, inputs, ta) {
  const period = inputs.period || 14;
  const closes = bars.map(b => b.close);
  const rsiValues = ta.rsi(closes, period);

  // Align calculated values with original bar timestamps
  const offset = bars.length - rsiValues.length;
  return rsiValues.map((val, i) => ({
    time: bars[i + offset].time,
    value: val
  }));
}`;

export function IndicatorEditorModal({
  isOpen,
  onClose,
  sampleBars,
  onApplyIndicator,
}: IndicatorEditorModalProps) {
  const [name, setName] = useState("Custom RSI Indicator");
  const [scriptCode, setScriptCode] = useState(DEFAULT_SCRIPT);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    durationMs: number;
    pointsCount?: number;
    error?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleTestInSandbox = async () => {
    setIsTesting(true);
    setTestResult(null);

    const result = await indicatorSandbox.execute({
      scriptId: "sandbox-test",
      code: scriptCode,
      bars: sampleBars.length > 0 ? sampleBars : [
        { time: 1000, open: 100, high: 105, low: 95, close: 102, volume: 10 },
        { time: 2000, open: 102, high: 106, low: 101, close: 104, volume: 12 },
        { time: 3000, open: 104, high: 108, low: 103, close: 107, volume: 15 },
      ],
      inputs: { period: 14 },
    });

    setIsTesting(false);
    setTestResult({
      success: result.success,
      durationMs: result.durationMs,
      pointsCount: result.data?.length,
      error: result.error,
    });
  };

  const handleApply = () => {
    onApplyIndicator?.(name, scriptCode);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-3xl flex flex-col max-h-[85vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-accent/10 rounded-lg text-accent">
              <Code2 size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Indicator Script Lab</h2>
              <p className="text-[11px] text-muted">Sandboxed Web Worker runtime (1000ms guard)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded text-muted hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Form & Code Editor */}
        <div className="p-5 flex-1 flex flex-col gap-3 overflow-hidden">
          <div>
            <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
              Indicator Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface-card border border-border rounded-lg px-3 py-1.5 text-xs text-foreground font-medium outline-none focus:border-accent"
            />
          </div>

          <div className="flex-1 flex flex-col">
            <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
              Script Code (JavaScript)
            </label>
            <textarea
              value={scriptCode}
              onChange={(e) => setScriptCode(e.target.value)}
              className="flex-1 min-h-[260px] bg-surface-card border border-border rounded-lg p-3 text-xs font-mono text-emerald-400 outline-none focus:border-accent resize-none leading-relaxed"
              spellCheck={false}
            />
          </div>

          {/* Test Status Banner */}
          {testResult && (
            <div
              className={`p-3 rounded-lg text-xs font-mono flex items-center justify-between border ${
                testResult.success
                  ? "bg-bull/10 border-bull/30 text-bull"
                  : "bg-bear/10 border-bear/30 text-bear"
              }`}
            >
              <div className="flex items-center gap-2">
                {testResult.success ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                <span>
                  {testResult.success
                    ? `Executed successfully! Generated ${testResult.pointsCount} points.`
                    : `Sandbox Error: ${testResult.error}`}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] opacity-80">
                <Clock size={12} />
                <span>{testResult.durationMs.toFixed(2)}ms</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-between bg-surface-card/40">
          <button
            onClick={handleTestInSandbox}
            disabled={isTesting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-hover hover:bg-surface border border-border rounded-lg text-xs font-semibold text-foreground transition-colors disabled:opacity-50"
          >
            <Play size={13} className="text-accent" />
            <span>{isTesting ? "Executing..." : "Test in Sandbox"}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 hover:bg-surface-hover rounded-lg text-xs text-muted hover:text-foreground font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold shadow-lg shadow-accent/20 transition-all"
            >
              <Save size={13} />
              <span>Apply to Chart</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
