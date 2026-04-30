import blessed from "neo-blessed";
import { getConfigPath } from "../config/loadConfig.js";
import { diffRenderedFile } from "../core/diff.js";
import { renderAllTargets } from "../core/renderer.js";
import { pushConfig } from "../core/sync.js";
import { watchConfig, type WatchEvent } from "../core/watcher.js";
import { createBottomNav, renderBottomNav } from "./components/BottomNav.js";
import { createHeader, renderHeader } from "./components/Header.js";
import { createOverviewPanel, renderOverviewPanel } from "./components/OverviewPanel.js";
import { createSkillsPanel, renderSkillsPanel, handleSkillsKeys } from "./components/SkillsPanel.js";
import { createBaseMemoryPanel, renderBaseMemoryPanel, handleBaseMemoryKeys } from "./components/BaseMemoryPanel.js";
import { createWorkspacePanel, renderWorkspacePanel, handleWorkspaceKeys } from "./components/WorkspacePanel.js";
import { createActivityPanel, renderActivityPanel } from "./components/ActivityPanel.js";
import { createSettingsPanel, renderSettingsPanel, handleSettingsKeys } from "./components/SettingsPanel.js";
import { palette } from "./theme/palette.js";
import { hex } from "./theme/styles.js";
import {
  addDashboardEvent,
  createInitialState,
  createInitialInteractive,
  loadDashboardSnapshot,
  type DashboardState,
  type DashboardView,
  VIEW_LABELS,
} from "./state.js";

const VIEW_ORDER: DashboardView[] = [
  "dashboard",
  "skills",
  "memory",
  "workspace",
  "activity",
  "settings",
];

interface Widgets {
  header: blessed.Widgets.BoxElement;
  overviewPanel: blessed.Widgets.BoxElement;
  skillsPanel: blessed.Widgets.BoxElement;
  memoryPanel: blessed.Widgets.BoxElement;
  workspacePanel: blessed.Widgets.BoxElement;
  activityPanel: blessed.Widgets.BoxElement;
  settingsPanel: blessed.Widgets.BoxElement;
  bottomNav: blessed.Widgets.BoxElement;
  help: blessed.Widgets.BoxElement;
}

export async function runTui(): Promise<void> {
  const configPath = getConfigPath();
  let state = createInitialState(configPath);
  let closeWatcher: (() => Promise<void>) | undefined;
  let refreshTimer: NodeJS.Timeout | undefined;
  let clockTimer: NodeJS.Timeout | undefined;

  const screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true,
    title: "AgentHub Control Panel",
    style: {
      fg: palette.white,
      bg: palette.bg,
    },
  });

  const widgets = createWidgets(screen);

  async function refreshStatus(message?: string): Promise<void> {
    try {
      state = await loadDashboardSnapshot(configPath, state);
      if (message) state = addDashboardEvent(state, message, "info");
      await ensureWatcher();
    } catch (error) {
      state = { ...state, status: "error", readinessState: "attention" };
      state = addDashboardEvent(
        state,
        error instanceof Error ? error.message : String(error),
        "error"
      );
    }
    renderDashboard(screen, widgets, state);
  }

  async function ensureWatcher(): Promise<void> {
    if (!state.initialized || !state.config || closeWatcher) return;
    closeWatcher = watchConfig(state.config, (event) => void handleWatchEvent(event));
    state = addDashboardEvent(
      state,
      "AgentHub is watching memory, skills, MCPs, and provider skill folders",
      "success"
    );
  }

  async function handleWatchEvent(event: WatchEvent): Promise<void> {
    const level =
      event.type === "error" ? "error" : event.type === "sync" ? "success" : "info";
    state = addDashboardEvent(state, event.message, level);
    if (event.type === "sync") {
      state = { ...state, lastSync: new Date().toLocaleTimeString(), status: "watching" };
    }
    await refreshStatus();
  }

  async function reloadConfig(): Promise<void> {
    if (closeWatcher) {
      await closeWatcher();
      closeWatcher = undefined;
    }
    state = addDashboardEvent(state, "Configuration reloaded", "success");
    await refreshStatus();
  }

  async function materializeNow(): Promise<void> {
    const config = state.config;
    if (!config) {
      state = addDashboardEvent(state, "Open Settings before materializing targets", "warn");
      renderDashboard(screen, widgets, state);
      return;
    }
    state = { ...state, status: "syncing" };
    renderDashboard(screen, widgets, state);
    try {
      const summary = await pushConfig(config);
      state = { ...state, status: "watching", lastSync: new Date().toLocaleTimeString() };
      state = addDashboardEvent(
        state,
        `Sync complete: ${summary.changed} changed, ${summary.unchanged} unchanged, ${summary.backups.length} backups`,
        "success"
      );
      await refreshStatus();
    } catch (error) {
      state = { ...state, status: "error", readinessState: "attention" };
      state = addDashboardEvent(
        state,
        error instanceof Error ? error.message : String(error),
        "error"
      );
      renderDashboard(screen, widgets, state);
    }
  }

  async function driftScan(): Promise<void> {
    if (!state.config) {
      state = addDashboardEvent(state, "Open Settings before scanning", "warn");
      renderDashboard(screen, widgets, state);
      return;
    }
    try {
      const files = await renderAllTargets(state.config);
      const diffs = await Promise.all(files.map(diffRenderedFile));
      const count = diffs.filter(Boolean).length;
      state = addDashboardEvent(
        state,
        count === 0
          ? "Posture scan complete: system in policy"
          : `Posture scan complete: ${count} drifted target(s)`,
        count === 0 ? "success" : "warn"
      );
    } catch (error) {
      state = addDashboardEvent(
        state,
        error instanceof Error ? error.message : String(error),
        "error"
      );
    }
    renderDashboard(screen, widgets, state);
  }

  async function quit(): Promise<void> {
    if (refreshTimer) clearInterval(refreshTimer);
    if (clockTimer) clearInterval(clockTimer);
    if (closeWatcher) await closeWatcher();
    screen.destroy();
    process.exit(0);
  }

  const viewOrder: DashboardView[] = [
    "dashboard",
    "skills",
    "memory",
    "workspace",
    "activity",
    "settings",
  ];

  function switchView(view: DashboardView): void {
    state = {
      ...state,
      currentView: view,
      interactive: createInitialInteractive(),
    };
    renderDashboard(screen, widgets, state);
  }

  function navLeft(): void {
    const idx = viewOrder.indexOf(state.currentView);
    const newIdx = idx <= 0 ? viewOrder.length - 1 : idx - 1;
    switchView(viewOrder[newIdx]);
  }

  function navRight(): void {
    const idx = viewOrder.indexOf(state.currentView);
    const newIdx = idx >= viewOrder.length - 1 ? 0 : idx + 1;
    switchView(viewOrder[newIdx]);
  }

  function handleInteractiveKey(key: string, ch?: string): void {
    const view = state.currentView;
    let result: { interactive: typeof state.interactive; state: DashboardState } | null = null;

    if (view === "skills") {
      const r = handleSkillsKeys(key, state, state.interactive);
      if (r) result = { interactive: r.interactive, state };
    } else if (view === "memory") {
      const r = handleBaseMemoryKeys(key, state, state.interactive);
      if (r) result = { interactive: r.interactive, state };
    } else if (view === "workspace") {
      const r = handleWorkspaceKeys(key, state, state.interactive);
      if (r) result = { interactive: r.interactive, state };
    } else if (view === "settings") {
      handleSettingsKeys(key, state, state.interactive).then((r) => {
        if (r) {
          state = r.state;
          state.interactive = r.interactive;
          if (r.reload) {
            void reloadConfig();
          } else {
            renderDashboard(screen, widgets, state);
          }
        }
      });
      return;
    }

    if (result) {
      state = result.state;
      state.interactive = result.interactive;
      renderDashboard(screen, widgets, state);
    }
  }

  function isTextEditing(): boolean {
    return state.interactive.mode === "edit";
  }

  // Global keybindings
  screen.key(["q", "C-c"], (_ch, key) => {
    if (key.name === "q" && isTextEditing()) return;
    void quit();
  });
  screen.key("p", () => { if (!isTextEditing()) void materializeNow(); });
  screen.key("d", () => { if (!isTextEditing()) void driftScan(); });
  screen.key("r", () => { if (!isTextEditing()) void reloadConfig(); });

  screen.key("1", () => { if (!isTextEditing()) switchView("dashboard"); });
  screen.key("2", () => { if (!isTextEditing()) switchView("skills"); });
  screen.key("3", () => { if (!isTextEditing()) switchView("memory"); });
  screen.key("4", () => { if (!isTextEditing()) switchView("workspace"); });
  screen.key("5", () => { if (!isTextEditing()) switchView("activity"); });
  screen.key("6", () => { if (!isTextEditing()) switchView("settings"); });

  screen.key("left", () => { isTextEditing() ? handleInteractiveKey("left") : navLeft(); });
  screen.key("right", () => { isTextEditing() ? handleInteractiveKey("right") : navRight(); });

  screen.key(["up", "down", "enter", "escape", "space", "backspace"], (ch, key) => {
    handleInteractiveKey(key.name);
  });

  // Capture printable chars for text input in settings
  screen.on("keypress", (ch, key) => {
    if (state.interactive.mode === "edit") {
      const keyName = key?.name ?? "";
      if (!["up", "down", "left", "right", "enter", "escape", "space", "backspace", "tab"].includes(keyName)) {
        handleInteractiveKey(ch ?? keyName, ch);
      }
    }
  });

  screen.key(["?", "h"], () => {
    if (isTextEditing()) return;
    state = { ...state, showHelp: !state.showHelp };
    renderDashboard(screen, widgets, state);
  });

  refreshTimer = setInterval(() => void refreshStatus(), 5000);
  clockTimer = setInterval(() => {
    renderHeader(widgets.header, state.currentView, state.status === "watching");
    screen.render();
  }, 1000);

  await refreshStatus("AgentHub online");
}

function createWidgets(screen: blessed.Widgets.Screen): Widgets {
  return {
    header: createHeader(screen),
    overviewPanel: createOverviewPanel(screen),
    skillsPanel: createSkillsPanel(screen),
    memoryPanel: createBaseMemoryPanel(screen),
    workspacePanel: createWorkspacePanel(screen),
    activityPanel: createActivityPanel(screen),
    settingsPanel: createSettingsPanel(screen),
    bottomNav: createBottomNav(screen),
    help: blessed.box({
      parent: screen,
      top: "center",
      left: "center",
      width: 72,
      height: 20,
      label: " Command Deck ",
      border: { type: "line" },
      tags: true,
      hidden: true,
      style: {
        fg: palette.white,
        bg: palette.bgPanel,
        border: { fg: palette.yellow },
        label: { fg: palette.yellow },
      },
    }),
  };
}

function renderDashboard(
  screen: blessed.Widgets.Screen,
  widgets: Widgets,
  state: DashboardState
): void {
  const width = Number(screen.width) || 160;
  const height = Number(screen.height) || 45;

  applyLayout(widgets, state, width, height);
  renderHeader(widgets.header, state.currentView, state.status === "watching");
  renderCurrentView(widgets, state, width);
  renderBottomNav(widgets.bottomNav, state.currentView, width);
  renderHelp(widgets.help, state);

  screen.render();
}

function applyLayout(
  widgets: Widgets,
  state: DashboardState,
  width: number,
  height: number
): void {
  // Header
  setBox(widgets.header, 0, 0, "100%", 3);

  // Content area
  const contentTop = 3;
  const contentHeight = height - contentTop - 3;

  // Position all panels in the content area
  const panelWidgets = [
    widgets.overviewPanel,
    widgets.skillsPanel,
    widgets.memoryPanel,
    widgets.workspacePanel,
    widgets.activityPanel,
    widgets.settingsPanel,
  ];

  // Hide all, then show current
  for (const w of panelWidgets) {
    w.hide();
  }

  const activePanel = getActivePanel(widgets, state.currentView);
  if (activePanel) {
    setBox(activePanel, contentTop, 0, "100%", contentHeight);
    activePanel.show();
  }

  // Bottom nav
  setBox(widgets.bottomNav, height - 3, 0, "100%", 3);
  widgets.bottomNav.show();
}

function getActivePanel(
  widgets: Widgets,
  view: DashboardView
): blessed.Widgets.BoxElement | null {
  switch (view) {
    case "dashboard": return widgets.overviewPanel;
    case "skills": return widgets.skillsPanel;
    case "memory": return widgets.memoryPanel;
    case "workspace": return widgets.workspacePanel;
    case "activity": return widgets.activityPanel;
    case "settings": return widgets.settingsPanel;
    default: return null;
  }
}

function renderCurrentView(
  widgets: Widgets,
  state: DashboardState,
  width: number
): void {
  const interactive = state.interactive;

  switch (state.currentView) {
    case "dashboard":
      renderOverviewPanel(widgets.overviewPanel, state, width);
      break;
    case "skills":
      renderSkillsPanel(widgets.skillsPanel, state, width, interactive);
      break;
    case "memory":
      renderBaseMemoryPanel(widgets.memoryPanel, state, width, interactive);
      break;
    case "workspace":
      renderWorkspacePanel(widgets.workspacePanel, state, width, interactive);
      break;
    case "activity":
      renderActivityPanel(widgets.activityPanel, state.events, width);
      break;
    case "settings":
      renderSettingsPanel(widgets.settingsPanel, state, width, interactive);
      break;
  }
}

function renderHelp(widget: blessed.Widgets.BoxElement, state: DashboardState): void {
  widget.hidden = !state.showHelp;
  widget.setContent(
    [
      `${hex("AgentHub Command Deck", palette.cyan)}`,
      "",
      "\u2190\u2192  Navigate views",
      "",
      "1  Dashboard",
      "2  Skills",
      "3  Base Memory",
      "4  Workspace",
      "5  Recent Activity",
      "6  Settings",
      "",
      "\u2191\u2193  Navigate items (in lists)",
      "Enter  Select / Focus",
      "Space  Toggle (in checkboxes)",
      "Esc    Back / Exit edit",
      "",
      `${hex("p", palette.cyan)}  Push / sync now`,
      `${hex("d", palette.cyan)}  Diff / drift scan`,
      `${hex("r", palette.cyan)}  Reload config`,
      `${hex("h", palette.cyan)}  Toggle this help`,
      `${hex("q", palette.cyan)}  Quit`,
    ].join("\n")
  );
}

function setBox(
  widget: blessed.Widgets.BoxElement,
  top: number | string,
  left: number | string,
  width: number | string,
  height: number | string
): void {
  widget.top = top;
  widget.left = left;
  widget.width = width;
  widget.height = height;
}
