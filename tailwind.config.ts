import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Stitch Surface System
        background: "#0a141f",
        surface: "#0a141f",
        "surface-container-lowest": "#050f19",
        "surface-container-low": "#131c27",
        "surface-container": "#17202b",
        "surface-container-high": "#212b36",
        "surface-container-highest": "#2c3641",
        "surface-bright": "#303a46",
        "surface-variant": "#2c3641",
        "surface-card": "#181f2c",
        "surface-hover": "#222b3d",

        // Typography & Outlines
        "on-surface": "#d9e3f3",
        "on-surface-variant": "#c3c5d8",
        outline: "#8d90a2",
        "outline-variant": "#434656",
        border: "#1f2536",
        foreground: "#d9e3f3",
        muted: "#848e9c",

        // Stitch Market Green (Secondary)
        secondary: "#00c087",
        "secondary-light": "#44dfa3",
        "secondary-container": "#00c087",
        "on-secondary": "#003825",
        bull: "#00c087",

        // Stitch Market Red (Tertiary / Error)
        tertiary: "#ff3b30",
        "tertiary-container": "#dd1f1b",
        "on-tertiary": "#690003",
        bear: "#ff3b30",
        error: "#ffb4ab",

        // Stitch Quant Accents (Primary / Gold / Cyan)
        primary: "#b6c4ff",
        "primary-container": "#2962ff",
        "on-primary": "#002780",
        "on-primary-container": "#f7f5ff",
        accent: "#2962ff",
        "accent-hover": "#1e50db",
        gold: "#f5ac37",
        cyan: "#00d8ff",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "Consolas", "Courier New", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
