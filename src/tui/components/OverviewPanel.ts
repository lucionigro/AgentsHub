import type { Widgets } from "neo-blessed";
import blessed from "neo-blessed";
import path from "node:path";
import { palette } from "../theme/palette.js";
import { hex } from "../theme/styles.js";
import { symbols } from "../theme/symbols.js";
import type { DashboardState, ReadinessState } from "../state.js";
import type { ProviderId } from "../../config/schema.js";
import { truncateMiddle } from "../utils/text.js";
import {
  boxedLines,
  eventDisplayLabel,
  fitText,
  hstack,
  keyValueLine,
  padEndTagged,
  statusBadge,
  tableLines,
  toneForStatus,
  wrapBlocks,
} from "../visual.js";

function readinessLabel(state: ReadinessState): string {
  switch (state) {
    case "ready": return "READY";
    case "pending": return "PENDING";
    case "drift": return "DRIFT";
    case "attention": return "ERROR";
  }
}

export function createOverviewPanel(screen: Widgets.Screen): Widgets.BoxElement {
  return blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: "100%",
    height: 10,
    border: { type: "line" },
    label: " MAIN DASHBOARD ",
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

export function renderOverviewPanel(widget: Widgets.BoxElement, state: DashboardState, width: number): void {
  const bodyWidth = Math.max(38, width - 4);

  if (!state.initialized) {
    const status = boxedLines("Status", bodyWidth, [
      `${hex("AgentHub", palette.cyan)}  ${statusBadge("PENDING", "warn")}`,
      keyValueLine("Config Path", truncateMiddle(state.configPath, bodyWidth - 18), bodyWidth - 4),
      keyValueLine("Next Step", "Open Settings to create config", bodyWidth - 4),
    ]);
    const setup = boxedLines("Settings", bodyWidth, [
      `${hex("6", palette.cyan)}  ${hex("Settings", palette.white)}  ${hex(symbols.arrow, palette.gray)}  ${hex("configure workspace, providers, memory, skills, and MCP", palette.whiteDim)}`,
      `${hex("p", palette.cyan)}  ${hex("syncs targets after settings are saved", palette.gray)}`,
    ], { borderTone: "warn", titleTone: "warn" });
    widget.setContent([...status, "", ...setup].join("\n"));
    return;
  }

  const m = state.metrics;
  const readyLabel = readinessLabel(state.readinessState);
  const badgeStr = statusBadge(readyLabel, toneForStatus(readyLabel));
  const scoreColor = m.healthScore >= 80 ? palette.green : m.healthScore >= 50 ? palette.yellow : palette.red;
  const workspace = state.config?.workspaces[0]?.path ?? "-";
  const source = state.config?.source.root ?? "-";

  const lines: string[] = [];
  const status = boxedLines("System Status", bodyWidth, [
    `${statusIcon(state.readinessState)} ${badgeStr}  ${hex(`${m.healthScore}% synced`, scoreColor)}`,
    keyValueLine("Workspace", truncateMiddle(workspace, bodyWidth - 20), bodyWidth - 4),
    keyValueLine("Source", truncateMiddle(source, bodyWidth - 20), bodyWidth - 4),
    keyValueLine("Last Sync", state.lastSync ?? "-", bodyWidth - 4),
  ]);
  lines.push(...status, "");

  const compactWidth = bodyWidth >= 110
    ? Math.floor((bodyWidth - 4) / 3)
    : Math.max(36, bodyWidth);
  const operationalCards = [
    providersCard(state, compactWidth),
    baseMemoryCard(state, compactWidth),
    mcpCard(state, compactWidth),
  ];
  lines.push(...wrapBlocks(operationalCards, bodyWidth, 2), "");

  lines.push(...skillsSyncTable(state, bodyWidth), "");
  lines.push(...activityCard(state, bodyWidth));

  widget.setContent(lines.join("\n"));
}

function providersCard(state: DashboardState, width: number): string[] {
  const rowWidth = Math.max(12, width - 4);
  const content = state.providers.length === 0
    ? [hex("No providers configured", palette.gray)]
    : state.providers.slice(0, 3).map((provider) => {
      const status = provider.enabled && provider.detected ? "ACTIVE" : provider.enabled ? "PENDING" : "INACTIVE";
      const labelWidth = Math.max(10, rowWidth - 12);
      return `${hex(padEndTagged(fitText(provider.displayName, labelWidth), labelWidth), palette.white)} ${statusBadge(status)}`;
    });

  return boxedLines("Providers", width, content);
}

function baseMemoryCard(state: DashboardState, width: number): string[] {
  const rowWidth = Math.max(12, width - 4);
  const targets = state.targets.filter((target) => target.type === "instructions").slice(0, 3);
  const content = targets.length === 0
    ? [hex("No memory outputs configured", palette.gray)]
    : targets.map((target) => {
      const status = target.synced ? "SYNCED" : target.exists ? "DRIFT" : "PENDING";
      const fileWidth = Math.max(9, Math.floor(rowWidth * 0.28));
      const providerWidth = Math.max(10, rowWidth - fileWidth - 12);
      return `${hex(padEndTagged(fitText(path.basename(target.path), fileWidth), fileWidth), palette.white)} ${hex(padEndTagged(fitText(providerName(target.provider), providerWidth), providerWidth), palette.gray)} ${statusBadge(status)}`;
    });

  if (state.targets.filter((target) => target.type === "instructions").length > targets.length) {
    content.push(hex("+ more outputs in Workspace", palette.gray));
  }

  return boxedLines("Base Memory", width, content);
}

function mcpCard(state: DashboardState, width: number): string[] {
  const rowWidth = Math.max(12, width - 4);
  const servers = state.mcp?.servers ?? [];
  const content = servers.length === 0
    ? [hex("No MCP servers configured", palette.gray)]
    : servers.slice(0, 3).map((server) => {
      const status = server.enabled ? "ACTIVE" : "OFF";
      const labelWidth = Math.max(10, rowWidth - 12);
      return `${hex(padEndTagged(fitText(server.name, labelWidth), labelWidth), palette.white)} ${statusBadge(status, server.enabled ? "success" : "muted")}`;
    });

  return boxedLines("MCP", width, content);
}

function skillsSyncTable(state: DashboardState, width: number): string[] {
  const innerWidth = Math.max(24, width - 4);
  const statusWidth = 10;
  const providerWidth = innerWidth >= 96 ? 12 : 8;
  const skillWidth = Math.max(12, innerWidth - statusWidth - providerWidth * 3 - 4);
  const providerState = {
    claude: providerSyncState(state, "claude"),
    codex: providerSyncState(state, "codex"),
    opencode: providerSyncState(state, "opencode"),
  };
  const rows = state.skillFiles.slice(0, 6);
  const content = rows.length === 0
    ? [hex("No skills configured", palette.gray)]
    : tableLines(
      [
        {
          title: "Skill",
          width: skillWidth,
          render: (skill) => hex(fitText(skill.title, skillWidth), palette.white),
        },
        {
          title: innerWidth >= 96 ? "Claude Code" : "Claude",
          width: providerWidth,
          render: () => providerMark(providerState.claude),
          align: "center",
        },
        {
          title: "Codex",
          width: providerWidth,
          render: () => providerMark(providerState.codex),
          align: "center",
        },
        {
          title: innerWidth >= 96 ? "OpenCode" : "Open",
          width: providerWidth,
          render: () => providerMark(providerState.opencode),
          align: "center",
        },
        {
          title: "Status",
          width: statusWidth,
          render: () => statusBadge(skillStatusLabel(providerState)),
          align: "right",
        },
      ],
      rows
    );

  if (state.skillFiles.length > rows.length) {
    content.push(hex(`+ ${state.skillFiles.length - rows.length} more skills`, palette.gray));
  }

  return boxedLines("Skills Sync", width, content);
}

function activityCard(state: DashboardState, width: number): string[] {
  const events = state.events.slice(-3);
  const content = events.length === 0
    ? [hex("No activity yet", palette.gray)]
    : events.map((event) => {
      const display = eventDisplayLabel(event);
      return `${hex(event.time.slice(0, 5), palette.gray)} ${statusBadge(display.label, display.tone)} ${hex(fitText(event.message, Math.max(10, width - 22)), palette.white)}`;
    });

  if (state.primaryAction) {
    content.push(hex(state.primaryAction, palette.cyan));
  }

  return boxedLines("Recent Activity", width, content);
}

function providerName(provider: string): string {
  switch (provider) {
    case "claude": return "Claude Code";
    case "codex": return "Codex";
    case "opencode": return "OpenCode";
    default: return provider;
  }
}

function statusIcon(state: ReadinessState): string {
  if (state === "ready") return hex(symbols.check, palette.green);
  if (state === "attention") return hex(symbols.crossMark, palette.red);
  return hex(symbols.warning, palette.yellow);
}

type ProviderSyncState = "synced" | "pending" | "error" | "off";

function providerSyncState(state: DashboardState, provider: ProviderId): ProviderSyncState {
  const providerStatus = state.providers.find((entry) => entry.id === provider);
  if (!providerStatus?.enabled) return "off";
  if (!providerStatus.detected) return "pending";
  const targets = state.targets.filter((target) => target.provider === provider);
  if (targets.some((target) => target.exists && !target.synced)) return "error";
  if (targets.some((target) => !target.exists)) return "pending";
  return "synced";
}

function providerMark(state: ProviderSyncState): string {
  switch (state) {
    case "synced": return hex(symbols.check, palette.green);
    case "pending": return hex(symbols.warning, palette.yellow);
    case "error": return hex(symbols.crossMark, palette.red);
    case "off": return hex("-", palette.gray);
  }
}

function skillStatusLabel(states: Record<ProviderId, ProviderSyncState>): string {
  const values = Object.values(states);
  if (values.includes("error")) return "ERROR";
  if (values.includes("pending")) return "PENDING";
  return "SYNCED";
}
