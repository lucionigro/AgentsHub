import type { Widgets } from "neo-blessed";
import blessed from "neo-blessed";
import { palette } from "../theme/palette.js";
import { hex, hexBg } from "../theme/styles.js";
import type { DashboardView } from "../state.js";
import { VIEW_LABELS } from "../state.js";
import { isCompact } from "../utils/layout.js";
import { fitText, visibleLength } from "../visual.js";

const TABS: { key: string; view: DashboardView }[] = [
  { key: "1", view: "dashboard" },
  { key: "2", view: "skills" },
  { key: "3", view: "memory" },
  { key: "4", view: "workspace" },
  { key: "5", view: "activity" },
  { key: "6", view: "settings" },
];

export function createBottomNav(screen: Widgets.Screen): Widgets.BoxElement {
  return blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: "100%",
    height: 3,
    tags: true,
    style: {
      fg: palette.white,
      bg: palette.bgHeader,
    },
  });
}

export function renderBottomNav(widget: Widgets.BoxElement, currentView: DashboardView, width: number): void {
  const compact = isCompact(width);

  const tabStrs = TABS.map((tab) => {
    const isActive = tab.view === currentView;
    const label = shortLabel(tab.view, compact);
    if (compact && width < 90) {
      return isActive
        ? hexBg(`[${tab.key}]`, palette.cyan, palette.bg)
        : `${hex("[", palette.gray)}${hex(tab.key, palette.cyan)}${hex("]", palette.gray)}`;
    }
    return isActive
      ? hexBg(` [${tab.key}] ${label} `, palette.cyan, palette.bg)
      : `${hex("[", palette.gray)}${hex(tab.key, palette.cyan)}${hex(`] ${label}`, palette.gray)}`;
  });

  const left = tabStrs.join("  ");

  const actions = compact
    ? `${key("P")} ${key("D")} ${key("R")} ${key("Q")}`
    : `${key("P")} Push  ${key("D")} Diff  ${key("R")} Reload  ${key("Q")} Quit`;

  const oneLine = `${left}  ${hex("|", palette.grayDark)}  ${actions}`;
  if (visibleLength(oneLine) <= width - 2) {
    widget.setContent(oneLine);
    return;
  }

  widget.setContent(`${fitTaggedLine(left, width - 2)}\n${actions}`);
}

function key(value: string): string {
  return `${hex("[", palette.gray)}${hex(value, palette.cyan)}${hex("]", palette.gray)}`;
}

function shortLabel(view: DashboardView, compact: boolean): string {
  if (!compact) return VIEW_LABELS[view];
  switch (view) {
    case "dashboard": return "Main";
    case "memory": return "Memory";
    case "activity": return "Activity";
    default: return VIEW_LABELS[view];
  }
}

function fitTaggedLine(text: string, width: number): string {
  if (visibleLength(text) <= width) return text;
  return hex(fitText(text.replace(/\{[^}]*\}/g, ""), width), palette.gray);
}
