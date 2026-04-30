import type { Widgets } from "neo-blessed";
import blessed from "neo-blessed";
import path from "node:path";
import { palette } from "../theme/palette.js";
import { hex } from "../theme/styles.js";
import type { DashboardState, InteractiveState } from "../state.js";
import { truncateMiddle, relativeTime } from "../utils/text.js";
import {
  boxedLines,
  emptyState,
  fitText,
  statusBadge,
  tableLines,
} from "../visual.js";

export function createBaseMemoryPanel(screen: Widgets.Screen): Widgets.BoxElement {
  return blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: "100%",
    height: 10,
    border: { type: "line" },
    label: " BASE MEMORY ",
    tags: true,
    scrollable: true,
    alwaysScroll: false,
    style: {
      fg: palette.white,
      bg: palette.bgPanel,
      border: { fg: palette.cyanDim },
      label: { fg: palette.cyan },
    },
  });
}

export function renderBaseMemoryPanel(
  widget: Widgets.BoxElement,
  state: DashboardState,
  width: number,
  interactive: InteractiveState
): void {
  const bodyWidth = Math.max(38, width - 4);
  if (!state.initialized) {
    widget.setContent(emptyState("Base Memory", "Memory docs will appear after Settings creates the source tree.", bodyWidth).join("\n"));
    return;
  }

  const items = state.memoryFiles;
  if (items.length === 0) {
    widget.setContent(emptyState("Base Memory", "No memory files. Add .md files to your memory directory.", bodyWidth).join("\n"));
    return;
  }

  const innerWidth = Math.max(24, bodyWidth - 4);
  const ageWidth = 7;
  const docWidth = Math.min(26, Math.max(14, Math.floor(innerWidth * 0.28)));
  const pathWidth = Math.max(16, innerWidth - docWidth - ageWidth - 2);
  const visibleRows = Math.max(1, Math.min(items.length, Number(widget.height) - 15));
  const startIdx = interactive.scrollOffset;
  const endIdx = Math.min(items.length, startIdx + visibleRows);
  const visibleItems = items.slice(startIdx, endIdx);
  const activeIndex = interactive.mode === "focus" ? interactive.cursorIndex - startIdx : -1;
  const sourceTable = tableLines(
    [
      {
        title: "Memory Doc",
        width: docWidth,
        render: (item) => hex(fitText(item.title, docWidth), palette.white),
      },
      {
        title: "Source Path",
        width: pathWidth,
        render: (item) => hex(truncateMiddle(item.path, pathWidth), palette.whiteDim),
      },
      {
        title: "Age",
        width: ageWidth,
        render: (item) => hex(fitText(relativeTime(item.updatedAt), ageWidth), palette.gray),
        align: "right",
      },
    ],
    visibleItems,
    activeIndex,
    interactive.mode === "focus"
  );

  const lines: string[] = [];
  lines.push(...boxedLines("Base Memory", bodyWidth, [
    `${hex(`${items.length} memory documents loaded across all providers`, palette.gray)} ${statusBadge("SYNCED")}`,
    `${hex("Source", palette.gray)} ${hex(truncateMiddle(state.config?.source.memoryDir ?? "-", bodyWidth - 14), palette.whiteDim)}`,
    ...sourceTable,
    "",
    hex(items.length > visibleRows
      ? `${interactive.cursorIndex + 1}/${items.length}  ↑↓ navigate  Enter focus  Esc browse`
      : "↑↓ navigate  Enter focus  Esc browse", palette.gray),
  ]));

  lines.push("");
  lines.push(...generatedFilesCard(state, bodyWidth));

  widget.setContent(lines.join("\n"));
}

function generatedFilesCard(state: DashboardState, width: number): string[] {
  const innerWidth = Math.max(24, width - 4);
  const statusWidth = 10;
  const fileWidth = Math.min(16, Math.max(10, Math.floor(innerWidth * 0.18)));
  const providerWidth = Math.min(18, Math.max(12, Math.floor(innerWidth * 0.22)));
  const pathWidth = Math.max(12, innerWidth - providerWidth - fileWidth - statusWidth - 3);
  const targets = state.targets.slice(0, 8);
  const rows = tableLines(
    [
      {
        title: "Provider",
        width: providerWidth,
        render: (target) => hex(fitText(providerName(target.provider), providerWidth), palette.white),
      },
      {
        title: "File",
        width: fileWidth,
        render: (target) => hex(fitText(path.basename(target.path), fileWidth), palette.whiteDim),
      },
      {
        title: "Target Path",
        width: pathWidth,
        render: (target) => hex(truncateMiddle(target.path, pathWidth), palette.whiteDim),
      },
      {
        title: "Status",
        width: statusWidth,
        render: (target) => statusBadge(target.synced ? "SYNCED" : target.exists ? "DRIFT" : "PENDING"),
        align: "right",
      },
    ],
    targets
  );

  const content = [
    hex("Provider files are generated from the source memory docs above.", palette.gray),
    ...rows,
  ];
  if (state.targets.length > targets.length) {
    content.push(hex(`+ ${state.targets.length - targets.length} more generated files`, palette.gray));
  }
  return boxedLines("Generated Files", width, content);
}

function providerName(provider: string): string {
  switch (provider) {
    case "claude": return "Claude Code";
    case "codex": return "Codex";
    case "opencode": return "OpenCode";
    default: return provider;
  }
}

export function handleBaseMemoryKeys(
  key: string,
  state: DashboardState,
  interactive: InteractiveState
): { interactive: InteractiveState } | null {
  const items = state.memoryFiles;
  const headroom = 4;
  const visibleRows = Math.max(1, 10 - headroom);
  const maxCursor = Math.max(0, items.length - 1);

  if (interactive.mode === "focus") {
    if (key === "escape") {
      return { interactive: { ...interactive, mode: "browse" } };
    }
    if (key === "up" || key === "k") {
      const newCursor = Math.max(0, interactive.cursorIndex - 1);
      const newOffset = newCursor < interactive.scrollOffset ? newCursor : interactive.scrollOffset;
      return { interactive: { ...interactive, cursorIndex: newCursor, scrollOffset: newOffset } };
    }
    if (key === "down" || key === "j") {
      const newCursor = Math.min(maxCursor, interactive.cursorIndex + 1);
      const newOffset = newCursor >= interactive.scrollOffset + visibleRows ? newCursor - visibleRows + 1 : interactive.scrollOffset;
      return { interactive: { ...interactive, cursorIndex: newCursor, scrollOffset: newOffset } };
    }
    return null;
  }

  if (interactive.mode === "browse") {
    if (key === "up" || key === "k") {
      const newCursor = Math.max(0, interactive.cursorIndex - 1);
      const newOffset = newCursor < interactive.scrollOffset ? newCursor : interactive.scrollOffset;
      return { interactive: { ...interactive, cursorIndex: newCursor, scrollOffset: newOffset } };
    }
    if (key === "down" || key === "j") {
      const newCursor = Math.min(maxCursor, interactive.cursorIndex + 1);
      const newOffset = newCursor >= interactive.scrollOffset + visibleRows ? newCursor - visibleRows + 1 : interactive.scrollOffset;
      return { interactive: { ...interactive, cursorIndex: newCursor, scrollOffset: newOffset } };
    }
    if (key === "enter") {
      return { interactive: { ...interactive, mode: "focus" } };
    }
    return null;
  }

  return null;
}
