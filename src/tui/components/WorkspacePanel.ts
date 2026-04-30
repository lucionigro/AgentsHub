import type { Widgets } from "neo-blessed";
import blessed from "neo-blessed";
import path from "node:path";
import { palette } from "../theme/palette.js";
import { hex } from "../theme/styles.js";
import type { DashboardState, InteractiveState } from "../state.js";
import { truncateMiddle } from "../utils/text.js";
import {
  boxedLines,
  emptyState,
  fitText,
  keyValueLine,
  statusBadge,
  tableLines,
} from "../visual.js";

export function createWorkspacePanel(screen: Widgets.Screen): Widgets.BoxElement {
  return blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: "100%",
    height: 10,
    border: { type: "line" },
    label: " WORKSPACE ",
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

export function renderWorkspacePanel(
  widget: Widgets.BoxElement,
  state: DashboardState,
  width: number,
  interactive: InteractiveState
): void {
  const bodyWidth = Math.max(38, width - 4);
  if (!state.initialized) {
    widget.setContent(emptyState("Workspace", "Workspace info will appear after Settings creates the config.", bodyWidth).join("\n"));
    return;
  }

  const lines: string[] = [];
  const workspace = state.config?.workspaces[0];
  const source = state.config?.source;
  const writeMode = state.config?.targets[0]?.writeMode ?? "-";
  const status = state.readinessState === "ready" ? "READY" : state.readinessState === "drift" ? "DRIFT" : state.readinessState === "pending" ? "PENDING" : "ERROR";

  lines.push(...boxedLines("Workspace", bodyWidth, [
    keyValueLine("Workspace Path", truncateMiddle(workspace?.path ?? "-", bodyWidth - 22), bodyWidth - 4),
    keyValueLine("Source Path", truncateMiddle(source?.root ?? "-", bodyWidth - 22), bodyWidth - 4),
    keyValueLine("Strategy", strategyLabel(workspace?.mode), bodyWidth - 4),
    keyValueLine("Write Mode", writeMode, bodyWidth - 4),
    keyValueLine("Includes", includesLabel(state), bodyWidth - 4),
    `${hex("Status".padEnd(18), palette.gray)}  ${statusBadge(status)}`,
  ]));

  lines.push("");

  const workspaceTargets = state.targets.filter((target) => target.scope === "workspace");
  const displayTargets = state.targets;
  const visibleTargets = Math.max(1, Number(widget.height) - 13);
  const startIdx = interactive.scrollOffset;
  const endIdx = Math.min(displayTargets.length, startIdx + visibleTargets);
  const visibleTargetsRows = displayTargets.slice(startIdx, endIdx);
  const innerWidth = Math.max(24, bodyWidth - 4);
  const statusWidth = 10;
  const fileWidth = Math.min(16, Math.max(10, Math.floor(innerWidth * 0.18)));
  const providerWidth = Math.min(22, Math.max(12, Math.floor(innerWidth * 0.24)));
  const pathWidth = Math.max(12, innerWidth - fileWidth - providerWidth - statusWidth - 3);
  const outputRows = displayTargets.length === 0
    ? [hex("No generated outputs configured", palette.gray)]
    : tableLines(
      [
        {
          title: "File",
          width: fileWidth,
          render: (target) => hex(fitText(path.basename(target.path), fileWidth), palette.white),
        },
        {
          title: "Provider",
          width: providerWidth,
          render: (target) => hex(fitText(providerName(target.provider), providerWidth), palette.whiteDim),
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
      visibleTargetsRows,
      interactive.cursorIndex - startIdx,
      interactive.mode === "focus"
    );

  if (displayTargets.length > visibleTargets) {
    outputRows.push("");
    outputRows.push(hex(`${interactive.cursorIndex + 1}/${displayTargets.length}  ↑↓ scroll  Enter focus`, palette.gray));
  }

  lines.push(...boxedLines(workspaceTargets.length === displayTargets.length ? "Generated at Workspace Root" : "Generated Outputs", bodyWidth, outputRows));

  widget.setContent(lines.join("\n"));
}

function strategyLabel(mode?: string): string {
  switch (mode) {
    case "workspace-root": return "Workspace Root";
    case "per-project": return "Per Project";
    case "mixed": return "Mixed";
    default: return "-";
  }
}

function includesLabel(state: DashboardState): string {
  const labels = ["Memory", "Skills"];
  if ((state.mcp?.total ?? 0) > 0 || state.targets.some((target) => target.type === "mcp")) {
    labels.push("MCP");
  }
  return labels.join(" + ");
}

function providerName(provider: string): string {
  switch (provider) {
    case "claude": return "Claude Code";
    case "codex": return "Codex";
    case "opencode": return "OpenCode";
    default: return provider;
  }
}

export function handleWorkspaceKeys(
  key: string,
  state: DashboardState,
  interactive: InteractiveState
): { interactive: InteractiveState } | null {
  const items = state.targets;
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

  return null;
}
