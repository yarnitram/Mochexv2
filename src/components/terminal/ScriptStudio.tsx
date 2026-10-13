"use client";

import React, { useState, useEffect } from "react";
import {
  Code2,
  Terminal,
  Activity,
  Play,
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  Globe,
  Cpu,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { indicatorSandbox } from "@/lib/indicators/sandbox";
import { CandlestickBar } from "@/lib/mexc/types";
import { BacktestPerformance, BacktestTrade } from "@/lib/strategy/types";
import { STRATEGY_PRESETS } from "@/lib/strategy/presets";
import { StrategyTesterPanel } from "./StrategyTesterPanel";

interface ScriptStudioProps {
  isOpen: boolean;
  onClose: () => void;
  sampleBars: CandlestickBar[];
  onApplyIndicator?: (name: string, code: string) => void;
  onStrategyResult?: (result: BacktestPerformance, name?: string) => void;
  onSelectTrade?: (trade: BacktestTrade) => void;
}

const DEFAULT_SCRIPT = STRATEGY_PRESETS[0].code;

export function ScriptStudio({
  isOpen,
  onClose,
  sampleBars,
  onApplyIndicator,
  onStrategyResult,
  onSelectTrade,
}: ScriptStudioProps) {
  const [activeTab, setActiveTab] = useState<"editor" | "strategy" | "logs">("editor");
  const [code, setCode] = useState(DEFAULT_SCRIPT);
  const [scriptName, setScriptName] = useState("EMA Momentum Trend Crossover");
  const [autoRecompile, setAutoRecompile] = useState(true);
  const [isPublishedGlobally, setIsPublishedGlobally] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);

  // Simulation settings
  const [initialCapital, setInitialCapital] = useState(10000);
  const [feeRate, setFeeRate] = useState(0.0005);

  // Compiler state
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileSuccess, setCompileSuccess] = useState<boolean | null>(true);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number>(0.38);
  const [outputPoints, setOutputPoints] = useState<number>(500);
  const [strategyResult, setStrategyResult] = useState<BacktestPerformance | null>(null);
  const [logs, setLogs] = useState<string[]>([
    "[SYSTEM] Indicator & Strategy Sandbox Engine initialized (Isolated Worker mode).",
    "[SANDBOX] Environment ready. Zero latency execution guard enabled (1500ms limit).",
  ]);

  const runCompilation = async (
    currentCode = code,
    capital = initialCapital,
    fee = feeRate,
    overrideName?: string
  ) => {
    setIsCompiling(true);
    const activeName = overrideName || scriptName;
    const fallbackBars = sampleBars.length > 0 ? sampleBars : [
      { time: Date.now() - 3600000, open: 68000, high: 68500, low: 67900, close: 68420, volume: 100 },
      { time: Date.now() - 1800000, open: 68420, high: 68600, low: 68300, close: 68550, volume: 120 },
      { time: Date.now(), open: 68550, high: 68700, low: 68400, close: 68600, volume: 150 },
    ];

    try {
      const res = await indicatorSandbox.execute({
        scriptId: "studio-script",
        code: currentCode,
        bars: fallbackBars,
        inputs: {
          period: 20,
          initialCapital: capital,
          feeRate: fee,
        },
      });

      setDurationMs(parseFloat(res.durationMs.toFixed(2)));
      if (res.success) {
        setCompileSuccess(true);
        setCompileError(null);
        setOutputPoints(res.data?.length || 0);

        if (res.strategyResult) {
          setStrategyResult(res.strategyResult);
          onStrategyResult?.(res.strategyResult, activeName);
          setLogs((prev) => [
            `[STRATEGY] Backtest executed: ${res.strategyResult?.totalTrades} trades, Win Rate: ${res.strategyResult?.winRate}%, Net Profit: $${res.strategyResult?.netProfit}`,
            `[SUCCESS] '${activeName}' compiled in ${res.durationMs.toFixed(2)}ms.`,
            ...prev.slice(0, 15),
          ]);
        } else {
          setLogs((prev) => [
            `[SUCCESS] '${activeName}' compiled in ${res.durationMs.toFixed(2)}ms. Output points: ${res.data?.length || 0}`,
            ...prev.slice(0, 15),
          ]);
        }
      } else {
        setCompileSuccess(false);
        setCompileError(res.error || "Compilation error");
        setLogs((prev) => [
          `[ERROR] Compilation failed: ${res.error}`,
          ...prev.slice(0, 15),
        ]);
      }
    } catch (err: any) {
      setCompileSuccess(false);
      setCompileError(err?.message || "Execution exception");
    } finally {
      setIsCompiling(false);
    }
  };

  useEffect(() => {
    if (autoRecompile && isOpen) {
      const t = setTimeout(() => {
        runCompilation(code);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [code, autoRecompile, isOpen, initialCapital, feeRate]);

  if (!isOpen) return null;

  const lineCount = code.split("\n").length;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 12) }, (_, i) => i + 1);

  const handleSelectPreset = (preset: typeof STRATEGY_PRESETS[0]) => {
    setCode(preset.code);
    setScriptName(preset.name);
    setIsPresetDropdownOpen(false);
    runCompilation(preset.code, initialCapital, feeRate, preset.name);
  };

  return (
    <section
      className={`bg-surface-container-lowest border-t border-border flex flex-col select-none transition-all duration-200 z-20 ${
        isExpanded ? "h-[450px]" : "h-72"
      }`}
    >
      {/* Studio Header Ribbon */}
      <div className="h-9 bg-surface border-b border-border px-3 flex items-center justify-between shrink-0">
        {/* Left: Studio Tabs */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("editor")}
            className={`px-2.5 py-1 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === "editor"
                ? "bg-primary-container text-white shadow-xs"
                : "text-muted hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <Code2 size={13} />
            <span>Pine/JS Editor</span>
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
          </button>

          <button
            onClick={() => setActiveTab("strategy")}
            className={`px-2.5 py-1 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === "strategy"
                ? "bg-primary-container text-white shadow-xs"
                : "text-muted hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <Activity size={13} />
            <span>Strategy Tester</span>
            {strategyResult && (
              <span className="px-1 py-0.2 rounded-full bg-secondary/20 text-secondary text-[9px] font-bold">
                {strategyResult.totalTrades}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`px-2.5 py-1 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === "logs"
                ? "bg-primary-container text-white shadow-xs"
                : "text-muted hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <Terminal size={13} />
            <span>Output Logs</span>
            {compileError && <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />}
          </button>
        </div>

        {/* Right: Sandbox Actions, Preset Loader & Controls */}
        <div className="flex items-center gap-2">
          {/* Preset Strategy Selector */}
          <div className="relative">
            <button
              onClick={() => setIsPresetDropdownOpen(!isPresetDropdownOpen)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/30 transition-colors"
            >
              <Sparkles size={11} className="text-gold" />
              <span>Strategies</span>
              <ChevronDown size={11} className="text-muted" />
            </button>

            {isPresetDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 w-64 bg-surface-container-low border border-border rounded shadow-xl py-1 z-50">
                <div className="px-2.5 py-1 text-[10px] font-mono text-muted uppercase">
                  Core Quant Strategy Trilogy
                </div>
                {STRATEGY_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPreset(p)}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-surface-container transition-colors flex flex-col"
                  >
                    <span className="text-xs font-mono font-semibold text-on-surface">{p.name}</span>
                    <span className="text-[10px] font-sans text-muted line-clamp-1">{p.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-3 w-px bg-border" />

          {/* Auto Recompile Switch */}
          <label className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-muted cursor-pointer hover:text-on-surface">
            <input
              type="checkbox"
              checked={autoRecompile}
              onChange={(e) => setAutoRecompile(e.target.checked)}
              className="accent-primary-container rounded"
            />
            <span>Auto-recompile</span>
          </label>

          {/* Admin: Publish Globally Toggle */}
          <button
            onClick={() => setIsPublishedGlobally(!isPublishedGlobally)}
            className={`hidden md:flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
              isPublishedGlobally
                ? "bg-secondary/15 text-secondary border-secondary/40"
                : "bg-surface-container-low text-muted border-outline-variant/30 hover:text-on-surface"
            }`}
            title="When active, script is marked verified and published to Global Community catalog"
          >
            <Globe size={11} />
            <span>{isPublishedGlobally ? "Admin: Global Active" : "Publish"}</span>
          </button>

          {/* Run Sandbox */}
          <button
            onClick={() => runCompilation()}
            disabled={isCompiling}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/30 text-xs font-mono transition-colors"
          >
            <Play size={12} className={isCompiling ? "animate-spin text-primary" : "text-secondary"} />
            <span>Run Sandbox</span>
          </button>

          {/* Add to Chart */}
          <button
            onClick={() => {
              if (onApplyIndicator) {
                onApplyIndicator(scriptName, code);
              }
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-primary-container hover:bg-accent-hover text-white text-xs font-mono font-semibold transition-colors shadow-xs"
          >
            <Plus size={12} />
            <span>Add to Chart</span>
          </button>

          <div className="h-3 w-px bg-border" />

          {/* Resize / Collapse / Close */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Collapse height" : "Expand height"}
            className="p-1 rounded text-muted hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>

          <button
            onClick={onClose}
            title="Close Script Studio"
            className="p-1 rounded text-muted hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main Studio Body Tabs */}
      {activeTab === "strategy" ? (
        <StrategyTesterPanel
          performance={strategyResult}
          onSelectTrade={onSelectTrade}
          onUpdateSettings={(cap, fee) => {
            setInitialCapital(cap);
            setFeeRate(fee);
            runCompilation(code, cap, fee);
          }}
        />
      ) : activeTab === "logs" ? (
        <div className="flex-1 p-3 overflow-y-auto no-scrollbar font-mono text-[11px] space-y-1 bg-surface-container-lowest">
          {logs.map((log, idx) => (
            <div
              key={idx}
              className={
                log.startsWith("[ERROR]")
                  ? "text-tertiary"
                  : log.startsWith("[STRATEGY]")
                  ? "text-cyan font-semibold"
                  : log.startsWith("[SUCCESS]")
                  ? "text-secondary"
                  : "text-muted"
              }
            >
              {log}
            </div>
          ))}
        </div>
      ) : (
        /* Split View: Editor (65%) + Compiler Console (35%) */
        <div className="flex-1 flex overflow-hidden">
          {/* Left 65%: Code Editor Area */}
          <div className="flex-[65] flex border-r border-border bg-surface-container-lowest overflow-hidden">
            {/* Line Numbers Gutter */}
            <div className="w-10 bg-surface-container-lowest border-r border-border/50 py-2 flex flex-col items-end pr-2 text-[11px] font-mono text-muted/50 select-none">
              {lineNumbers.map((num) => (
                <span key={num} className="leading-5">
                  {num}
                </span>
              ))}
            </div>

            {/* Code Textarea */}
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="flex-1 bg-transparent text-on-surface font-mono text-[12px] leading-5 p-2 focus:outline-hidden resize-none overflow-y-auto selection:bg-primary-container/30"
            />
          </div>

          {/* Right 35%: Compiler Sandbox Console & Diagnostics */}
          <div className="flex-[35] bg-surface flex flex-col overflow-hidden text-[11px] font-mono">
            {/* Compiler Status Bar */}
            <div className="px-3 py-1.5 bg-surface-container-lowest border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Cpu size={13} className="text-primary" />
                <span className="text-[10px] text-muted uppercase tracking-wider">Engine:</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    compileSuccess
                      ? "bg-secondary/15 text-secondary"
                      : "bg-tertiary/15 text-tertiary"
                  }`}
                >
                  {compileSuccess ? "OK - Zero Latency" : "COMPILE ERROR"}
                </span>
              </div>

              <div className="text-[10px] text-muted">
                <span>{durationMs}ms</span>
              </div>
            </div>

            {/* Engine Metrics Tape */}
            <div className="grid grid-cols-3 px-3 py-1.5 border-b border-border bg-surface-container-low text-[10px] text-muted">
              <div>
                <span className="text-outline">Points:</span>{" "}
                <span className="text-on-surface font-semibold">{outputPoints}</span>
              </div>
              <div>
                <span className="text-outline">Memory:</span>{" "}
                <span className="text-on-surface font-semibold">1.1 MB</span>
              </div>
              <div>
                <span className="text-outline">Trades:</span>{" "}
                <span className="text-on-surface font-semibold">
                  {strategyResult ? strategyResult.totalTrades : 0}
                </span>
              </div>
            </div>

            {/* Console Output Log Stream */}
            <div className="flex-1 p-2.5 overflow-y-auto no-scrollbar font-mono text-[11px] space-y-1 bg-surface-container-lowest">
              {compileError ? (
                <div className="flex items-start gap-1.5 text-tertiary bg-tertiary/10 p-2 rounded border border-tertiary/20">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{compileError}</span>
                </div>
              ) : null}

              {logs.map((log, idx) => (
                <div
                  key={idx}
                  className={
                    log.startsWith("[ERROR]")
                      ? "text-tertiary"
                      : log.startsWith("[STRATEGY]")
                      ? "text-cyan font-semibold"
                      : log.startsWith("[SUCCESS]")
                      ? "text-secondary"
                      : "text-muted"
                  }
                >
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
