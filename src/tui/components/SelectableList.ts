import type { Widgets } from "neo-blessed";
import blessed from "neo-blessed";
import { palette } from "../theme/palette.js";
import { hex, hexBg } from "../theme/styles.js";

export type SelectableItem = {
  label: string;
  value: string;
  detail?: string;
  meta?: string;
};

export type SelectableListOptions = {
  label?: string;
  borderColor?: string;
  top?: number | string;
  left?: number | string;
  width?: number | string;
  height?: number | string;
  scrollable?: boolean;
};

export function createSelectableList(
  screen: Widgets.Screen,
  options: SelectableListOptions = {}
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

export function renderSelectableList(
  items: SelectableItem[],
  cursorIndex: number,
  scrollOffset: number,
  visibleRows: number,
  noItemsText: string = "No items"
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

    let line = "";
    if (isActive) {
      line += hexBg(" ", palette.cyan) + " ";
      line += hexBg(`${item.label}`, palette.cyan, palette.bg);
      if (item.detail) {
        line += " " + hexBg(item.detail, palette.cyan, palette.bg);
      }
      if (item.meta) {
        line += "  " + hex(item.meta, palette.cyanDim);
      }
    } else {
      line += "  ";
      line += hex(item.label, palette.white);
      if (item.detail) {
        line += " " + hex(item.detail, palette.whiteDim);
      }
      if (item.meta) {
        line += "  " + hex(item.meta, palette.gray);
      }
    }
    lines.push(line);
  }

  return lines.join("\n");
}

export function handleSelectableListKeys(
  key: string,
  itemsCount: number,
  cursorIndex: number,
  scrollOffset: number,
  visibleRows: number
): { cursorIndex: number; scrollOffset: number; selected?: string } | null {
  if (itemsCount === 0) return null;

  let newCursor = cursorIndex;
  let newOffset = scrollOffset;

  if (key === "up" || key === "k") {
    newCursor = Math.max(0, cursorIndex - 1);
  } else if (key === "down" || key === "j") {
    newCursor = Math.min(itemsCount - 1, cursorIndex + 1);
  } else if (key === "enter") {
    return { cursorIndex, scrollOffset, selected: String(cursorIndex) };
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
