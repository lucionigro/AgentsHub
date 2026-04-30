/**
 * Terminal layout utilities for responsive TUI design.
 */

/** Width threshold for compact mode (single column). */
export const COMPACT_WIDTH = 120;

/** Width threshold for tiny mode (minimal UI). */
export const TINY_WIDTH = 80;

/** Height threshold for compact vertical layout. */
export const COMPACT_HEIGHT = 35;

/** Full layout target size. */
export const FULL_WIDTH = 160;
export const FULL_HEIGHT = 45;

/**
 * Check if terminal is in compact mode.
 */
export function isCompact(width: number): boolean {
  return width < COMPACT_WIDTH;
}

/**
 * Check if terminal is in tiny mode.
 */
export function isTiny(width: number): boolean {
  return width < TINY_WIDTH;
}

/**
 * Calculate column widths from ratios.
 * Ratios should sum to 1.0. Returns integer widths.
 */
export function calcColumnWidths(totalWidth: number, ratios: number[]): number[] {
  const available = Math.max(0, totalWidth - (ratios.length - 1)); // account for 1-char gaps
  const widths = ratios.map((r) => Math.floor(available * r));
  // Distribute remainder to last column
  const sum = widths.reduce((a, b) => a + b, 0);
  widths[widths.length - 1] += available - sum;
  return widths;
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
