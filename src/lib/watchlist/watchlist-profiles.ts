export interface WatchlistProfile {
  id: string;
  name: string;
  symbols: string[];
  isCustom?: boolean;
}

export const DEFAULT_WATCHLIST_PROFILES: WatchlistProfile[] = [
  {
    id: "core-majors",
    name: "Core Majors",
    symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "MXUSDT", "XRPUSDT", "DOGEUSDT", "BNBUSDT", "SUIUSDT"],
    isCustom: false,
  },
  {
    id: "layer-1s",
    name: "Layer 1s",
    symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "SUIUSDT", "AVAXUSDT", "NEARUSDT", "ADAUSDT", "DOTUSDT", "ATOMUSDT", "KASUSDT"],
    isCustom: false,
  },
  {
    id: "meme-coins",
    name: "Meme Coins",
    symbols: ["DOGEUSDT", "PEPEUSDT", "SHIBUSDT", "WIFUSDT", "FLOKIUSDT", "BONKUSDT", "BOMEUSDT", "MEWUSDT", "POPCATUSDT"],
    isCustom: false,
  },
  {
    id: "ai-big-data",
    name: "AI & Big Data",
    symbols: ["TAOUSDT", "FETUSDT", "NEARUSDT", "RENDERUSDT", "GRTUSDT", "INJUSDT", "THETAUSDT"],
    isCustom: false,
  },
];

const PROFILES_STORAGE_KEY = "mochex:watchlist_profiles";
const ACTIVE_PROFILE_STORAGE_KEY = "mochex:active_watchlist_profile_id";
const LEGACY_SYMBOLS_KEY = "mochex:watchlist_symbols";

/**
 * Loads watchlist profiles from localStorage, with fallback to legacy symbols and default presets.
 */
export function loadWatchlistProfiles(): WatchlistProfile[] {
  if (typeof window === "undefined") return DEFAULT_WATCHLIST_PROFILES;

  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((p) => ({
          id: p.id || `profile_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: p.name || "Untitled Profile",
          symbols: Array.isArray(p.symbols) ? p.symbols : [],
          isCustom: !!p.isCustom,
        }));
      }
    }

    // Check for legacy single-watchlist array
    const legacyRaw = localStorage.getItem(LEGACY_SYMBOLS_KEY);
    if (legacyRaw) {
      const legacySymbols = JSON.parse(legacyRaw);
      if (Array.isArray(legacySymbols) && legacySymbols.length > 0) {
        const cloned = DEFAULT_WATCHLIST_PROFILES.map((p, idx) =>
          idx === 0 ? { ...p, symbols: legacySymbols } : p
        );
        saveWatchlistProfiles(cloned);
        return cloned;
      }
    }
  } catch {}

  return DEFAULT_WATCHLIST_PROFILES;
}

/**
 * Persists watchlist profiles to localStorage.
 */
export function saveWatchlistProfiles(profiles: WatchlistProfile[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  } catch {}
}

/**
 * Resolves the active profile ID, defaulting to the first profile.
 */
export function loadActiveProfileId(profiles: WatchlistProfile[]): string {
  if (profiles.length === 0) return "core-majors";
  if (typeof window === "undefined") return profiles[0].id;

  try {
    const saved = localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
    if (saved && profiles.some((p) => p.id === saved)) {
      return saved;
    }
  } catch {}

  return profiles[0].id;
}

/**
 * Persists the active profile ID.
 */
export function saveActiveProfileId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, id);
  } catch {}
}

/**
 * Creates a new watchlist profile and appends it to the list.
 */
export function createWatchlistProfile(
  profiles: WatchlistProfile[],
  name: string,
  initialSymbols: string[] = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
): { profiles: WatchlistProfile[]; newProfile: WatchlistProfile } {
  const trimmed = name.trim();
  const safeName = trimmed.length > 0 ? trimmed : `Group ${profiles.length + 1}`;
  const newProfile: WatchlistProfile = {
    id: `profile_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: safeName,
    symbols: [...initialSymbols],
    isCustom: true,
  };

  const nextProfiles = [...profiles, newProfile];
  saveWatchlistProfiles(nextProfiles);
  saveActiveProfileId(newProfile.id);

  return { profiles: nextProfiles, newProfile };
}

/**
 * Renames an existing watchlist profile.
 */
export function renameWatchlistProfile(
  profiles: WatchlistProfile[],
  id: string,
  newName: string
): WatchlistProfile[] {
  const trimmed = newName.trim();
  if (!trimmed) return profiles;

  const nextProfiles = profiles.map((p) =>
    p.id === id ? { ...p, name: trimmed } : p
  );
  saveWatchlistProfiles(nextProfiles);
  return nextProfiles;
}

/**
 * Deletes a watchlist profile. Guarantees at least one profile remains.
 */
export function deleteWatchlistProfile(
  profiles: WatchlistProfile[],
  id: string
): { profiles: WatchlistProfile[]; activeId: string } {
  if (profiles.length <= 1) {
    return { profiles, activeId: profiles[0].id };
  }

  const nextProfiles = profiles.filter((p) => p.id !== id);
  const nextActiveId = nextProfiles[0].id;

  saveWatchlistProfiles(nextProfiles);
  saveActiveProfileId(nextActiveId);

  return { profiles: nextProfiles, activeId: nextActiveId };
}

/**
 * Adds a symbol to the specified profile.
 */
export function addSymbolToProfile(
  profiles: WatchlistProfile[],
  profileId: string,
  symbol: string
): WatchlistProfile[] {
  const cleanSym = symbol.trim().toUpperCase();
  const nextProfiles = profiles.map((p) => {
    if (p.id !== profileId) return p;
    if (p.symbols.includes(cleanSym)) return p;
    return { ...p, symbols: [...p.symbols, cleanSym] };
  });

  saveWatchlistProfiles(nextProfiles);
  return nextProfiles;
}

/**
 * Removes a symbol from the specified profile.
 */
export function removeSymbolFromProfile(
  profiles: WatchlistProfile[],
  profileId: string,
  symbol: string
): WatchlistProfile[] {
  const cleanSym = symbol.trim().toUpperCase();
  const nextProfiles = profiles.map((p) => {
    if (p.id !== profileId) return p;
    return { ...p, symbols: p.symbols.filter((s) => s !== cleanSym) };
  });

  saveWatchlistProfiles(nextProfiles);
  return nextProfiles;
}
