/**
 * MOCHEX Multi-Chart Split-Screen Workspace & Synchronization Engine (DEC-075)
 * Supports 1x1, 2x1 (Vertical Split), 1x2 (Horizontal Split), and 2x2 (Quad Grid)
 * with independent Symbol, Interval, and Crosshair synchronization toggles.
 */

export type GridLayoutMode = "1x1" | "2x1" | "1x2" | "2x2";

export interface ChartPaneConfig {
  id: string;
  symbol: string;
  resolution: string;
}

export interface GridSyncConfig {
  syncSymbol: boolean;
  syncInterval: boolean;
  syncCrosshair: boolean;
}

export interface MultiChartWorkspaceState {
  layoutMode: GridLayoutMode;
  activePaneId: string;
  maximizedPaneId: string | null;
  sync: GridSyncConfig;
  panes: ChartPaneConfig[];
}

export function createInitialMultiChartState(
  primarySymbol = "BTCUSDT",
  primaryResolution = "15"
): MultiChartWorkspaceState {
  return {
    layoutMode: "1x1",
    activePaneId: "pane-0",
    maximizedPaneId: null,
    sync: {
      syncSymbol: false,
      syncInterval: false,
      syncCrosshair: true,
    },
    panes: [
      { id: "pane-0", symbol: primarySymbol, resolution: primaryResolution },
      { id: "pane-1", symbol: "ETHUSDT", resolution: "60" },
      { id: "pane-2", symbol: "SOLUSDT", resolution: "240" },
      { id: "pane-3", symbol: primarySymbol, resolution: "1D" },
    ],
  };
}

export function getPaneCountForMode(mode: GridLayoutMode): number {
  switch (mode) {
    case "1x1":
      return 1;
    case "2x1":
    case "1x2":
      return 2;
    case "2x2":
      return 4;
  }
}

export function getVisiblePanes(state: MultiChartWorkspaceState): ChartPaneConfig[] {
  const count = getPaneCountForMode(state.layoutMode);
  return state.panes.slice(0, count);
}

export function getActivePane(state: MultiChartWorkspaceState): ChartPaneConfig {
  return (
    state.panes.find((p) => p.id === state.activePaneId) ||
    state.panes[0] || { id: "pane-0", symbol: "BTCUSDT", resolution: "15" }
  );
}

export function setGridLayoutMode(
  state: MultiChartWorkspaceState,
  mode: GridLayoutMode
): MultiChartWorkspaceState {
  const count = getPaneCountForMode(mode);
  const visibleIds = new Set(state.panes.slice(0, count).map((p) => p.id));
  const nextActiveId = visibleIds.has(state.activePaneId) ? state.activePaneId : "pane-0";

  let nextPanes = [...state.panes];
  const activePane = getActivePane(state);

  if (state.sync.syncSymbol) {
    nextPanes = nextPanes.map((p) => ({ ...p, symbol: activePane.symbol }));
  }
  if (state.sync.syncInterval) {
    nextPanes = nextPanes.map((p) => ({ ...p, resolution: activePane.resolution }));
  }

  return {
    ...state,
    layoutMode: mode,
    activePaneId: nextActiveId,
    maximizedPaneId: null,
    panes: nextPanes,
  };
}

export function updateActivePaneSymbol(
  state: MultiChartWorkspaceState,
  newSymbol: string,
  targetPaneId?: string
): MultiChartWorkspaceState {
  const idToUpdate = targetPaneId || state.activePaneId;
  const nextPanes = state.panes.map((pane) => {
    if (state.sync.syncSymbol || pane.id === idToUpdate) {
      return { ...pane, symbol: newSymbol };
    }
    return pane;
  });

  return {
    ...state,
    panes: nextPanes,
  };
}

export function updateActivePaneResolution(
  state: MultiChartWorkspaceState,
  newResolution: string,
  targetPaneId?: string
): MultiChartWorkspaceState {
  const idToUpdate = targetPaneId || state.activePaneId;
  const nextPanes = state.panes.map((pane) => {
    if (state.sync.syncInterval || pane.id === idToUpdate) {
      return { ...pane, resolution: newResolution };
    }
    return pane;
  });

  return {
    ...state,
    panes: nextPanes,
  };
}

export function toggleGridSyncOption(
  state: MultiChartWorkspaceState,
  key: keyof GridSyncConfig
): MultiChartWorkspaceState {
  const nextVal = !state.sync[key];
  const nextSync: GridSyncConfig = {
    ...state.sync,
    [key]: nextVal,
  };

  const activePane = getActivePane(state);
  let nextPanes = [...state.panes];

  if (key === "syncSymbol" && nextVal) {
    nextPanes = nextPanes.map((p) => ({ ...p, symbol: activePane.symbol }));
  }
  if (key === "syncInterval" && nextVal) {
    nextPanes = nextPanes.map((p) => ({ ...p, resolution: activePane.resolution }));
  }

  return {
    ...state,
    sync: nextSync,
    panes: nextPanes,
  };
}

export function toggleMaximizePane(
  state: MultiChartWorkspaceState,
  paneId?: string
): MultiChartWorkspaceState {
  if (state.layoutMode === "1x1") {
    return { ...state, maximizedPaneId: null };
  }
  const target = paneId || state.activePaneId;
  return {
    ...state,
    activePaneId: target,
    maximizedPaneId: state.maximizedPaneId === target ? null : target,
  };
}
