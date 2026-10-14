"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Bell,
  Save,
  FolderOpen,
  Trash2,
  FileCode,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { indicatorSandbox } from "@/lib/indicators/sandbox";
import { CandlestickBar } from "@/lib/mexc/types";
import { BacktestPerformance, BacktestTrade } from "@/lib/strategy/types";
import { STRATEGY_PRESETS } from "@/lib/strategy/presets";
import { StrategyTesterPanel } from "./StrategyTesterPanel";
import {
  CustomScript,
  getCustomScripts,
  saveCustomScript,
  deleteCustomScript,
  saveStudioDraft,
  getStudioDraft,
  DEFAULT_STARTER_SCRIPT,
  DEFAULT_FVG_SCRIPT,
  resolveCatalogScriptCode,
} from "@/lib/indicators/custom-scripts-store";

interface ScriptStudioProps {
  isOpen: boolean;
  onClose: () => void;
  sampleBars: CandlestickBar[];
  onApplyIndicator?: (
    name: string,
    code: string,
    data?: Array<{ time: number; value: number }>,
    boxes?: any[]
  ) => void;
  onStrategyResult?: (result: BacktestPerformance, name?: string) => void;
  onSelectTrade?: (trade: BacktestTrade) => void;
  initialScript?: CustomScript | null;
}

export function ScriptStudio({
  isOpen,
  onClose,
  sampleBars,
  onApplyIndicator,
  onStrategyResult,
  onSelectTrade,
  initialScript,
}: ScriptStudioProps) {
  const [activeTab, setActiveTab] = useState<"editor" | "strategy" | "logs">("editor");
  const [code, setCode] = useState(DEFAULT_FVG_SCRIPT);
  const [scriptName, setScriptName] = useState("Unmitigated FVG (0% Hit)");
  const [currentScriptId, setCurrentScriptId] = useState<string | null>("script-fvg-unmitigated");
  const [autoRecompile, setAutoRecompile] = useState(true);
  const [isPublishedGlobally, setIsPublishedGlobally] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);
  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const [isAddedRecently, setIsAddedRecently] = useState(false);
  const [savedScripts, setSavedScripts] = useState<CustomScript[]>([]);

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
  const [compiledData, setCompiledData] = useState<Array<{ time: number; value: number }> | null>(null);
  const [compiledBoxes, setCompiledBoxes] = useState<any[] | null>(null);
  const [logs, setLogs] = useState<string[]>([
    "[SYSTEM] Indicator & Strategy Sandbox Engine initialized (Isolated Worker mode).",
    "[SANDBOX] Environment ready. Zero latency execution guard enabled (1500ms limit).",
  ]);

  // Load saved scripts and initial script or draft
  useEffect(() => {
    if (typeof window !== "undefined") {
      const scripts = getCustomScripts();
      setSavedScripts(scripts);

      if (initialScript) {
        setCode(initialScript.code);
        setScriptName(initialScript.name);
        setCurrentScriptId(initialScript.id);
        return;
      }

      const draft = getStudioDraft();
      if (draft && draft.code) {
        setCode(draft.code);
        setScriptName(draft.name || "Untitled Script");
        setCurrentScriptId(draft.scriptId || null);
      }
    }
  }, [initialScript]);

  // Listen for external open-script events
  useEffect(() => {
    const handleOpenExternal = (e: any) => {
      if (e.detail?.script) {
        const s: CustomScript = e.detail.script;
        const resolvedCode = s.code || resolveCatalogScriptCode(s.id, s.name);
        setCode(resolvedCode);
        setScriptName(s.name || "Custom Indicator");
        setCurrentScriptId(s.id || null);
        runCompilation(resolvedCode, initialCapital, feeRate, s.name);
      }
    };
    window.addEventListener("mochex:open-script-studio", handleOpenExternal);
    return () => window.removeEventListener("mochex:open-script-studio", handleOpenExternal);
  }, []);

  // Auto-save draft to avoid losing code
  useEffect(() => {
    if (code && typeof window !== "undefined") {
      const t = setTimeout(() => {
        saveStudioDraft({ name: scriptName, code, scriptId: currentScriptId || undefined });
      }, 800);
      return () => clearTimeout(t);
    }
  }, [code, scriptName, currentScriptId]);

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
        scriptId: currentScriptId || "studio-script",
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

        let points: Array<{ time: number; value: number }> | null = null;
        if (Array.isArray(res.data)) {
          points = (res.data as any[])
            .filter(
              (d) =>
                d &&
                d.time !== undefined &&
                d.value !== null &&
                d.value !== undefined &&
                typeof Number(d.value) === "number" &&
                !isNaN(Number(d.value))
            )
            .map((d) => ({
              time: typeof d.time === "number" ? d.time : Number(d.time),
              value: Number(d.value),
            }));
          setCompiledData(points.length > 0 ? points : null);
        } else {
          setCompiledData(null);
        }

        const boxes = Array.isArray(res.boxes) && res.boxes.length > 0 ? res.boxes : null;
        setCompiledBoxes(boxes);

        if (res.strategyResult) {
          setStrategyResult(res.strategyResult);
          onStrategyResult?.(res.strategyResult, activeName);
          setLogs((prev) => [
            `[STRATEGY] Backtest executed: ${res.strategyResult?.totalTrades} trades, Win Rate: ${res.strategyResult?.winRate}%, Net Profit: $${res.strategyResult?.netProfit}`,
            `[SUCCESS] '${activeName}' compiled in ${res.durationMs.toFixed(2)}ms.`,
            ...prev.slice(0, 15),
          ]);
        } else {
          setStrategyResult(null);
          setLogs((prev) => [
            `[SUCCESS] '${activeName}' compiled in ${res.durationMs.toFixed(2)}ms. Output points: ${res.data?.length || 0}`,
            ...prev.slice(0, 15),
          ]);
        }

        // Dispatch strategy & indicator condition alerts evaluation (DEC-079)
        if (
          typeof window !== "undefined" &&
          (res.orderIntents?.length || res.alertConditions?.length)
        ) {
          const lastBar = sampleBars[sampleBars.length - 1];
          const currPrice = lastBar ? lastBar.close : 0;
          const activeSym = localStorage.getItem("mochex:symbol") || "BTCUSDT";
          window.dispatchEvent(
            new CustomEvent("mochex:evaluate-strategy-alerts", {
              detail: {
                symbol: activeSym,
                currentPrice: currPrice,
                currentTimeSec: lastBar ? lastBar.time : Math.floor(Date.now() / 1000),
                currentBar: lastBar,
                isBarClosed: true,
                orderIntents: res.orderIntents,
                scriptAlertConditions: res.alertConditions,
              },
            })
          );
        }

        return {
          success: true,
          data: points && points.length > 0 ? points : null,
          boxes,
        };
      } else {
        setCompileSuccess(false);
        setCompileError(res.error || "Compilation error");
        setLogs((prev) => [
          `[ERROR] Compilation failed: ${res.error}`,
          ...prev.slice(0, 15),
        ]);
        return {
          success: false,
          data: null,
          boxes: null,
        };
      }
    } catch (err: any) {
      setCompileSuccess(false);
      setCompileError(err?.message || "Execution exception");
      return {
        success: false,
        data: null,
        boxes: null,
      };
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

  const lineCount = (code || "").split("\n").length;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 12) }, (_, i) => i + 1);

  const handleSelectPreset = (preset: typeof STRATEGY_PRESETS[0]) => {
    setCode(preset.code);
    setScriptName(preset.name);
    setCurrentScriptId(null);
    setIsPresetDropdownOpen(false);
    runCompilation(preset.code, initialCapital, feeRate, preset.name);
  };

  const handleSelectCustomScript = (script: CustomScript) => {
    setCode(script.code);
    setScriptName(script.name);
    setCurrentScriptId(script.id);
    setIsPresetDropdownOpen(false);
    runCompilation(script.code, initialCapital, feeRate, script.name);
  };

  const handleCreateNewScript = () => {
    setCode(DEFAULT_STARTER_SCRIPT);
    setScriptName("New Custom Indicator");
    setCurrentScriptId(null);
    setCompiledData(null);
    setStrategyResult(null);
    setIsPresetDropdownOpen(false);
    runCompilation(DEFAULT_STARTER_SCRIPT, initialCapital, feeRate, "New Custom Indicator");
  };

  const handleSaveScript = () => {
    const activeCode = code || DEFAULT_STARTER_SCRIPT;
    const isStrategy = activeCode.includes("strategy.") || activeCode.includes("strategy_");
    const saved = saveCustomScript({
      id: currentScriptId || undefined,
      name: scriptName,
      code: activeCode,
      type: isStrategy ? "strategy" : "indicator",
      isPublished: isPublishedGlobally,
    });
    setCurrentScriptId(saved.id);
    setSavedScripts(getCustomScripts());
    setIsSavedRecently(true);
    setTimeout(() => setIsSavedRecently(false), 2500);
    setLogs((prev) => [`[SAVE] Script '${saved.name}' saved to local library.`, ...prev.slice(0, 15)]);
  };

  const handleDeleteSavedScript = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = deleteCustomScript(id);
    setSavedScripts(updated);
    if (currentScriptId === id) {
      handleCreateNewScript();
    }
  };

  const handleAddToChart = async () => {
    // 1. Ensure saved
    handleSaveScript();

    // 2. Freshly compile current code to get immediate data & boxes
    let dataToPass = compiledData;
    let boxesToPass = compiledBoxes;

    const comp = await runCompilation();
    if (comp && comp.success) {
      dataToPass = comp.data;
      boxesToPass = comp.boxes;
    }

    // 3. Apply to chart
    if (onApplyIndicator) {
      onApplyIndicator(scriptName, code, dataToPass || undefined, boxesToPass || undefined);
    }
    setIsAddedRecently(true);
    setTimeout(() => setIsAddedRecently(false), 3000);

    setLogs((prev) => [
      `[CHART] Added '${scriptName}' to active indicators on chart.`,
      ...prev.slice(0, 15),
    ]);
  };

  if (!isOpen) return null;

  return (
    <section
      className={`bg-surface-container-lowest border-t border-border flex flex-col select-none transition-all duration-200 z-20 overflow-hidden ${
        isMaximized ? "h-[82vh]" : isExpanded ? "h-[520px]" : "h-76"
      }`}
    >
      {/* Studio Header Ribbon - Fixed Sticky Top */}
      <div className="h-10 bg-surface border-b border-border px-3 flex items-center justify-between shrink-0 sticky top-0 z-30">
        {/* Left: Studio Tabs */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab("editor")}
            title="Write modern JavaScript using TradingView Pine-style API (ta.*, strategy.*, alertcondition())"
            className={`px-2.5 py-1 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === "editor"
                ? "bg-primary-container text-white shadow-xs"
                : "text-muted hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <Code2 size={13} />
            <span>Script Editor (JS / Pine API)</span>
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
              <span className="px-1.5 py-0.2 rounded-full bg-secondary/20 text-secondary text-[10px] font-bold">
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

          <div className="h-4 w-px bg-border mx-1" />

          {/* Editable Script Name Input */}
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={scriptName}
              onChange={(e) => setScriptName(e.target.value)}
              placeholder="Script Name"
              title="Click to rename script"
              className="bg-surface-container-low hover:bg-surface-container focus:bg-surface-container border border-outline-variant/30 focus:border-primary px-2 py-0.5 rounded text-xs font-mono font-semibold text-on-surface focus:outline-none w-44 md:w-56 transition-colors"
            />
          </div>
        </div>

        {/* Right: Sandbox Actions, Preset Loader & Controls */}
        <div className="flex items-center gap-2">
          {/* New Script Button */}
          <button
            onClick={handleCreateNewScript}
            title="Create a new clean script"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono bg-surface-container-low hover:bg-surface-container text-muted hover:text-on-surface border border-outline-variant/30 transition-colors cursor-pointer"
          >
            <Plus size={12} />
            <span className="hidden sm:inline">New</span>
          </button>

          {/* Save Script Button */}
          <button
            onClick={handleSaveScript}
            title="Save script to local library (persisted across sessions)"
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors cursor-pointer border ${
              isSavedRecently
                ? "bg-secondary/20 text-secondary border-secondary/40"
                : "bg-surface-container-low hover:bg-surface-container text-on-surface border-outline-variant/30"
            }`}
          >
            {isSavedRecently ? <Check size={12} /> : <Save size={12} className="text-primary" />}
            <span>{isSavedRecently ? "Saved!" : "Save"}</span>
          </button>

          {/* Presets & Saved Scripts Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsPresetDropdownOpen(!isPresetDropdownOpen)}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/30 transition-colors cursor-pointer"
            >
              <FolderOpen size={12} className="text-gold" />
              <span className="hidden md:inline">Scripts & Presets</span>
              <span className="md:hidden">Presets</span>
              <ChevronDown size={11} className="text-muted" />
            </button>

            {isPresetDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 w-72 bg-surface border border-border rounded-lg shadow-2xl py-1 z-50 max-h-80 overflow-y-auto no-scrollbar">
                {/* My Custom Saved Scripts */}
                <div className="px-3 py-1.5 text-[10px] font-mono text-muted uppercase tracking-wider bg-surface-container-lowest border-b border-border flex items-center justify-between">
                  <span>My Saved Scripts ({savedScripts.length})</span>
                  <button
                    onClick={handleCreateNewScript}
                    className="text-primary hover:underline flex items-center gap-0.5 text-[10px]"
                  >
                    <Plus size={10} />
                    <span>New</span>
                  </button>
                </div>

                {savedScripts.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectCustomScript(s)}
                    className={`px-3 py-1.5 hover:bg-surface-container transition-colors flex items-center justify-between cursor-pointer ${
                      currentScriptId === s.id ? "bg-primary-container/10 border-l-2 border-primary" : ""
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="text-xs font-mono font-semibold text-on-surface truncate">{s.name}</span>
                      <span className="text-[10px] font-sans text-muted line-clamp-1">{s.description}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSavedScript(e, s.id)}
                      title="Delete script"
                      className="p-1 hover:bg-tertiary/20 text-muted hover:text-tertiary rounded transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                {/* Built-in Strategy Trilogy */}
                <div className="px-3 py-1.5 text-[10px] font-mono text-muted uppercase tracking-wider bg-surface-container-lowest border-y border-border mt-1">
                  Built-in Quant Strategies
                </div>
                {STRATEGY_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPreset(p)}
                    className="w-full text-left px-3 py-1.5 hover:bg-surface-container transition-colors flex flex-col cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-on-surface">{p.name}</span>
                      <span className="text-[9px] font-mono text-secondary px-1 rounded bg-secondary/10">
                        {p.category}
                      </span>
                    </div>
                    <span className="text-[10px] font-sans text-muted line-clamp-1">{p.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Auto Recompile Switch */}
          <label className="hidden lg:flex items-center gap-1.5 text-[11px] font-mono text-muted cursor-pointer hover:text-on-surface">
            <input
              type="checkbox"
              checked={autoRecompile}
              onChange={(e) => setAutoRecompile(e.target.checked)}
              className="accent-primary-container rounded cursor-pointer"
            />
            <span>Auto-recompile</span>
          </label>

          {/* Run Sandbox */}
          <button
            onClick={() => runCompilation()}
            disabled={isCompiling}
            className="flex items-center gap-1 px-3 py-1 rounded bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/30 text-xs font-mono font-medium transition-colors cursor-pointer"
            title="Execute script in safe isolated Web Worker sandbox"
          >
            <Play size={12} className={isCompiling ? "animate-spin text-primary" : "text-secondary fill-secondary/20"} />
            <span>Run Sandbox</span>
          </button>

          {/* Add to Chart */}
          <button
            onClick={handleAddToChart}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-semibold transition-colors shadow-xs cursor-pointer ${
              isAddedRecently
                ? "bg-secondary text-surface font-bold border border-secondary shadow-sm"
                : "bg-primary-container hover:bg-accent-hover text-white"
            }`}
            title="Save script and apply directly to chart workspace"
          >
            {isAddedRecently ? <Check size={13} /> : <Plus size={13} />}
            <span>{isAddedRecently ? "Added to Chart!" : "Add to Chart"}</span>
          </button>

          {/* Set Alert */}
          <button
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("mochex:create-strategy-alert", {
                  detail: {
                    scriptName,
                    code,
                    condition: "strategy_any_order",
                  },
                })
              );
            }}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container text-gold border border-gold/30 text-xs font-mono font-medium transition-colors cursor-pointer"
            title="Create Alert from this Strategy / Script"
          >
            <Bell size={12} className="text-gold" />
            <span className="hidden md:inline">Alert</span>
          </button>

          <div className="h-4 w-px bg-border" />

          {/* Maximize / Restore Button (82vh) */}
          <button
            onClick={() => {
              setIsMaximized((prev) => {
                const next = !prev;
                if (next) setIsExpanded(false);
                return next;
              });
            }}
            title={isMaximized ? "Restore Studio Dock Height" : "Maximize Studio Dock Height (82vh)"}
            className="p-1 rounded text-muted hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          >
            {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {!isMaximized && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? "Collapse height" : "Expand height"}
              className="p-1 rounded text-muted hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          )}

          <button
            onClick={onClose}
            title="Close Script Studio"
            className="p-1 rounded text-muted hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
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
                  : log.startsWith("[SAVE]")
                  ? "text-gold font-medium"
                  : log.startsWith("[CHART]")
                  ? "text-primary font-medium"
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
          <div className="flex-[65] flex border-r border-border bg-surface-container-lowest overflow-hidden relative">
            {/* Line Numbers Gutter */}
            <div
              ref={gutterRef}
              className="w-10 bg-surface-container-lowest border-r border-border/50 py-2 flex flex-col items-end pr-2 text-[11px] font-mono text-muted/50 select-none overflow-hidden"
            >
              {lineNumbers.map((num) => (
                <span key={num} className="leading-5 h-5 shrink-0">
                  {num}
                </span>
              ))}
            </div>

            {/* Code Textarea */}
            <textarea
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setIsSavedRecently(false);
              }}
              onScroll={(e) => {
                if (gutterRef.current) {
                  gutterRef.current.scrollTop = e.currentTarget.scrollTop;
                }
              }}
              spellCheck={false}
              className="flex-1 bg-transparent text-on-surface font-mono text-[12px] leading-5 p-2 focus:outline-hidden resize-none overflow-y-auto selection:bg-primary-container/30"
              placeholder="// Write your JavaScript calculate(bars, inputs, ta, strategy, alertcondition) function here..."
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
                  {compileSuccess ? "OK - Active" : "COMPILE ERROR"}
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
                <span className="text-outline">Mode:</span>{" "}
                <span className="text-on-surface font-semibold">
                  {strategyResult ? "Strategy" : "Indicator"}
                </span>
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
                  <div className="space-y-0.5">
                    <span className="font-semibold block">Execution Error:</span>
                    <span className="text-[10px] break-all leading-normal">{compileError}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 text-muted">
                  <div className="flex items-center gap-1 text-secondary font-medium">
                    <Check size={12} />
                    <span>Script parsed and validated successfully.</span>
                  </div>
                  {strategyResult ? (
                    <div className="p-2 rounded bg-surface-container-low border border-border space-y-1 mt-1">
                      <div className="flex items-center justify-between text-on-surface font-semibold">
                        <span>Strategy Backtest Summary</span>
                        <span className={strategyResult.netProfit >= 0 ? "text-secondary" : "text-tertiary"}>
                          {strategyResult.netProfit >= 0 ? "+" : ""}${strategyResult.netProfit.toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 text-[10px] text-muted">
                        <span>Win Rate: {strategyResult.winRate}%</span>
                        <span>Profit Factor: {strategyResult.profitFactor}</span>
                        <span>Max Drawdown: {strategyResult.maxDrawdownPercent}%</span>
                        <span>Total Trades: {strategyResult.totalTrades}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-muted">
                      Emitting {outputPoints} series points to chart canvas.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Helper Syntax Footer */}
            <div className="px-3 py-1 bg-surface-container-low border-t border-border flex items-center justify-between text-[10px] text-muted">
              <span>Pine API: ta.*, strategy.at(i).*, alertcondition()</span>
              <span className="text-secondary font-mono">JS ES6</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
