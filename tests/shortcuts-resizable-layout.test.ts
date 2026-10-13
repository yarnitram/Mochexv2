import { describe, it, expect } from "vitest";
import { matchChartShortcut, ShortcutKeyInput } from "@/lib/ui/keyboard-shortcuts";
import {
  clampSidebarWidth,
  computeSidebarWidthFromDrag,
  computeSplitFraction,
  buildGridTemplate,
  parseSplitSizes,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
} from "@/lib/ui/resizable-layout";

const key = (overrides: Partial<ShortcutKeyInput>): ShortcutKeyInput => ({
  code: "",
  key: "",
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...overrides,
});

describe("Keyboard shortcut registry (DEC-077)", () => {
  it("maps Alt+letter physical codes to chart actions", () => {
    expect(matchChartShortcut(key({ code: "KeyR", key: "®", altKey: true }))).toBe("reset_view");
    expect(matchChartShortcut(key({ code: "KeyH", altKey: true }))).toBe("horizontal_line");
    expect(matchChartShortcut(key({ code: "KeyT", altKey: true }))).toBe("trendline");
    expect(matchChartShortcut(key({ code: "KeyF", altKey: true }))).toBe("fibonacci");
    expect(matchChartShortcut(key({ code: "KeyA", altKey: true }))).toBe("create_alert");
    expect(matchChartShortcut(key({ code: "KeyI", altKey: true }))).toBe("invert_scale");
    expect(matchChartShortcut(key({ key: "?", shiftKey: true }))).toBe("show_cheatsheet");
  });

  it("ignores non-shortcut and modifier-conflicting combos", () => {
    expect(matchChartShortcut(key({ code: "KeyR" }))).toBeNull();
    expect(matchChartShortcut(key({ code: "KeyR", altKey: true, ctrlKey: true }))).toBeNull();
    expect(matchChartShortcut(key({ code: "Enter", altKey: true }))).toBeNull();
  });
});

describe("Resizable layout math (DEC-077)", () => {
  it("clamps sidebar width and widens when dragging left", () => {
    expect(clampSidebarWidth(100)).toBe(SIDEBAR_MIN_WIDTH);
    expect(clampSidebarWidth(9999)).toBe(SIDEBAR_MAX_WIDTH);
    expect(computeSidebarWidthFromDrag(320, 1000, 900)).toBe(420);
    expect(computeSidebarWidthFromDrag(320, 1000, 1100)).toBe(260);
  });

  it("computes clamped split fractions and grid templates", () => {
    expect(computeSplitFraction(300, 0, 1000)).toBeCloseTo(0.3);
    expect(computeSplitFraction(50, 0, 1000)).toBeCloseTo(0.15);
    expect(computeSplitFraction(990, 0, 1000)).toBeCloseTo(0.85);
    expect(buildGridTemplate("2x1", { col: 0.3, row: 0.5 }, false).columns).toBe("0.3fr 0.7fr");
    expect(buildGridTemplate("2x2", { col: 0.5, row: 0.5 }, true)).toEqual({ columns: "1fr", rows: "1fr" });
  });

  it("parses persisted split sizes safely", () => {
    const parsed = parseSplitSizes(JSON.stringify({ "2x1": { col: 0.99 } }));
    expect(parsed["2x1"].col).toBeCloseTo(0.85);
    expect(parsed["1x2"].row).toBe(0.5);
    expect(parseSplitSizes("not-json")["2x2"].col).toBe(0.5);
  });
});
