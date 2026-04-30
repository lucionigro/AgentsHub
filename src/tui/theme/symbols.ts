/**
 * Unicode symbols and ASCII art for AgentHub TUI.
 */
export const symbols = {
  // Box drawing
  h: "─",
  v: "│",
  tl: "┌",
  tr: "┐",
  bl: "└",
  br: "┘",
  tj: "┬",
  bj: "┴",
  lj: "├",
  rj: "┤",
  cross: "┼",

  // Status indicators
  bulletOn: "●",
  bulletOff: "○",
  bulletWarn: "◎",
  check: "✓",
  crossMark: "✗",
  warning: "⚠",
  pending: "○",

  // Arrows / prompts
  arrow: "→",
  prompt: "▸",
  dot: "•",

  // Logo
  logo: "[AH]",
} as const;
