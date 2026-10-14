export interface IndicatorTemplate {
  id: string;
  name: string;
  description: string;
  indicators: string[];
  isBuiltIn: boolean;
  isBuiltin?: boolean;
  isStarred?: boolean;
  createdAt: number;
}

export const BUILTIN_TEMPLATES: IndicatorTemplate[] = [
  {
    id: "template-trend-momentum",
    name: "Trend Momentum Trio",
    description: "Classic institutional momentum stack: EMA 20/50 trend baseline paired with Zero-Lag MACD and RSI Divergence oscillator.",
    indicators: ["EMA 20/50", "Zero-Lag MACD Histogram", "RSI Divergence Engine Pro"],
    isBuiltIn: true,
    isBuiltin: true,
    isStarred: true,
    createdAt: 1700000000000,
  },
  {
    id: "template-volatility-squeeze",
    name: "Volatility Squeeze Breakout",
    description: "Bollinger Bands dynamic volatility compression combined with horizontal Volume Profile POC nodes and RSI reversal triggers.",
    indicators: [
      "Bollinger Bands (20, 2)",
      "Visible Range Volume Profile (VPVR)",
      "RSI Divergence Engine Pro",
    ],
    isBuiltIn: true,
    isBuiltin: true,
    isStarred: true,
    createdAt: 1700000001000,
  },
  {
    id: "template-institutional-quant",
    name: "Institutional Quant & Strategy Suite",
    description: "Multi-series quant suite rendering Strategy Equity & Drawdown underwater sub-pane, VPVR liquidity nodes, and EMA 20/50 trend guidance.",
    indicators: [
      "EMA 20/50",
      "Strategy Equity Curve & Underwater Drawdown",
      "Visible Range Volume Profile (VPVR)",
    ],
    isBuiltIn: true,
    isBuiltin: true,
    isStarred: false,
    createdAt: 1700000002000,
  },
  {
    id: "template-clean-pa",
    name: "Clean Price Action & Volume",
    description: "Minimalist institutional workspace stripping sub-pane clutter to focus on pure candlestick action with VPVR POC and EMA baseline.",
    indicators: ["Visible Range Volume Profile (VPVR)", "EMA 20/50"],
    isBuiltIn: true,
    isBuiltin: true,
    isStarred: false,
    createdAt: 1700000003000,
  },
];

const STORAGE_KEY = "mochex:indicator_templates";

/**
 * Retrieves all templates: combining built-in presets with user custom templates from localStorage.
 */
export function getStoredTemplates(): IndicatorTemplate[] {
  if (typeof window === "undefined") {
    return BUILTIN_TEMPLATES;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return BUILTIN_TEMPLATES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return BUILTIN_TEMPLATES;

    // Merge built-ins (preserving user starred states if any) with custom templates
    const custom = parsed.filter((t: IndicatorTemplate) => !t.isBuiltIn);
    const userBuiltinOverrides = new Map(
      parsed.filter((t: IndicatorTemplate) => t.isBuiltIn).map((t: IndicatorTemplate) => [t.id, t])
    );

    const mergedBuiltins = BUILTIN_TEMPLATES.map((b) => {
      const override = userBuiltinOverrides.get(b.id);
      return override ? { ...b, isStarred: override.isStarred } : b;
    });

    return [...mergedBuiltins, ...custom];
  } catch {
    return BUILTIN_TEMPLATES;
  }
}

/**
 * Saves a new custom indicator template to localStorage.
 */
export function saveCustomTemplate(
  name: string,
  description: string,
  indicators: string[]
): IndicatorTemplate {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Template name cannot be empty.");
  }
  if (!indicators || indicators.length === 0) {
    throw new Error("Template must contain at least one indicator.");
  }

  const newTemplate: IndicatorTemplate = {
    id: `template-custom-${Date.now()}`,
    name: trimmedName,
    description: description.trim() || `Custom stack with ${indicators.length} indicators`,
    indicators: [...indicators],
    isBuiltIn: false,
    isBuiltin: false,
    isStarred: false,
    createdAt: Date.now(),
  };

  if (typeof window !== "undefined") {
    const existing = getStoredTemplates();
    const updated = [...existing, newTemplate];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }

  return newTemplate;
}

/**
 * Deletes a custom template from localStorage. Built-in templates cannot be deleted.
 */
export function deleteCustomTemplate(id: string): IndicatorTemplate[] {
  if (typeof window === "undefined") return BUILTIN_TEMPLATES;

  const existing = getStoredTemplates();
  const target = existing.find((t) => t.id === id);
  if (target?.isBuiltIn) {
    return existing; // Cannot delete built-ins
  }

  const filtered = existing.filter((t) => t.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {}
  return filtered;
}

/**
 * Toggles the starred status of any template (built-in or custom).
 */
export function toggleStarTemplate(id: string): IndicatorTemplate[] {
  if (typeof window === "undefined") return BUILTIN_TEMPLATES;

  const existing = getStoredTemplates();
  const updated = existing.map((t) =>
    t.id === id ? { ...t, isStarred: !t.isStarred } : t
  );

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
}
