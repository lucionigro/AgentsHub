/**
 * Cyberpunk terminal color palette for AgentHub TUI.
 * All colors are hex values compatible with neo-blessed.
 */
export const palette = {
  // Backgrounds
  bg: "#0a0f14",
  bgPanel: "#0d1117",
  bgHeader: "#080c10",

  // Primary cyan
  cyan: "#22d3ee",
  cyanDim: "#0891b2",
  cyanGlow: "#67e8f9",

  // Success green
  green: "#4ade80",
  greenDim: "#22c55e",

  // Warning yellow
  yellow: "#facc15",
  yellowDim: "#eab308",

  // Magenta / secondary accent
  magenta: "#e879f9",
  magentaDim: "#c026d3",

  // Error red
  red: "#f87171",
  redDim: "#dc2626",

  // Grays
  gray: "#64748b",
  grayDark: "#334155",
  grayDarker: "#1e293b",

  // Text
  white: "#e2e8f0",
  whiteDim: "#94a3b8",
} as const;

export type PaletteKey = keyof typeof palette;
