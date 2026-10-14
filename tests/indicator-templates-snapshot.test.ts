import { describe, it, expect, beforeEach, vi, beforeAll } from "vitest";
import {
  BUILTIN_TEMPLATES,
  getStoredTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  toggleStarTemplate,
} from "@/lib/indicators/templates";
import {
  captureChartSnapshot,
  downloadSnapshotFile,
  copySnapshotToClipboard,
} from "@/lib/chart/chart-snapshot";

class MockLocalStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

describe("Indicator Templates Engine (DEC-081)", () => {
  beforeAll(() => {
    (globalThis as any).window = globalThis;
    (globalThis as any).localStorage = new MockLocalStorage();
  });

  beforeEach(() => {
    (globalThis as any).localStorage.clear();
  });

  it("should provide 4 default institutional stacks", () => {
    expect(BUILTIN_TEMPLATES).toHaveLength(4);
    const names = BUILTIN_TEMPLATES.map((t) => t.name);
    expect(names).toContain("Trend Momentum Trio");
    expect(names).toContain("Volatility Squeeze Breakout");
    expect(names).toContain("Institutional Quant & Strategy Suite");
    expect(names).toContain("Clean Price Action & Volume");

    // All builtins should be flagged as isBuiltIn
    expect(BUILTIN_TEMPLATES.every((t) => t.isBuiltIn)).toBe(true);
  });

  it("should return built-in templates if no custom templates exist in localStorage", () => {
    const templates = getStoredTemplates();
    expect(templates).toHaveLength(4);
    expect(templates[0].id).toBe("template-trend-momentum");
  });

  it("should save a new custom indicator template", () => {
    const custom = saveCustomTemplate(
      "My Custom Scalping Stack",
      "Fast EMA + VPVR for 1m scalps",
      ["EMA Ribbon Momentum Multi-Timeframe", "Volume Profile & Dynamic Point of Control (POC)"]
    );

    expect(custom.id).toMatch(/^template-custom-\d+$/);
    expect(custom.name).toBe("My Custom Scalping Stack");
    expect(custom.indicators).toHaveLength(2);
    expect(custom.isBuiltIn).toBe(false);

    // Should now be retrievable from getStoredTemplates
    const stored = getStoredTemplates();
    expect(stored).toHaveLength(5);
    const found = stored.find((t) => t.id === custom.id);
    expect(found).toBeDefined();
    expect(found?.name).toBe("My Custom Scalping Stack");
  });

  it("should throw error if template name or indicators are empty", () => {
    expect(() => saveCustomTemplate("", "desc", ["EMA"])).toThrow(
      "Template name cannot be empty."
    );
    expect(() => saveCustomTemplate("Valid Name", "desc", [])).toThrow(
      "Template must contain at least one indicator."
    );
  });

  it("should toggle star status on a template", () => {
    const initial = getStoredTemplates();
    const targetId = initial[0].id;
    expect(initial[0].isStarred).toBe(true);

    const unstarredList = toggleStarTemplate(targetId);
    const targetAfterUnstar = unstarredList.find((t) => t.id === targetId);
    expect(targetAfterUnstar?.isStarred).toBe(false);

    const starredList = toggleStarTemplate(targetId);
    const targetAfterStar = starredList.find((t) => t.id === targetId);
    expect(targetAfterStar?.isStarred).toBe(true);
  });

  it("should delete a custom template but forbid deleting built-ins", () => {
    const custom = saveCustomTemplate("Delete Me", "temp", ["RSI Divergence Engine Pro"]);
    expect(getStoredTemplates()).toHaveLength(5);

    // Attempt deleting built-in (should NOT delete)
    const afterBuiltinDeleteAttempt = deleteCustomTemplate("template-trend-momentum");
    expect(afterBuiltinDeleteAttempt.some((t) => t.id === "template-trend-momentum")).toBe(true);

    // Delete custom template (should succeed)
    const afterCustomDelete = deleteCustomTemplate(custom.id);
    expect(afterCustomDelete.some((t) => t.id === custom.id)).toBe(false);
    expect(getStoredTemplates()).toHaveLength(4);
  });
});

describe("High-Res Chart Snapshot Suite (DEC-081)", () => {
  beforeAll(() => {
    (globalThis as any).window = globalThis;
    (globalThis as any).ClipboardItem = class MockClipboardItem {
      constructor(public data: Record<string, any>) {}
    };

    if (typeof globalThis.navigator === "undefined") {
      (globalThis as any).navigator = {};
    }
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: {
        write: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
      writable: true,
    });

    (globalThis as any).document = {
      createElement: (tag: string) => {
        if (tag === "canvas") {
          return {
            width: 0,
            height: 0,
            getContext: () => ({
              scale: vi.fn(),
              fillRect: vi.fn(),
              strokeRect: vi.fn(),
              beginPath: vi.fn(),
              moveTo: vi.fn(),
              lineTo: vi.fn(),
              stroke: vi.fn(),
              fillText: vi.fn(),
              measureText: vi.fn().mockReturnValue({ width: 100 }),
              drawImage: vi.fn(),
            }),
            toBlob: (cb: (b: Blob) => void) => {
              cb(new Blob(["mock-png"], { type: "image/png" }));
            },
            toDataURL: () => "data:image/png;base64,mockpngdata",
            getBoundingClientRect: () => ({
              width: 800,
              height: 600,
              top: 0,
              left: 0,
              right: 800,
              bottom: 600,
              x: 0,
              y: 0,
            }),
          };
        }
        return {
          href: "",
          download: "",
          click: vi.fn(),
        };
      },
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    };
  });

  it("should capture a high-res chart snapshot from a container with canvases", async () => {
    const mockContainer = {
      getBoundingClientRect: () => ({
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
      }),
      querySelectorAll: () => [
        {
          getBoundingClientRect: () => ({
            width: 800,
            height: 600,
            top: 0,
            left: 0,
            right: 800,
            bottom: 600,
            x: 0,
            y: 0,
          }),
        },
      ],
    } as unknown as HTMLElement;

    const snapshot = await captureChartSnapshot(mockContainer, {
      symbol: "BTCUSDT",
      resolution: "15",
      markPrice: 68420.5,
    });

    expect(snapshot.dataUrl).toContain("data:image/png");
    expect(snapshot.width).toBe(800);
    expect(snapshot.height).toBe(644); // 600 + 44 bannerHeight
    expect(snapshot.filename).toMatch(/^mochex-BTCUSDT-15-\d+\.png$/);
    expect(snapshot.blob).toBeInstanceOf(Blob);
  });

  it("should trigger downloadSnapshotFile correctly", () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");

    downloadSnapshotFile("data:image/png;base64,123", "test-snapshot.png");

    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
  });

  it("should handle copySnapshotToClipboard with navigator.clipboard", async () => {
    const blob = new Blob(["mock"], { type: "image/png" });
    const success = await copySnapshotToClipboard(blob);
    expect(success).toBe(true);
    expect(navigator.clipboard.write).toHaveBeenCalled();
  });
});
