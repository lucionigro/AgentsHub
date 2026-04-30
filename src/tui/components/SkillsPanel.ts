import type { Widgets } from "neo-blessed";
import blessed from "neo-blessed";
import { palette } from "../theme/palette.js";
import { hex } from "../theme/styles.js";
import { symbols } from "../theme/symbols.js";
import type { DashboardState, InteractiveState } from "../state.js";
import { truncateMiddle, relativeTime } from "../utils/text.js";
import {
  boxedLines,
  emptyState,
  fitText,
  hstack,
  statusBadge,
  tableLines,
} from "../visual.js";

export function createSkillsPanel(screen: Widgets.Screen): Widgets.BoxElement {
  return blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: "100%",
    height: 10,
    border: { type: "line" },
    label: " SKILLS ",
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

export function renderSkillsPanel(
  widget: Widgets.BoxElement,
  state: DashboardState,
  width: number,
  interactive: InteractiveState
): void {
  const bodyWidth = Math.max(38, width - 4);
  if (!state.initialized) {
    widget.setContent(emptyState("Skills", "Skills will appear after Settings creates the source tree.", bodyWidth).join("\n"));
    return;
  }

  const items = state.skillFiles;
  if (items.length === 0) {
    widget.setContent(emptyState("Skills", "No skills configured. Add .md files to your skills directory.", bodyWidth).join("\n"));
    return;
  }

  const wide = bodyWidth >= 118;
  const gap = 2;
  const listWidth = wide ? Math.floor((bodyWidth - gap) * 0.68) : bodyWidth;
  const helpWidth = wide ? bodyWidth - gap - listWidth : 0;
  const innerWidth = Math.max(24, listWidth - 4);
  const ageWidth = 7;
  const statusWidth = 8;
  const skillWidth = Math.min(24, Math.max(14, Math.floor(innerWidth * 0.28)));
  const pathWidth = Math.max(14, innerWidth - statusWidth - skillWidth - ageWidth - 3);
  const visibleRows = Math.max(1, Number(widget.height) - 10);

  const startIdx = interactive.scrollOffset;
  const endIdx = Math.min(items.length, startIdx + visibleRows);
  const visibleItems = items.slice(startIdx, endIdx);
  const activeIndex = interactive.mode === "focus" ? interactive.cursorIndex - startIdx : -1;
  const table = tableLines(
    [
      {
        title: "Status",
        width: statusWidth,
        render: (item) => item.importedFrom ? hex(symbols.bulletWarn, palette.magenta) : hex(symbols.bulletOn, palette.green),
        align: "center",
      },
      {
        title: "Skill",
        width: skillWidth,
        render: (item) => hex(fitText(item.title, skillWidth), palette.white),
      },
      {
        title: "Path",
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

  const listContent = [
    `${hex(`${items.length} skills shared across providers`, palette.gray)} ${statusBadge("SYNCED")}`,
    ...table,
    "",
    hex(items.length > visibleRows
      ? `${interactive.cursorIndex + 1}/${items.length}  ↑↓ navigate  Enter focus  Esc browse`
      : "↑↓ navigate  Enter focus  Esc browse", palette.gray),
  ];
  const listCard = boxedLines("Skills", listWidth, listContent);

  if (!wide) {
    widget.setContent(listCard.join("\n"));
    return;
  }

  const helpCard = boxedLines("What Are Skills?", helpWidth, [
    hex("Reusable capabilities included in generated agent files.", palette.whiteDim),
    "",
    `${hex("Source", palette.gray)} ${hex(truncateMiddle(state.config?.source.skillsDir ?? "-", helpWidth - 12), palette.white)}`,
    `${hex("Imported", palette.gray)} ${hex("magenta rows come from provider skill folders", palette.magenta)}`,
  ], { borderTone: "muted" });

  widget.setContent(hstack([listCard, helpCard], gap).join("\n"));
}

export function handleSkillsKeys(
  key: string,
  state: DashboardState,
  interactive: InteractiveState
): { interactive: InteractiveState } | null {
  const items = state.skillFiles;
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
