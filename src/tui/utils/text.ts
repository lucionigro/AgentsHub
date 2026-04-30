/**
 * Text formatting utilities for the TUI.
 */

/**
 * Truncate text from the middle with ellipsis.
 */
export function truncateMiddle(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) return text;
  if (maxWidth <= 8) return text.slice(0, maxWidth);
  const keepStart = Math.max(3, Math.floor((maxWidth - 3) * 0.35));
  const keepEnd = Math.max(3, maxWidth - keepStart - 3);
  return `${text.slice(0, keepStart)}...${text.slice(text.length - keepEnd)}`;
}

/**
 * Pad text to center within a given width.
 */
export function padCenter(text: string, width: number): string {
  const pad = Math.max(0, width - text.length);
  const left = Math.floor(pad / 2);
  const right = pad - left;
  return " ".repeat(left) + text + " ".repeat(right);
}

/**
 * Pad text to right-align within a given width.
 */
export function padRight(text: string, width: number): string {
  return text.padStart(width);
}

/**
 * Pad text to left-align within a given width.
 */
export function padLeft(text: string, width: number): string {
  return text.padEnd(width);
}

/**
 * Format relative time from ISO string.
 */
export function relativeTime(input?: string): string {
  if (!input) return "-";
  const timestamp = new Date(input).getTime();
  if (Number.isNaN(timestamp)) return "-";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Format current time as HH:MM:SS.
 */
export function formatTime(date: Date = new Date()): string {
  return date.toLocaleTimeString("en-US", { hour12: false });
}
