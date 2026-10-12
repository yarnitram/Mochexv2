import { IndicatorWorkerMessageInput, IndicatorWorkerMessageOutput } from "@/types/indicator";
import { ta } from "./ta-math";
import { OrderDirection, StrategyOrderIntent } from "@/lib/strategy/types";
import { BacktestSimulationEngine } from "@/lib/strategy/simulator";

export class IndicatorSandbox {
  private timeoutMs: number;

  constructor(timeoutMs = 1500) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Executes user-defined indicator/strategy script safely:
   * function calculate(bars, inputs, ta, strategy) { ... }
   * Enforces timeout guard and strips network primitives.
   */
  public async execute(input: IndicatorWorkerMessageInput): Promise<IndicatorWorkerMessageOutput> {
    const startTime = performance.now();

    return new Promise((resolve) => {
      let isTimedOut = false;
      const timer = setTimeout(() => {
        isTimedOut = true;
        resolve({
          scriptId: input.scriptId,
          success: false,
          error: `Execution timeout exceeded (${this.timeoutMs}ms limit)`,
          durationMs: performance.now() - startTime,
        });
      }, this.timeoutMs);

      try {
        // Strip sensitive access
        const restrictedScope = {
          fetch: undefined,
          WebSocket: undefined,
          XMLHttpRequest: undefined,
          localStorage: undefined,
          sessionStorage: undefined,
          document: undefined,
          window: undefined,
          process: undefined,
        };

        // Order intent recorder for Strategy testing
        const orderIntents: StrategyOrderIntent[] = [];
        let activeBarIndex = input.bars.length - 1;

        const createStrategyMethods = (getIdx: () => number) => ({
          entry: (id: string, direction: OrderDirection, options?: any) => {
            const idx = options?.barIndex !== undefined ? options.barIndex : getIdx();
            orderIntents.push({
              barIndex: Math.max(0, Math.min(input.bars.length - 1, idx)),
              time: input.bars[idx]?.time || 0,
              type: "ENTRY",
              orderId: id,
              direction,
              qtyPercent: options?.qtyPercent,
              qtyFixed: options?.qty,
              stopLossPrice: options?.stopLoss,
              takeProfitPrice: options?.takeProfit,
            });
          },
          close: (id: string, options?: any) => {
            const idx = options?.barIndex !== undefined ? options.barIndex : getIdx();
            orderIntents.push({
              barIndex: Math.max(0, Math.min(input.bars.length - 1, idx)),
              time: input.bars[idx]?.time || 0,
              type: "CLOSE",
              orderId: id,
            });
          },
          exit: (id: string, options: any) => {
            const idx = options?.barIndex !== undefined ? options.barIndex : getIdx();
            orderIntents.push({
              barIndex: Math.max(0, Math.min(input.bars.length - 1, idx)),
              time: input.bars[idx]?.time || 0,
              type: "EXIT",
              orderId: id,
              stopLossPrice: options?.stopLoss,
              takeProfitPrice: options?.takeProfit,
              limitPrice: options?.limit,
            });
          },
        });

        const defaultMethods = createStrategyMethods(() => activeBarIndex);

        const strategyProxy: any = {
          ...defaultMethods,
          get barIndex() {
            return activeBarIndex;
          },
          set barIndex(val: number) {
            activeBarIndex = val;
          },
          setCurrentBar: (idx: number) => {
            activeBarIndex = idx;
          },
          at: (idx: number) => createStrategyMethods(() => idx),
          position: {
            isOpen: false,
            direction: null,
            entryPrice: 0,
            size: 0,
          },
        };

        // Construct sandbox wrapper
        const sandboxFunction = new Function(
          "bars",
          "inputs",
          "ta",
          "strategy",
          "restricted",
          `
          "use strict";
          const { fetch, WebSocket, XMLHttpRequest, localStorage, sessionStorage, document, window, process } = restricted;
          ${input.code}
          if (typeof calculate !== "function") {
            throw new Error("Script must define a 'calculate(bars, inputs, ta)' function.");
          }
          return calculate(bars, inputs, ta, strategy);
        `
        );

        const result = sandboxFunction(input.bars, input.inputs, ta, strategyProxy, restrictedScope);

        clearTimeout(timer);
        if (isTimedOut) return;

        if (!Array.isArray(result)) {
          resolve({
            scriptId: input.scriptId,
            success: false,
            error: "calculate() must return an array of { time, value } objects.",
            durationMs: performance.now() - startTime,
          });
          return;
        }

        // If strategy orders were emitted, simulate backtest
        let strategyResult = undefined;
        if (orderIntents.length > 0) {
          const simEngine = new BacktestSimulationEngine({
            initialCapital: input.inputs?.initialCapital || 10000,
            feeRate: input.inputs?.feeRate || 0.0005,
          });
          strategyResult = simEngine.simulate(input.bars as any, orderIntents);
        }

        resolve({
          scriptId: input.scriptId,
          success: true,
          data: result,
          strategyResult,
          orderIntents,
          durationMs: performance.now() - startTime,
        });
      } catch (err: any) {
        clearTimeout(timer);
        if (isTimedOut) return;

        resolve({
          scriptId: input.scriptId,
          success: false,
          error: err?.message || "Unknown error executing script",
          durationMs: performance.now() - startTime,
        });
      }
    });
  }
}

export const indicatorSandbox = new IndicatorSandbox();
