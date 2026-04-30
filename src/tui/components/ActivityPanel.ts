import type { Widgets } from "neo-blessed";
import blessed from "neo-blessed";
import { palette } from "../theme/palette.js";
import { hex } from "../theme/styles.js";
import type { DashboardEvent } from "../state.js";
import {
  boxedLines,
  emptyState,
  eventDisplayLabel,
  fitText,
  statusBadge,
  tableLines,
} from "../visual.js";

export function createActivityPanel(screen: Widgets.Screen): Widgets.BoxElement {
  return blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: "100%",
    height: 10,
    border: { type: "line" },
    label: " RECENT ACTIVITY ",
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

export function renderActivityPanel(widget: Widgets.BoxElement, events: DashboardEvent[], screenWidth = 120): void {
  const width = Math.max(38, screenWidth - 4);
  if (events.length === 0) {
    widget.setContent(emptyState("Recent Activity", "No events yet. Activity will appear here.", width).join("\n"));
    return;
  }

  const innerWidth = Math.max(24, width - 4);
  const timeWidth = 8;
  const levelWidth = 10;
  const messageWidth = Math.max(12, innerWidth - timeWidth - levelWidth - 2);
  const visibleRows = Math.max(1, Number(widget.height) - 7);
  const rows = events.slice(-visibleRows);
  const table = tableLines(
    [
      {
        title: "Time",
        width: timeWidth,
        render: (event) => hex(fitText(event.time, timeWidth), palette.gray),
      },
      {
        title: "Level",
        width: levelWidth,
        render: (event) => {
          const display = eventDisplayLabel(event);
          return statusBadge(display.label, display.tone);
        },
      },
      {
        title: "Message",
        width: messageWidth,
        render: (event) => hex(fitText(event.message, messageWidth), palette.white),
      },
    ],
    rows
  );

  widget.setContent(boxedLines("Recent Activity", width, table).join("\n"));
}
