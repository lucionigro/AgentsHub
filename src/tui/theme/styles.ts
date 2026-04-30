import type { Widgets } from "neo-blessed";
import { palette } from "./palette.js";

type BoxStyle = NonNullable<Widgets.BoxOptions["style"]>;

/**
 * Create a standard blessed style object for panels.
 */
export function panelStyle(borderColor: string = palette.cyanDim): BoxStyle {
  return {
    fg: palette.white,
    bg: palette.bgPanel,
    border: {
      fg: borderColor,
      bg: palette.bg,
    },
    label: {
      fg: palette.cyan,
      bg: palette.bg,
    },
  };
}

/**
 * Style for the main screen background.
 */
export const screenStyle: BoxStyle = {
  fg: palette.white,
  bg: palette.bg,
};

/**
 * Style for header text elements.
 */
export const headerStyle: BoxStyle = {
  fg: palette.white,
  bg: palette.bgHeader,
  border: {
    fg: palette.grayDark,
    bg: palette.bg,
  },
};

/**
 * Style for bottom navigation bar.
 */
export const navStyle: BoxStyle = {
  fg: palette.whiteDim,
  bg: palette.bgHeader,
  border: {
    fg: palette.grayDark,
    bg: palette.bg,
  },
};

/**
 * Helper to wrap text in blessed color tags using hex colors.
 * Example: hex("hello", palette.cyan) -> "{#22d3ee-fg}hello{/#22d3ee-fg}"
 */
export function hex(text: string, color: string): string {
  return `{#${color.replace("#", "")}-fg}${text}{/#${color.replace("#", "")}-fg}`;
}

/**
 * Helper to wrap text in background color tags.
 */
export function hexBg(text: string, bgColor: string, fgColor?: string): string {
  const fg = fgColor ? `{#${fgColor.replace("#", "")}-fg}` : "";
  const fgClose = fgColor ? `{/#${fgColor.replace("#", "")}-fg}` : "";
  return `{#${bgColor.replace("#", "")}-bg}${fg}${text}${fgClose}{/#${bgColor.replace("#", "")}-bg}`;
}

/**
 * Create a status badge string like [READY] colored appropriately.
 */
export function badge(label: string, color: string): string {
  return hex(`[${label}]`, color);
}

/**
 * Create a label tag like [MEMORY] colored.
 */
export function labelTag(label: string, color: string): string {
  return hex(`[${label.toUpperCase()}]`, color);
}
