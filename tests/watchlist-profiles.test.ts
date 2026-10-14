import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import {
  DEFAULT_WATCHLIST_PROFILES,
  loadWatchlistProfiles,
  saveWatchlistProfiles,
  loadActiveProfileId,
  saveActiveProfileId,
  createWatchlistProfile,
  renameWatchlistProfile,
  deleteWatchlistProfile,
  addSymbolToProfile,
  removeSymbolFromProfile,
  WatchlistProfile,
} from "@/lib/watchlist/watchlist-profiles";

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

describe("Watchlist Token Groups & Profiles Engine (DEC-091)", () => {
  beforeAll(() => {
    (globalThis as any).window = globalThis;
    (globalThis as any).localStorage = new MockLocalStorage();
  });

  beforeEach(() => {
    (globalThis as any).localStorage.clear();
  });

  it("should return default institutional presets when storage is empty", () => {
    const profiles = loadWatchlistProfiles();
    expect(profiles.length).toBe(4);
    expect(profiles[0].name).toBe("Core Majors");
    expect(profiles[0].symbols).toContain("BTCUSDT");
    expect(profiles[1].name).toBe("Layer 1s");
    expect(profiles[2].name).toBe("Meme Coins");
    expect(profiles[3].name).toBe("AI & Big Data");
  });

  it("should create a new custom token profile and make it active", () => {
    let profiles = loadWatchlistProfiles();
    const { profiles: updated, newProfile } = createWatchlistProfile(
      profiles,
      "DeFi Gems",
      ["UNIUSDT", "AAVEUSDT"]
    );

    expect(updated.length).toBe(5);
    expect(newProfile.name).toBe("DeFi Gems");
    expect(newProfile.symbols).toEqual(["UNIUSDT", "AAVEUSDT"]);

    const activeId = loadActiveProfileId(updated);
    expect(activeId).toBe(newProfile.id);
  });

  it("should rename an existing profile", () => {
    let profiles = loadWatchlistProfiles();
    const renamed = renameWatchlistProfile(profiles, "meme-coins", "Doge & Friends");
    const target = renamed.find((p) => p.id === "meme-coins");
    expect(target?.name).toBe("Doge & Friends");
  });

  it("should add and remove symbols from a specific profile without touching others", () => {
    let profiles = loadWatchlistProfiles();
    const updated = addSymbolToProfile(profiles, "layer-1s", "SEIUSDT");
    const l1 = updated.find((p) => p.id === "layer-1s");
    expect(l1?.symbols).toContain("SEIUSDT");

    // Other profiles should not have SEIUSDT
    const memes = updated.find((p) => p.id === "meme-coins");
    expect(memes?.symbols).not.toContain("SEIUSDT");

    const removed = removeSymbolFromProfile(updated, "layer-1s", "SEIUSDT");
    const l1After = removed.find((p) => p.id === "layer-1s");
    expect(l1After?.symbols).not.toContain("SEIUSDT");
  });

  it("should delete a profile and fallback activeId to remaining profile", () => {
    let profiles = loadWatchlistProfiles();
    const { profiles: afterDelete, activeId } = deleteWatchlistProfile(profiles, "meme-coins");
    expect(afterDelete.length).toBe(3);
    expect(afterDelete.some((p) => p.id === "meme-coins")).toBe(false);
    expect(activeId).toBe(afterDelete[0].id);
  });

  it("should not delete the last remaining profile", () => {
    const singleProfile: WatchlistProfile[] = [
      { id: "sole", name: "Solo List", symbols: ["BTCUSDT"] },
    ];
    const { profiles } = deleteWatchlistProfile(singleProfile, "sole");
    expect(profiles.length).toBe(1);
    expect(profiles[0].id).toBe("sole");
  });
});
