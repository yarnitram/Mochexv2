import { describe, it, expect } from "vitest";
import {
  createInitialMultiChartState,
  getVisiblePanes,
  setGridLayoutMode,
  updateActivePaneSymbol,
  updateActivePaneResolution,
  toggleGridSyncOption,
  toggleMaximizePane,
} from "@/lib/chart/multi-chart-grid";

describe("Multi-Chart Split-Screen Workspace Engine (DEC-075)", () => {
  it("should initialize 4 default chart panes and start in 1x1 mode", () => {
    const state = createInitialMultiChartState("BTCUSDT", "15");
    expect(state.layoutMode).toBe("1x1");
    expect(state.activePaneId).toBe("pane-0");
    expect(state.panes.length).toBe(4);
    expect(getVisiblePanes(state).length).toBe(1);
    expect(state.sync.syncCrosshair).toBe(true);
  });

  it("should return 2 visible panes in 2x1 / 1x2 modes and 4 in 2x2 mode", () => {
    let state = createInitialMultiChartState("BTCUSDT", "15");
    state = setGridLayoutMode(state, "2x1");
    expect(getVisiblePanes(state).length).toBe(2);

    state = setGridLayoutMode(state, "1x2");
    expect(getVisiblePanes(state).length).toBe(2);

    state = setGridLayoutMode(state, "2x2");
    expect(getVisiblePanes(state).length).toBe(4);
  });

  it("should update only the active pane symbol when syncSymbol is false, and all panes when true", () => {
    let state = createInitialMultiChartState("BTCUSDT", "15");
    state = setGridLayoutMode(state, "2x2");
    state = { ...state, activePaneId: "pane-1" };

    // syncSymbol is false by default
    state = updateActivePaneSymbol(state, "XRPUSDT");
    expect(state.panes[0].symbol).toBe("BTCUSDT");
    expect(state.panes[1].symbol).toBe("XRPUSDT");

    // Enable syncSymbol -> all panes align to activePane (pane-1: XRPUSDT)
    state = toggleGridSyncOption(state, "syncSymbol");
    expect(state.sync.syncSymbol).toBe(true);
    expect(state.panes.every((p) => p.symbol === "XRPUSDT")).toBe(true);

    // Updating symbol while syncSymbol is true updates all panes
    state = updateActivePaneSymbol(state, "DOGEUSDT");
    expect(state.panes.every((p) => p.symbol === "DOGEUSDT")).toBe(true);
  });

  it("should update only the active pane resolution when syncInterval is false, and all panes when true", () => {
    let state = createInitialMultiChartState("BTCUSDT", "15");
    state = setGridLayoutMode(state, "2x1");
    state = { ...state, activePaneId: "pane-1" };

    state = updateActivePaneResolution(state, "240");
    expect(state.panes[0].resolution).toBe("15");
    expect(state.panes[1].resolution).toBe("240");

    state = toggleGridSyncOption(state, "syncInterval");
    expect(state.sync.syncInterval).toBe(true);
    expect(state.panes.every((p) => p.resolution === "240")).toBe(true);
  });

  it("should toggle single-pane maximize and restore in multi-pane layouts", () => {
    let state = createInitialMultiChartState("BTCUSDT", "15");
    state = setGridLayoutMode(state, "2x2");

    state = toggleMaximizePane(state, "pane-2");
    expect(state.maximizedPaneId).toBe("pane-2");
    expect(state.activePaneId).toBe("pane-2");

    // Toggle again restores grid
    state = toggleMaximizePane(state, "pane-2");
    expect(state.maximizedPaneId).toBeNull();
  });
});
