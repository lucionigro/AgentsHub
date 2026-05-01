import type { Widgets } from "neo-blessed";
import blessed from "neo-blessed";
import fs from "fs-extra";
import path from "node:path";
import { defaultGlobalMemoryContent } from "../../config/defaults.js";
import { defaultWorkspaceRoot, resolvePath } from "../../config/paths.js";
import { defaultRootForConfigPath, saveSettingsConfig, settingsProviderIds } from "../../config/settings.js";
import type { ProviderId, WriteMode } from "../../config/schema.js";
import { pushConfig } from "../../core/sync.js";
import { palette } from "../theme/palette.js";
import { hex, hexBg } from "../theme/styles.js";
import { addDashboardEvent, type DashboardState, type InteractiveState, type SettingsDraft, type SettingsTextField } from "../state.js";
import { cursorLineAndColumn, editMultilineContent } from "./globalMemoryEditor.js";
import {
  boxedLines,
  fitText,
  hstack,
  keyValueLine,
  padEndTagged,
  statusBadge,
} from "../visual.js";

const MENU_ITEMS = [
  "Workspace",
  "Providers",
  "Write Mode",
  "Source Paths",
  "MCP Servers",
  "Global Memory",
  "Save & Sync",
] as const;

const PROVIDER_LABELS: Record<ProviderId, string> = {
  claude: "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
};

const WRITE_MODES: WriteMode[] = ["managed", "append-block"];
const GLOBAL_MEMORY_SECTION = 5;
const SAVE_SYNC_SECTION = 6;
const GLOBAL_MEMORY_FILE = "global.md";

type SettingsResult = {
  interactive: InteractiveState;
  state: DashboardState;
  reload?: boolean;
};

export function createSettingsPanel(screen: Widgets.Screen): Widgets.BoxElement {
  return blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: "100%",
    height: 10,
    border: { type: "line" },
    label: " SETTINGS ",
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

export function renderSettingsPanel(
  widget: Widgets.BoxElement,
  state: DashboardState,
  width: number,
  interactive: InteractiveState
): void {
  const bodyWidth = Math.max(38, width - 4);
  const draft = interactive.settingsDraft ?? createSettingsDraft(state);
  const lines: string[] = [];

  if (interactive.mode === "browse") {
    renderSettingsMenu(lines, state, bodyWidth, interactive, draft);
  } else {
    renderSettingsSection(lines, state, bodyWidth, interactive, draft);
  }

  widget.setContent(lines.join("\n"));
}

function renderSettingsMenu(
  lines: string[],
  state: DashboardState,
  width: number,
  interactive: InteractiveState,
  draft: SettingsDraft
): void {
  const wide = width >= 110;
  const gap = 2;
  const menuWidth = wide ? Math.floor((width - gap) * 0.52) : width;
  const summaryWidth = wide ? width - gap - menuWidth : width;
  const menuContent: string[] = [
    state.initialized
      ? hex("Select a section to configure.", palette.gray)
      : hex("First run: review each setup step, then Save & Sync to materialize provider files.", palette.yellow),
    "",
  ];

  for (let i = 0; i < MENU_ITEMS.length; i++) {
    const row = `${hex(`[${i + 1}]`, palette.cyan)} ${hex(fitText(MENU_ITEMS[i], menuWidth - 10), palette.white)}`;
    menuContent.push(activeRow(row, menuWidth, i === interactive.cursorIndex));
  }
  menuContent.push("");
  menuContent.push(hex("↑↓ navigate  Enter configure  P sync after saving", palette.gray));

  const menuCard = boxedLines("Settings", menuWidth, menuContent);
  const summaryCard = boxedLines("Configuration", summaryWidth, [
    keyValueLine("Status", state.initialized ? "Configured" : "First run", summaryWidth - 4),
    keyValueLine("Workspace", fitText(draft.workspaceRoot, summaryWidth - 20), summaryWidth - 4),
    keyValueLine("Source", fitText(draft.root, summaryWidth - 20), summaryWidth - 4),
    keyValueLine("Write Mode", draft.writeMode, summaryWidth - 4),
    keyValueLine("MCP Servers", `${state.mcp?.enabled ?? 1}/${state.mcp?.total ?? 3} active`, summaryWidth - 4),
    "",
    ...settingsProviderIds.map((provider) =>
      `${hex(padEndTagged(PROVIDER_LABELS[provider], 14), palette.white)} ${draft.providers[provider] ? statusBadge("ACTIVE") : statusBadge("INACTIVE", "muted")}`
    ),
  ], { borderTone: state.initialized ? "muted" : "warn" });

  lines.push(...(wide ? hstack([menuCard, summaryCard], gap) : [...menuCard, "", ...summaryCard]));
}

function renderSettingsSection(
  lines: string[],
  state: DashboardState,
  width: number,
  interactive: InteractiveState,
  draft: SettingsDraft
): void {
  const section = interactive.cursorIndex;
  const content: string[] = [];

  if (section === 0) {
    content.push(hex("Workspace changes update generated Claude/Codex target paths and filesystem MCP.", palette.gray), "");
    renderTextField(content, "Workspace Root", "workspaceRoot", draft, width, interactive, interactive.scrollOffset === 0);
    content.push("");
    content.push(activeRow(`${statusBadge("SAVE")} ${hex("Save workspace settings", palette.white)}`, width, interactive.scrollOffset === 1));
  } else if (section === 1) {
    content.push(hex("Space toggles provider output generation. Disabled providers are ignored by status metrics.", palette.gray), "");
    for (let i = 0; i < settingsProviderIds.length; i++) {
      const provider = settingsProviderIds[i];
      const row = `${draft.providers[provider] ? statusBadge("ACTIVE") : statusBadge("INACTIVE", "muted")} ${hex(PROVIDER_LABELS[provider], palette.white)}`;
      content.push(activeRow(row, width, interactive.scrollOffset === i));
    }
    content.push("");
    content.push(activeRow(`${statusBadge("SAVE")} ${hex("Save provider settings", palette.white)}`, width, interactive.scrollOffset === settingsProviderIds.length));
  } else if (section === 2) {
    content.push(hex("Write mode applies only to instruction targets; MCP/global config targets keep their own strategy.", palette.gray), "");
    for (let i = 0; i < WRITE_MODES.length; i++) {
      const mode = WRITE_MODES[i];
      const row = `${draft.writeMode === mode ? statusBadge("ACTIVE") : statusBadge("INACTIVE", "muted")} ${hex(mode, palette.white)}`;
      content.push(activeRow(row, width, interactive.scrollOffset === i));
    }
    content.push("");
    content.push(activeRow(`${statusBadge("SAVE")} ${hex("Save write mode", palette.white)}`, width, interactive.scrollOffset === WRITE_MODES.length));
  } else if (section === 3) {
    content.push(hex("Changing source root also defaults memory, skills, MCP, templates, and backups under that root.", palette.gray), "");
    renderTextField(content, "Source Root", "root", draft, width, interactive, interactive.scrollOffset === 0);
    renderTextField(content, "Memory Dir", "memoryDir", draft, width, interactive, interactive.scrollOffset === 1);
    renderTextField(content, "Skills Dir", "skillsDir", draft, width, interactive, interactive.scrollOffset === 2);
    renderTextField(content, "MCP File", "mcpFile", draft, width, interactive, interactive.scrollOffset === 3);
    content.push("");
    content.push(activeRow(`${statusBadge("SAVE")} ${hex("Save source paths", palette.white)}`, width, interactive.scrollOffset === 4));
  } else if (section === 4) {
    content.push(hex("Space toggles existing MCP servers. First-run save creates the default filesystem/github/postgres file.", palette.gray), "");
    const servers = state.mcp?.servers ?? [];
    if (servers.length === 0) {
      content.push(activeRow(`${statusBadge("READY")} ${hex("Create default MCP servers on save", palette.white)}`, width, interactive.scrollOffset === 0));
    }
    for (let i = 0; i < servers.length; i++) {
      const server = servers[i];
      const row = `${server.enabled ? statusBadge("ACTIVE") : statusBadge("INACTIVE", "muted")} ${hex(server.name, palette.white)} ${hex(server.transport, palette.gray)}`;
      content.push(activeRow(row, width, interactive.scrollOffset === i));
      if (server.command) {
        content.push(`  ${hex(fitText(server.command, width - 8), palette.whiteDim)}`);
      }
    }
    content.push("");
    content.push(activeRow(`${statusBadge("SAVE")} ${hex("Save MCP settings", palette.white)}`, width, interactive.scrollOffset === mcpSaveRow(state)));
  } else if (section === GLOBAL_MEMORY_SECTION) {
    renderGlobalMemorySection(content, width, interactive, draft);
  } else if (section === SAVE_SYNC_SECTION) {
    content.push(hex("Review the first-run setup and materialize provider outputs in one step.", palette.gray), "");
    content.push(keyValueLine("Workspace", fitText(draft.workspaceRoot, width - 20), width - 4));
    content.push(keyValueLine("Source", fitText(draft.root, width - 20), width - 4));
    content.push(keyValueLine("Write Mode", draft.writeMode, width - 4));
    content.push(keyValueLine("Providers", enabledProvidersLabel(draft), width - 4));
    content.push("");
    content.push(activeRow(`${statusBadge("SYNC")} ${hex("Save settings and sync outputs", palette.white)}`, width, interactive.scrollOffset === 0));
  }

  content.push("");
  content.push(hex(section === GLOBAL_MEMORY_SECTION && interactive.mode === "edit"
    ? "Enter newline  F2/Ctrl+S save  Esc cancel"
    : "↑↓ navigate  Enter edit/save  Space toggle/select  Esc back", palette.gray));
  lines.push(...boxedLines(MENU_ITEMS[section] ?? "Settings", width, content));
}

function renderGlobalMemorySection(
  content: string[],
  width: number,
  interactive: InteractiveState,
  draft: SettingsDraft
): void {
  const filePath = globalMemoryPath(draft);
  content.push(hex("Edit the Markdown memory rendered into every provider instruction target.", palette.gray), "");
  content.push(keyValueLine("File", fitText(filePath, width - 20), width - 4));

  if (interactive.mode === "edit" && draft.editingField === "globalMemory") {
    content.push("");
    content.push(...renderGlobalMemoryEditor(interactive.inputBuffer, interactive.scrollOffset, width));
    return;
  }

  const preview = draft.globalMemoryContent?.split("\n").slice(0, 6) ?? [];
  if (preview.length > 0) {
    content.push("", hex("Preview", palette.gray));
    for (const line of preview) {
      content.push(hex(fitText(line || " ", width - 8), palette.whiteDim));
    }
  } else {
    content.push("", hex("Enter opens the current global.md content, or the starter template on first run.", palette.whiteDim));
  }

  content.push("");
  content.push(activeRow(`${statusBadge("EDIT")} ${hex("Edit global memory", palette.white)}`, width, interactive.scrollOffset === 0));
}

function renderGlobalMemoryEditor(content: string, cursor: number, width: number): string[] {
  const lines = content.split("\n");
  const { line: cursorLine, column } = cursorLineAndColumn(content, cursor);
  const visibleRows = 10;
  const start = Math.max(0, cursorLine - visibleRows + 1);
  const end = Math.min(lines.length, start + visibleRows);
  const lineNoWidth = Math.max(3, String(lines.length).length);
  const textWidth = Math.max(8, width - lineNoWidth - 8);
  const rendered: string[] = [];

  for (let i = start; i < end; i++) {
    const prefix = `${String(i + 1).padStart(lineNoWidth)} `;
    const line = i === cursorLine
      ? lineWithCursor(lines[i] ?? "", column, textWidth)
      : hex(fitText(lines[i] || " ", textWidth), palette.whiteDim);
    rendered.push(`${hex(prefix, palette.gray)}${line}`);
  }

  if (lines.length > visibleRows) {
    rendered.push(hex(`${cursorLine + 1}/${lines.length} lines`, palette.gray));
  }

  return rendered;
}

function lineWithCursor(line: string, column: number, width: number): string {
  const safeColumn = Math.max(0, Math.min(column, line.length));
  const windowStart = safeColumn >= width ? safeColumn - width + 1 : 0;
  const visible = line.slice(windowStart, windowStart + width);
  const localColumn = safeColumn - windowStart;
  const before = visible.slice(0, localColumn);
  const at = visible[localColumn] ?? " ";
  const after = visible.slice(localColumn + 1);
  return `${hex(before, palette.white)}${hexBg(at, palette.cyan, palette.bg)}${hex(after, palette.whiteDim)}`;
}

function renderTextField(
  content: string[],
  label: string,
  field: SettingsTextField,
  draft: SettingsDraft,
  width: number,
  interactive: InteractiveState,
  active: boolean
): void {
  const value = draft[field];
  const display = interactive.mode === "edit" && draft.editingField === field
    ? inputDisplay(interactive.inputBuffer, interactive.scrollOffset)
    : value;
  const row = keyValueLine(label, fitText(display, width - 22), width - 4);
  content.push(activeRow(row, width, active || draft.editingField === field));
}

function inputDisplay(value: string, cursor: number): string {
  const pos = Math.max(0, Math.min(value.length, cursor));
  return `${value.slice(0, pos)}_${value.slice(pos)}`;
}

function activeRow(row: string, width: number, active: boolean): string {
  if (!active) return row;
  return hexBg(` ${padEndTagged(row, width - 6)} `, palette.cyan, palette.bg);
}

export async function handleSettingsKeys(
  key: string,
  state: DashboardState,
  interactive: InteractiveState
): Promise<SettingsResult | null> {
  const draft = interactive.settingsDraft ?? createSettingsDraft(state);

  if (interactive.mode === "edit") {
    if (draft.editingField === "globalMemory") {
      return handleGlobalMemoryEdit(key, state, interactive, draft);
    }
    return handleTextEdit(key, state, interactive, draft);
  }

  if (interactive.mode === "focus") {
    return handleSettingsFocus(key, state, interactive, draft);
  }

  if (key === "up" || key === "k") {
    return { interactive: { ...interactive, cursorIndex: Math.max(0, interactive.cursorIndex - 1), settingsDraft: draft }, state };
  }
  if (key === "down" || key === "j") {
    return { interactive: { ...interactive, cursorIndex: Math.min(MENU_ITEMS.length - 1, interactive.cursorIndex + 1), settingsDraft: draft }, state };
  }
  if (key === "enter") {
    return { interactive: { ...interactive, mode: "focus", scrollOffset: 0, settingsDraft: draft }, state };
  }
  return null;
}

async function handleSettingsFocus(
  key: string,
  state: DashboardState,
  interactive: InteractiveState,
  draft: SettingsDraft
): Promise<SettingsResult | null> {
  const section = interactive.cursorIndex;
  const maxRow = maxSectionRow(section, state);

  if (key === "escape") {
    return { interactive: { ...interactive, mode: "browse", scrollOffset: 0, settingsDraft: draft }, state };
  }
  if (key === "up" || key === "k") {
    return { interactive: { ...interactive, scrollOffset: Math.max(0, interactive.scrollOffset - 1), settingsDraft: draft }, state };
  }
  if (key === "down" || key === "j") {
    return { interactive: { ...interactive, scrollOffset: Math.min(maxRow, interactive.scrollOffset + 1), settingsDraft: draft }, state };
  }

  if (section === 0 && interactive.scrollOffset === 0 && key === "enter") {
    return startTextEdit(state, interactive, draft, "workspaceRoot");
  }
  if (section === 0 && interactive.scrollOffset === 1 && key === "enter") {
    return saveDraft(state, interactive, draft);
  }

  if (section === 1) {
    if ((key === "space" || key === "enter") && interactive.scrollOffset < settingsProviderIds.length) {
      const provider = settingsProviderIds[interactive.scrollOffset];
      return {
        interactive: {
          ...interactive,
          settingsDraft: {
            ...draft,
            providers: { ...draft.providers, [provider]: !draft.providers[provider] },
          },
        },
        state,
      };
    }
    if (interactive.scrollOffset === settingsProviderIds.length && key === "enter") {
      return saveDraft(state, interactive, draft);
    }
  }

  if (section === 2) {
    if ((key === "space" || key === "enter") && interactive.scrollOffset < WRITE_MODES.length) {
      return {
        interactive: { ...interactive, settingsDraft: { ...draft, writeMode: WRITE_MODES[interactive.scrollOffset] } },
        state,
      };
    }
    if (interactive.scrollOffset === WRITE_MODES.length && key === "enter") {
      return saveDraft(state, interactive, draft);
    }
  }

  if (section === 3) {
    const fields: SettingsTextField[] = ["root", "memoryDir", "skillsDir", "mcpFile"];
    const field = fields[interactive.scrollOffset];
    if (field && key === "enter") {
      return startTextEdit(state, interactive, draft, field);
    }
    if (interactive.scrollOffset === fields.length && key === "enter") {
      return saveDraft(state, interactive, draft);
    }
  }

  if (section === 4) {
    const servers = state.mcp?.servers ?? [];
    if ((key === "space" || key === "enter") && interactive.scrollOffset < servers.length) {
      const server = servers[interactive.scrollOffset];
      return saveDraft(state, interactive, draft, { [server.name]: !server.enabled });
    }
    if (interactive.scrollOffset === mcpSaveRow(state) && key === "enter") {
      return saveDraft(state, interactive, draft);
    }
  }

  if (section === GLOBAL_MEMORY_SECTION && key === "enter") {
    return startGlobalMemoryEdit(state, interactive, draft);
  }

  if (section === SAVE_SYNC_SECTION && key === "enter") {
    return saveDraft(state, interactive, draft, undefined, true);
  }

  return null;
}

function handleTextEdit(
  key: string,
  state: DashboardState,
  interactive: InteractiveState,
  draft: SettingsDraft
): SettingsResult | null {
  const field = draft.editingField;
  if (!field || field === "globalMemory") {
    return { interactive: { ...interactive, mode: "focus", settingsDraft: draft }, state };
  }

  if (key === "escape") {
    return {
      interactive: {
        ...interactive,
        mode: "focus",
        inputBuffer: "",
        scrollOffset: rowForField(interactive.cursorIndex, field),
        settingsDraft: { ...draft, editingField: undefined },
      },
      state,
    };
  }
  if (key === "enter") {
    const nextDraft = { ...draft, [field]: interactive.inputBuffer || draft[field], editingField: undefined };
    return {
      interactive: {
        ...interactive,
        mode: "focus",
        inputBuffer: "",
        scrollOffset: rowForField(interactive.cursorIndex, field),
        settingsDraft: nextDraft,
      },
      state,
    };
  }
  if (key === "backspace") {
    const cursor = interactive.scrollOffset;
    if (cursor <= 0) return null;
    return {
      interactive: {
        ...interactive,
        inputBuffer: interactive.inputBuffer.slice(0, cursor - 1) + interactive.inputBuffer.slice(cursor),
        scrollOffset: cursor - 1,
        settingsDraft: draft,
      },
      state,
    };
  }
  if (key === "left") {
    return { interactive: { ...interactive, scrollOffset: Math.max(0, interactive.scrollOffset - 1), settingsDraft: draft }, state };
  }
  if (key === "right") {
    return { interactive: { ...interactive, scrollOffset: Math.min(interactive.inputBuffer.length, interactive.scrollOffset + 1), settingsDraft: draft }, state };
  }

  const char = key === "space" ? " " : isPrintableTextKey(key) ? key : "";
  if (char) {
    const cursor = interactive.scrollOffset;
    return {
      interactive: {
        ...interactive,
        inputBuffer: interactive.inputBuffer.slice(0, cursor) + char + interactive.inputBuffer.slice(cursor),
        scrollOffset: cursor + char.length,
        settingsDraft: draft,
      },
      state,
    };
  }

  return null;
}

async function startGlobalMemoryEdit(
  state: DashboardState,
  interactive: InteractiveState,
  draft: SettingsDraft
): Promise<SettingsResult> {
  const content = await loadGlobalMemoryContent(draft);
  return {
    interactive: {
      ...interactive,
      mode: "edit",
      inputBuffer: content,
      scrollOffset: content.length,
      settingsDraft: { ...draft, globalMemoryContent: content, editingField: "globalMemory" },
    },
    state,
  };
}

async function handleGlobalMemoryEdit(
  key: string,
  state: DashboardState,
  interactive: InteractiveState,
  draft: SettingsDraft
): Promise<SettingsResult | null> {
  if (key === "escape") {
    return {
      interactive: {
        ...interactive,
        mode: "focus",
        inputBuffer: "",
        scrollOffset: 0,
        settingsDraft: { ...draft, editingField: undefined },
      },
      state,
    };
  }

  if (key === "f2" || key === "C-s") {
    return saveGlobalMemoryDraft(state, interactive, draft);
  }

  const edit = editMultilineContent(interactive.inputBuffer, interactive.scrollOffset, key);
  return {
    interactive: {
      ...interactive,
      inputBuffer: edit.content,
      scrollOffset: edit.cursor,
      settingsDraft: { ...draft, globalMemoryContent: edit.content, editingField: "globalMemory" },
    },
    state,
  };
}

async function saveGlobalMemoryDraft(
  state: DashboardState,
  interactive: InteractiveState,
  draft: SettingsDraft
): Promise<SettingsResult> {
  try {
    const config = await saveSettingsConfig({
      config: state.config,
      configPath: state.configPath,
      root: draft.root,
      memoryDir: draft.memoryDir,
      skillsDir: draft.skillsDir,
      mcpFile: draft.mcpFile,
      workspaceRoot: draft.workspaceRoot,
      providerEnabled: draft.providers,
      instructionWriteMode: draft.writeMode,
    });
    const content = interactive.inputBuffer.endsWith("\n") ? interactive.inputBuffer : `${interactive.inputBuffer}\n`;
    await fs.outputFile(path.join(resolvePath(config.source.memoryDir), GLOBAL_MEMORY_FILE), content, "utf8");
    const savedState = addDashboardEvent(
      { ...state, config, initialized: true, status: "watching" },
      "Global Memory saved",
      "success"
    );

    return {
      interactive: {
        ...interactive,
        mode: "focus",
        inputBuffer: "",
        scrollOffset: 0,
        settingsDraft: { ...draft, globalMemoryContent: content, editingField: undefined },
      },
      state: savedState,
      reload: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      interactive: { ...interactive, mode: "edit", settingsDraft: draft },
      state: addDashboardEvent(state, `Global Memory save failed: ${message}`, "error"),
    };
  }
}

async function loadGlobalMemoryContent(draft: SettingsDraft): Promise<string> {
  const filePath = globalMemoryPath(draft);
  if (!(await fs.pathExists(filePath))) {
    return defaultGlobalMemoryContent;
  }
  return fs.readFile(filePath, "utf8");
}

function isPrintableTextKey(key: string): boolean {
  return key.length === 1 && key >= " " && key !== "\x7f";
}

function startTextEdit(
  state: DashboardState,
  interactive: InteractiveState,
  draft: SettingsDraft,
  field: SettingsTextField
): SettingsResult {
  const value = draft[field];
  return {
    interactive: {
      ...interactive,
      mode: "edit",
      inputBuffer: value,
      scrollOffset: value.length,
      settingsDraft: { ...draft, editingField: field },
    },
    state,
  };
}

async function saveDraft(
  state: DashboardState,
  interactive: InteractiveState,
  draft: SettingsDraft,
  mcpServerEnabled?: Record<string, boolean>,
  syncAfter = false
): Promise<SettingsResult> {
  try {
    const config = await saveSettingsConfig({
      config: state.config,
      configPath: state.configPath,
      root: draft.root,
      memoryDir: draft.memoryDir,
      skillsDir: draft.skillsDir,
      mcpFile: draft.mcpFile,
      workspaceRoot: draft.workspaceRoot,
      providerEnabled: draft.providers,
      instructionWriteMode: draft.writeMode,
      mcpServerEnabled,
    });
    let savedState = addDashboardEvent({ ...state, config, initialized: true, status: syncAfter ? "syncing" : "watching" }, "Settings saved", "success");
    if (syncAfter) {
      const summary = await pushConfig(config);
      savedState = addDashboardEvent(
        { ...savedState, status: "watching" },
        `Sync complete: ${summary.changed} changed, ${summary.unchanged} unchanged, ${summary.skillImports.imported + summary.skillImports.updated} skill import changes`,
        "success"
      );
      for (const warning of summary.skillImports.warnings.slice(0, 3)) {
        savedState = addDashboardEvent(savedState, warning, "warn");
      }
    }
    return {
      interactive: { ...interactive, mode: "browse", scrollOffset: 0, inputBuffer: "", settingsDraft: undefined },
      state: savedState,
      reload: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      interactive: { ...interactive, mode: "focus", settingsDraft: draft },
      state: addDashboardEvent(state, `Settings save failed: ${message}`, "error"),
    };
  }
}

function createSettingsDraft(state: DashboardState): SettingsDraft {
  const root = state.config?.source.root ?? defaultRootForConfigPath(state.configPath);
  const workspaceRoot = state.config?.workspaces.find((workspace) => workspace.name === "main")?.path ?? defaultWorkspaceRoot();
  return {
    workspaceRoot,
    root,
    memoryDir: state.config?.source.memoryDir ?? path.join(root, "memory"),
    skillsDir: state.config?.source.skillsDir ?? path.join(root, "skills"),
    mcpFile: state.config?.source.mcpFile ?? path.join(root, "mcp", "servers.yml"),
    providers: {
      claude: state.config?.providers.claude.enabled ?? true,
      codex: state.config?.providers.codex.enabled ?? true,
      opencode: state.config?.providers.opencode.enabled ?? true,
    },
    writeMode: state.config?.targets.find((target) => target.type === "instructions")?.writeMode ?? "managed",
  };
}

function maxSectionRow(section: number, state: DashboardState): number {
  switch (section) {
    case 0:
      return 1;
    case 1:
      return settingsProviderIds.length;
    case 2:
      return WRITE_MODES.length;
    case 3:
      return 4;
    case 4:
      return mcpSaveRow(state);
    case GLOBAL_MEMORY_SECTION:
    case SAVE_SYNC_SECTION:
      return 0;
    default:
      return 0;
  }
}

function mcpSaveRow(state: DashboardState): number {
  return Math.max(0, state.mcp?.servers.length ?? 0);
}

function rowForField(section: number, field: SettingsTextField): number {
  if (section === 0 && field === "workspaceRoot") return 0;
  if (section === 3) {
    const fields: SettingsTextField[] = ["root", "memoryDir", "skillsDir", "mcpFile"];
    return Math.max(0, fields.indexOf(field));
  }
  return 0;
}

function enabledProvidersLabel(draft: SettingsDraft): string {
  const enabled = settingsProviderIds.filter((provider) => draft.providers[provider]).map((provider) => PROVIDER_LABELS[provider]);
  return enabled.length > 0 ? enabled.join(", ") : "None";
}

function globalMemoryPath(draft: SettingsDraft): string {
  return path.join(resolvePath(draft.memoryDir), GLOBAL_MEMORY_FILE);
}
