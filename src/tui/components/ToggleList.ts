import type { Widgets } from "neo-blessed";
import blessed from "neo-blessed";
import { palette } from "../theme/palette.js";
import { hex, hexBg } from "../theme/styles.js";
import { symbols } from "../theme/symbols.js";

export type ToggleItem = {
  label: string;
  value: string;
  enabled: boolean;
  detail?: string;
};

export type ToggleListOptions = {
  label?: string;
  borderColor?: string;
  top?: number | string;
  left?: number | string;
  width?: number | string;
  height?: number | string;
  scrollable?: boolean;
};

export function createToggleList(
  screen: Widgets.Screen,
  options: ToggleListOptions = {}
): Widgets.BoxElement {
  return blessed.box({
    parent: screen,
    top: options.top ?? 0,
    left: options.left ?? 0,
    width: options.width ?? "100%",
    height: options.height ?? 10,
    label: options.label ?? "",
    border: { type: "line" },
    tags: true,
    scrollable: options.scrollable ?? true,
    alwaysScroll: false,
    style: {
      fg: palette.white,
      bg: palette.bgPanel,
      border: { fg: options.borderColor ?? palette.cyanDim },
      label: { fg: palette.cyan },
    },
  });
}

export function renderToggleList(
  items: ToggleItem[],
  cursorIndex: number,
  scrollOffset: number,
  visibleRows: number,
  noItemsText: string = "No items to configure"
): string {
  if (items.length === 0) {
    return `\n  ${hex(noItemsText, palette.gray)}`;
  }

  const lines: string[] = [];
  const maxIndex = Math.min(visibleRows, items.length);

  for (let i = 0; i < maxIndex; i++) {
    const itemIndex = i + scrollOffset;
    if (itemIndex >= items.length) break;
    const item = items[itemIndex];
    const isActive = itemIndex === cursorIndex;

    const toggle = item.enabled
      ? hex(` ${symbols.check} ON `, palette.green)
      : hex(` ${symbols.crossMark} OFF`, palette.gray);

    let line = "";
    if (isActive) {
      line += hexBg(` ${toggle} `, palette.cyan, palette.bg);
      line += " " + hexBg(item.label, palette.cyan, palette.bg);
      if (item.detail) {
        line += "  " + hex(item.detail, palette.cyanDim);
      }
    } else {
      line += ` ${toggle} `;
      line += " " + hex(item.label, palette.white);
      if (item.detail) {
        line += "  " + hex(item.detail, palette.gray);
      }
    }
    lines.push(line);
  }

  return lines.join("\n");
}

export function handleToggleListKeys(
  key: string,
  itemsCount: number,
  cursorIndex: number,
  scrollOffset: number,
  visibleRows: number
): { cursorIndex: number; scrollOffset: number; toggled?: string } | null {
  if (itemsCount === 0) return null;

  let newCursor = cursorIndex;
  let newOffset = scrollOffset;

  if (key === "up" || key === "k") {
    newCursor = Math.max(0, cursorIndex - 1);
  } else if (key === "down" || key === "j") {
    newCursor = Math.min(itemsCount - 1, cursorIndex + 1);
  } else if (key === "space") {
    return { cursorIndex, scrollOffset, toggled: String(cursorIndex) };
  } else {
    return null;
  }

  if (newCursor < newOffset) {
    newOffset = newCursor;
  } else if (newCursor >= newOffset + visibleRows) {
    newOffset = newCursor - visibleRows + 1;
  }

  return { cursorIndex: newCursor, scrollOffset: newOffset };
}
