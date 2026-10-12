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
        background: "#0b0e14",
        surface: "#121721",
        "surface-card": "#181f2c",
        "surface-hover": "#222b3d",
        border: "#20293a",
        foreground: "#e2e8f0",
        muted: "#8899a6",
        bull: "#00c076",
        bear: "#ff433d",
        accent: "#2962ff",
        "accent-hover": "#1e4bd8",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Consolas", "Courier New", "monospace"],
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
