"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  Percent,
  Activity,
  AlertTriangle,
  Award,
  Layers,
  ChevronRight,
  Sliders,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { BacktestPerformance, BacktestTrade } from "@/lib/strategy/types";

interface StrategyTesterPanelProps {
  performance?: BacktestPerformance | null;
  onSelectTrade?: (trade: BacktestTrade) => void;
  onUpdateSettings?: (capital: number, fee: number) => void;
}

export function StrategyTesterPanel({
  performance,
  onSelectTrade,
  onUpdateSettings,
}: StrategyTesterPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<"equity" | "trades" | "settings">("equity");
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; equity: number; dd: number; time: number } | null>(null);

  // Settings
  const [capitalInput, setCapitalInput] = useState("10000");
  const [feeInput, setFeeInput] = useState("0.05");

  if (!performance) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-muted font-mono select-none">
        <Activity size={32} className="text-primary mb-2 opacity-50 animate-pulse" />
        <span className="text-xs text-on-surface font-semibold">No Strategy Backtest Results Yet</span>
        <p className="text-[11px] text-muted max-w-sm mt-1">
          Select a strategy preset or write a script with <code className="text-primary bg-surface px-1 py-0.5 rounded">strategy.entry()</code> and click &quot;Run Sandbox&quot; to simulate performance.
        </p>
      </div>
    );
  }

  const {
    initialCapital,
    endingEquity,
    netProfit,
    netProfitPercent,
    winRate,
    winningTrades,
    losingTrades,
    totalTrades,
    profitFactor,
    maxDrawdown,
    maxDrawdownPercent,
    sharpeRatio,
    equityCurve,
    trades,
  } = performance;

  const isNetProfitPositive = netProfit >= 0;

  // Prepare SVG Equity Curve path
  const svgWidth = 600;
  const svgHeight = 160;
  const paddingX = 40;
  const paddingY = 20;

  const allEquities = equityCurve.map((p) => p.equity);
  const minEquity = Math.min(...allEquities, initialCapital * 0.95);
  const maxEquity = Math.max(...allEquities, initialCapital * 1.05);
  const equityRange = maxEquity - minEquity || 1;

  const points = equityCurve.map((pt, idx) => {
    const x = paddingX + ((svgWidth - paddingX * 2) / Math.max(equityCurve.length - 1, 1)) * idx;
    const y = svgHeight - paddingY - ((pt.equity - minEquity) / equityRange) * (svgHeight - paddingY * 2);
    return { x, y, equity: pt.equity, dd: pt.drawdownPercent, time: pt.time };
  });

  const pathD = points.reduce((acc, pt, idx) => {
    return `${acc} ${idx === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, "");

  const initialY =
    svgHeight - paddingY - ((initialCapital - minEquity) / equityRange) * (svgHeight - paddingY * 2);

  const handleApplySettings = () => {
    const cap = parseFloat(capitalInput) || 10000;
    const fee = (parseFloat(feeInput) || 0.05) / 100;
    onUpdateSettings?.(cap, fee);
  };

  return (
    <div className="h-full flex flex-col bg-surface font-mono select-none overflow-hidden text-xs">
      {/* 1. Performance Metric Ribbon Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-2.5 bg-surface-container-lowest border-b border-border shrink-0">
        {/* Net Profit */}
        <div className="bg-surface-container-low p-2 rounded border border-border">
          <div className="text-[10px] text-muted flex items-center justify-between">
            <span>Net Profit</span>
            {isNetProfitPositive ? (
              <ArrowUpRight size={12} className="text-secondary" />
            ) : (
              <ArrowDownRight size={12} className="text-tertiary" />
            )}
          </div>
          <div
            className={`text-sm font-bold mt-0.5 ${
              isNetProfitPositive ? "text-secondary" : "text-tertiary"
            }`}
          >
            {isNetProfitPositive ? "+" : ""}${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-muted font-medium">
            {isNetProfitPositive ? "+" : ""}{netProfitPercent.toFixed(2)}%
          </div>
        </div>

        {/* Win Rate */}
        <div className="bg-surface-container-low p-2 rounded border border-border">
          <div className="text-[10px] text-muted flex items-center justify-between">
            <span>Win Rate</span>
            <Percent size={12} className="text-primary" />
          </div>
          <div className="text-sm font-bold text-on-surface mt-0.5">{winRate.toFixed(1)}%</div>
          <div className="text-[10px] text-muted font-medium">
            {winningTrades}W / {losingTrades}L ({totalTrades} total)
          </div>
        </div>

        {/* Profit Factor */}
        <div className="bg-surface-container-low p-2 rounded border border-border">
          <div className="text-[10px] text-muted flex items-center justify-between">
            <span>Profit Factor</span>
            <TrendingUp size={12} className="text-gold" />
          </div>
          <div className="text-sm font-bold text-on-surface mt-0.5">
            {profitFactor >= 999 ? "∞" : profitFactor.toFixed(2)}
          </div>
          <div className="text-[10px] text-muted font-medium">
            {profitFactor >= 1.5 ? "High Edge" : profitFactor >= 1.0 ? "Moderate" : "Negative"}
          </div>
        </div>

        {/* Max Drawdown */}
        <div className="bg-surface-container-low p-2 rounded border border-border">
          <div className="text-[10px] text-muted flex items-center justify-between">
            <span>Max Drawdown</span>
            <AlertTriangle size={12} className="text-tertiary" />
          </div>
          <div className="text-sm font-bold text-tertiary mt-0.5">
            -{maxDrawdownPercent.toFixed(2)}%
          </div>
          <div className="text-[10px] text-muted font-medium">
            -${maxDrawdown.toLocaleString()}
          </div>
        </div>

        {/* Sharpe Ratio */}
        <div className="bg-surface-container-low p-2 rounded border border-border">
          <div className="text-[10px] text-muted flex items-center justify-between">
            <span>Sharpe Ratio</span>
            <Award size={12} className="text-cyan" />
          </div>
          <div className="text-sm font-bold text-on-surface mt-0.5">{sharpeRatio.toFixed(2)}</div>
          <div className="text-[10px] text-muted font-medium">
            {sharpeRatio >= 2 ? "Excellent" : sharpeRatio >= 1 ? "Good" : "Sub-optimal"}
          </div>
        </div>

        {/* Ending Equity */}
        <div className="bg-surface-container-low p-2 rounded border border-border">
          <div className="text-[10px] text-muted flex items-center justify-between">
            <span>Ending Equity</span>
            <DollarSign size={12} className="text-primary" />
          </div>
          <div className="text-sm font-bold text-on-surface mt-0.5">
            ${endingEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-muted font-medium">
            Base ${initialCapital.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 2. Sub-Tabs Header */}
      <div className="h-8 px-3 bg-surface-container-lowest border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveSubTab("equity")}
            className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
              activeSubTab === "equity"
                ? "bg-primary-container text-white"
                : "text-muted hover:text-on-surface"
            }`}
          >
            Equity Curve & Drawdown
          </button>

          <button
            onClick={() => setActiveSubTab("trades")}
            className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
              activeSubTab === "trades"
                ? "bg-primary-container text-white"
                : "text-muted hover:text-on-surface"
            }`}
          >
            Trade Log ({trades.length})
          </button>

          <button
            onClick={() => setActiveSubTab("settings")}
            className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
              activeSubTab === "settings"
                ? "bg-primary-container text-white"
                : "text-muted hover:text-on-surface"
            }`}
          >
            Simulation Settings
          </button>
        </div>

        {hoveredPoint && (
          <div className="text-[10px] text-muted flex items-center gap-2">
            <span>Equity: <strong className="text-on-surface">${hoveredPoint.equity.toLocaleString()}</strong></span>
            <span>DD: <strong className="text-tertiary">-{hoveredPoint.dd.toFixed(2)}%</strong></span>
          </div>
        )}
      </div>

      {/* 3. Sub-Tab Body */}
      <div className="flex-1 overflow-hidden relative">
        {activeSubTab === "equity" && (
          <div className="w-full h-full p-2 flex flex-col justify-center items-center bg-surface-container-lowest">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-full max-h-48 overflow-visible"
              preserveAspectRatio="none"
            >
              {/* Baseline at initial capital */}
              <line
                x1={paddingX}
                y1={initialY}
                x2={svgWidth - paddingX}
                y2={initialY}
                stroke="#434656"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={paddingX + 4}
                y={initialY - 4}
                fill="#8d90a2"
                fontSize="9"
                fontFamily="JetBrains Mono"
              >
                Base ${initialCapital}
              </text>

              {/* Equity Curve Line */}
              <path
                d={pathD}
                fill="none"
                stroke={isNetProfitPositive ? "#00c087" : "#ff3b30"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data points hover interaction */}
              {points.map((pt, idx) => (
                <circle
                  key={idx}
                  cx={pt.x}
                  cy={pt.y}
                  r="3"
                  className="fill-primary-container hover:fill-white cursor-pointer transition-transform hover:scale-150"
                  onMouseEnter={() => setHoveredPoint(pt)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              ))}
            </svg>
          </div>
        )}

        {activeSubTab === "trades" && (
          <div className="w-full h-full overflow-y-auto no-scrollbar">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="sticky top-0 bg-surface-container-lowest text-muted text-[10px] uppercase border-b border-border">
                <tr>
                  <th className="py-1 px-3">#</th>
                  <th className="py-1 px-2">Type</th>
                  <th className="py-1 px-2">Entry Price</th>
                  <th className="py-1 px-2">Exit Price</th>
                  <th className="py-1 px-2 text-right">Net PnL ($)</th>
                  <th className="py-1 px-2 text-right">PnL (%)</th>
                  <th className="py-1 px-2">Reason</th>
                  <th className="py-1 px-3 text-right">Bars</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {trades.map((t, idx) => {
                  const isProfitable = t.netPnL >= 0;
                  return (
                    <tr
                      key={t.tradeId}
                      onClick={() => onSelectTrade?.(t)}
                      className="hover:bg-surface-container cursor-pointer transition-colors"
                    >
                      <td className="py-1 px-3 text-muted">{idx + 1}</td>
                      <td className="py-1 px-2">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                            t.direction === "long"
                              ? "bg-secondary/15 text-secondary border border-secondary/30"
                              : "bg-tertiary/15 text-tertiary border border-tertiary/30"
                          }`}
                        >
                          {t.direction}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-on-surface">${t.entryPrice.toFixed(2)}</td>
                      <td className="py-1 px-2 text-on-surface">${t.exitPrice.toFixed(2)}</td>
                      <td
                        className={`py-1 px-2 text-right font-bold ${
                          isProfitable ? "text-secondary" : "text-tertiary"
                        }`}
                      >
                        {isProfitable ? "+" : ""}${t.netPnL.toFixed(2)}
                      </td>
                      <td
                        className={`py-1 px-2 text-right ${
                          isProfitable ? "text-secondary" : "text-tertiary"
                        }`}
                      >
                        {isProfitable ? "+" : ""}{t.pnlPercent.toFixed(2)}%
                      </td>
                      <td className="py-1 px-2 text-muted text-[10px]">{t.exitReason}</td>
                      <td className="py-1 px-3 text-right text-muted">{t.barsHeld}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeSubTab === "settings" && (
          <div className="p-4 max-w-md space-y-3">
            <div>
              <label className="text-[11px] text-muted block mb-1">Initial Capital (USDT)</label>
              <input
                type="number"
                value={capitalInput}
                onChange={(e) => setCapitalInput(e.target.value)}
                className="w-full bg-surface-container-low text-on-surface border border-border rounded px-2.5 py-1 text-xs focus:outline-hidden focus:border-primary-container"
              />
            </div>

            <div>
              <label className="text-[11px] text-muted block mb-1">Exchange Fee Rate (%)</label>
              <input
                type="number"
                step="0.01"
                value={feeInput}
                onChange={(e) => setFeeInput(e.target.value)}
                className="w-full bg-surface-container-low text-on-surface border border-border rounded px-2.5 py-1 text-xs focus:outline-hidden focus:border-primary-container"
              />
              <span className="text-[10px] text-muted mt-0.5 block">
                Standard MEXC Spot Taker Fee: 0.05%
              </span>
            </div>

            <button
              onClick={handleApplySettings}
              className="px-3 py-1.5 rounded bg-primary-container hover:bg-accent-hover text-white text-xs font-semibold transition-colors"
            >
              Apply Simulation Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
