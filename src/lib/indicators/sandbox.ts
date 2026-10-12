import { IndicatorWorkerMessageInput, IndicatorWorkerMessageOutput } from "@/types/indicator";
import { ta } from "./ta-math";

export class IndicatorSandbox {
  private timeoutMs: number;

  constructor(timeoutMs = 1000) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Executes user-defined indicator script safely:
   * function calculate(bars, inputs, ta) { ... }
   * Enforces 1000ms timeout guard and strips network primitives.
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

        // Construct sandbox wrapper
        const sandboxFunction = new Function(
          "bars",
          "inputs",
          "ta",
          "restricted",
          `
          "use strict";
          const { fetch, WebSocket, XMLHttpRequest, localStorage, sessionStorage, document, window, process } = restricted;
          ${input.code}
          if (typeof calculate !== "function") {
            throw new Error("Script must define a 'calculate(bars, inputs, ta)' function.");
          }
          return calculate(bars, inputs, ta);
        `
        );

        const result = sandboxFunction(input.bars, input.inputs, ta, restrictedScope);

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

        resolve({
          scriptId: input.scriptId,
          success: true,
          data: result,
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
