import fs from "fs-extra";
import path from "node:path";
import type { AgentHubConfig, McpConfig, ProviderId, WriteMode } from "../config/schema.js";
import { loadConfig, loadMcpConfig } from "../config/loadConfig.js";
import { resolvePath, toDisplayPath } from "../config/paths.js";
import { getStatus, type TargetStatus } from "../core/sync.js";
import { listProviders } from "../providers/registry.js";

export type ProviderDashboardStatus = {
  id: string;
  displayName: string;
  enabled: boolean;
  configured: boolean;
  detected: boolean;
  notes: string[];
};

export type McpDashboardSummary = {
  total: number;
  enabled: number;
  disabled: number;
  envRefs: string[];
  servers: Array<{
    name: string;
    enabled: boolean;
    transport: string;
    command?: string;
    envRefs: string[];
  }>;
};

export type SourceFileSummary = {
  label: string;
  path: string;
  exists: boolean;
  fileCount: number;
  latestModified?: string;
};

export type SourceDocumentSummary = {
  kind: "memory" | "skill";
  title: string;
  path: string;
  updatedAt?: string;
  importedFrom?: string;
};

export type DashboardEvent = {
  time: string;
  level: "info" | "success" | "warn" | "error";
  message: string;
};

export type InteractiveViewMode = "browse" | "focus" | "edit";

export type SettingsTextField = "workspaceRoot" | "root" | "memoryDir" | "skillsDir" | "mcpFile";

export type SettingsDraft = {
  workspaceRoot: string;
  root: string;
  memoryDir: string;
  skillsDir: string;
  mcpFile: string;
  providers: Record<ProviderId, boolean>;
  writeMode: WriteMode;
  editingField?: SettingsTextField;
};

export type InteractiveState = {
  mode: InteractiveViewMode;
  cursorIndex: number;
  scrollOffset: number;
  inputBuffer: string;
  settingsDraft?: SettingsDraft;
};

export type DashboardState = {
  config?: AgentHubConfig;
  configPath: string;
  initialized: boolean;
  status: "watching" | "syncing" | "error" | "not initialized";
  lastSync?: string;
  errorCount: number;
  readinessState: ReadinessState;
  primaryAction: string;
  metrics: DashboardMetrics;
  providers: ProviderDashboardStatus[];
  targets: TargetStatus[];
  targetsByProvider: Record<string, TargetStatus[]>;
  mcp?: McpDashboardSummary;
  sources: SourceFileSummary[];
  memoryFiles: SourceDocumentSummary[];
  skillFiles: SourceDocumentSummary[];
  events: DashboardEvent[];
  currentView: DashboardView;
  interactive: InteractiveState;
  showHelp: boolean;
};

export type DashboardView = "dashboard" | "skills" | "memory" | "workspace" | "activity" | "settings";

export const VIEW_LABELS: Record<DashboardView, string> = {
  dashboard: "MAIN DASHBOARD",
  skills: "SKILLS",
  memory: "BASE MEMORY",
  workspace: "WORKSPACE",
  activity: "RECENT ACTIVITY",
  settings: "SETTINGS",
};

export type ReadinessState = "ready" | "pending" | "drift" | "attention";

export type DashboardMetrics = {
  providerCount: number;
  configuredProviders: number;
  detectedProviders: number;
  targetCount: number;
  syncedTargets: number;
  missingTargets: number;
  driftTargets: number;
  enabledMcp: number;
  disabledMcp: number;
  envRefCount: number;
  healthScore: number;
};

export function createInitialInteractive(): InteractiveState {
  return {
    mode: "browse",
    cursorIndex: 0,
    scrollOffset: 0,
    inputBuffer: "",
  };
}

export function createInitialState(configPath: string): DashboardState {
  return {
    configPath,
    initialized: false,
    status: "not initialized",
    errorCount: 0,
    readinessState: "attention",
    primaryAction: "Open Settings to configure AgentHub",
    metrics: emptyMetrics(),
    providers: [],
    targets: [],
    targetsByProvider: {},
    sources: [],
    memoryFiles: [],
    skillFiles: [],
    events: [],
    currentView: "dashboard",
    interactive: createInitialInteractive(),
    showHelp: false,
  };
}

export async function loadDashboardSnapshot(configPath: string, previous?: DashboardState): Promise<DashboardState> {
  const state = previous ?? createInitialState(configPath);
  if (!(await fs.pathExists(configPath))) {
    return {
      ...state,
      initialized: false,
      status: "not initialized",
      config: undefined,
      providers: [],
      targets: [],
      targetsByProvider: {},
      mcp: undefined,
      sources: [],
      memoryFiles: [],
      skillFiles: [],
      metrics: emptyMetrics(),
      readinessState: "attention",
      primaryAction: "Open Settings to configure AgentHub",
      events: state.events,
    };
  }

  const config = await loadConfig(configPath);
  const [targets, providers, mcp, sources, memoryFiles, skillFiles] = await Promise.all([
    getStatus(config),
    getProviderStatuses(config),
    getMcpSummary(config),
    getSourceSummaries(config),
    getSourceDocuments(config, "memory"),
    getSourceDocuments(config, "skill"),
  ]);

  const metrics = deriveDashboardMetrics({
    providers,
    targets,
    mcp,
    errorCount: state.errorCount,
  });
  const readinessState = deriveReadinessState({ metrics, status: state.status, errorCount: state.errorCount });

  return {
    ...state,
    config,
    initialized: true,
    status: state.status === "syncing" ? "syncing" : "watching",
    providers,
    targets,
    targetsByProvider: groupTargetsByProvider(targets),
    mcp,
    sources,
    memoryFiles,
    skillFiles,
    metrics,
    readinessState,
    primaryAction: derivePrimaryAction({ metrics, readinessState, errorCount: state.errorCount }),
  };
}

export function emptyMetrics(): DashboardMetrics {
  return {
    providerCount: 0,
    configuredProviders: 0,
    detectedProviders: 0,
    targetCount: 0,
    syncedTargets: 0,
    missingTargets: 0,
    driftTargets: 0,
    enabledMcp: 0,
    disabledMcp: 0,
    envRefCount: 0,
    healthScore: 0,
  };
}

export function deriveReadinessState(input: {
  metrics: DashboardMetrics;
  status: DashboardState["status"];
  errorCount: number;
}): ReadinessState {
  if (input.status === "error" || input.errorCount > 0) return "attention";
  if (input.metrics.missingTargets > 0) return "pending";
  if (input.metrics.driftTargets > 0) return "drift";
  return "ready";
}

export function derivePrimaryAction(input: {
  metrics: DashboardMetrics;
  readinessState: ReadinessState;
  errorCount: number;
}): string {
  if (input.readinessState === "attention") {
    return `Review ${input.errorCount || 1} operational event(s) requiring attention`;
  }
  if (input.readinessState === "pending") {
    return `Press p to sync ${input.metrics.missingTargets} pending output${input.metrics.missingTargets === 1 ? "" : "s"}`;
  }
  if (input.readinessState === "drift") {
    return `Press d to inspect ${input.metrics.driftTargets} changed output${input.metrics.driftTargets === 1 ? "" : "s"}`;
  }
  return "System in policy";
}

export function groupTargetsByProvider(targets: TargetStatus[]): Record<string, TargetStatus[]> {
  return targets.reduce<Record<string, TargetStatus[]>>((groups, target) => {
    groups[target.provider] = [...(groups[target.provider] ?? []), target];
    return groups;
  }, {});
}

export function deriveDashboardMetrics(input: {
  providers: ProviderDashboardStatus[];
  targets: TargetStatus[];
  mcp?: McpDashboardSummary;
  errorCount: number;
}): DashboardMetrics {
  const enabledProviders = input.providers.filter((provider) => provider.enabled);
  const missingTargets = input.targets.filter((target) => !target.exists).length;
  const driftTargets = input.targets.filter((target) => target.exists && !target.synced).length;
  const syncedTargets = input.targets.filter((target) => target.synced).length;
  const enabledProviderNotDetected = enabledProviders.filter((provider) => !provider.detected).length;
  const targetPenalty = missingTargets * 16 + driftTargets * 10;
  const providerPenalty = enabledProviderNotDetected * 8;
  const errorPenalty = input.errorCount * 6;
  const healthScore = input.targets.length === 0 ? 0 : Math.max(0, Math.min(100, 100 - targetPenalty - providerPenalty - errorPenalty));

  return {
    providerCount: enabledProviders.length,
    configuredProviders: input.providers.filter((provider) => provider.enabled && provider.configured).length,
    detectedProviders: enabledProviders.filter((provider) => provider.detected).length,
    targetCount: input.targets.length,
    syncedTargets,
    missingTargets,
    driftTargets,
    enabledMcp: input.mcp?.enabled ?? 0,
    disabledMcp: input.mcp?.disabled ?? 0,
    envRefCount: input.mcp?.envRefs.length ?? 0,
    healthScore,
  };
}

export async function getProviderStatuses(config: AgentHubConfig): Promise<ProviderDashboardStatus[]> {
  return Promise.all(
    listProviders().map(async (provider) => {
      const enabled = config.providers[provider.id as keyof AgentHubConfig["providers"]]?.enabled ?? false;
      const configured = config.targets.some((target) => target.provider === provider.id);
      const detected = await provider.detect();
      return {
        id: provider.id,
        displayName: provider.displayName,
        enabled,
        configured,
        detected: detected.installed,
        notes: detected.notes ?? [],
      };
    })
  );
}

export async function getMcpSummary(config: AgentHubConfig): Promise<McpDashboardSummary> {
  let mcp: McpConfig;
  try {
    mcp = await loadMcpConfig(config);
  } catch {
    return { total: 0, enabled: 0, disabled: 0, envRefs: [], servers: [] };
  }

  const servers = Object.entries(mcp.servers).map(([name, server]) => {
    const serverEnvRefs = extractEnvRefs(server);
    return {
      name,
      enabled: server.enabled !== false,
      transport: server.url ? "remote" : "local",
      command: server.url ?? [server.command, ...server.args].filter(Boolean).join(" "),
      envRefs: serverEnvRefs,
    };
  });
  const envRefs = new Set<string>();
  for (const [, server] of Object.entries(mcp.servers)) {
    for (const value of extractEnvRefs(server)) envRefs.add(value);
  }

  return {
    total: servers.length,
    enabled: servers.filter((server) => server.enabled).length,
    disabled: servers.filter((server) => !server.enabled).length,
    envRefs: [...envRefs].sort(),
    servers,
  };
}

export async function getSourceDocuments(config: AgentHubConfig, kind: "memory" | "skill"): Promise<SourceDocumentSummary[]> {
  const root = resolvePath(kind === "memory" ? config.source.memoryDir : config.source.skillsDir);
  const files = (await listFiles(root)).filter((filePath) => filePath.endsWith(".md")).sort();
  return Promise.all(
    files.map(async (filePath) => {
      const [content, stat] = await Promise.all([fs.readFile(filePath, "utf8"), fs.stat(filePath)]);
      return {
        kind,
        title: titleFromMarkdown(content, filePath),
        path: toDisplayPath(filePath),
        updatedAt: stat.mtime.toISOString(),
        importedFrom: kind === "skill" ? importedProvider(content) : undefined,
      };
    })
  );
}

export async function getSourceSummaries(config: AgentHubConfig): Promise<SourceFileSummary[]> {
  const entries = [
    { label: "memory", path: config.source.memoryDir },
    { label: "skills", path: config.source.skillsDir },
    { label: "mcp", path: path.dirname(resolvePath(config.source.mcpFile)) },
    { label: "templates", path: path.join(resolvePath(config.source.root), "templates") },
    { label: "backups", path: path.join(resolvePath(config.source.root), "backups") },
  ];

  return Promise.all(
    entries.map(async (entry) => {
      const filePaths = await listFiles(resolvePath(entry.path));
      const stats = await Promise.all(filePaths.map((filePath) => fs.stat(filePath)));
      const latest = stats.sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.mtime;
      return {
        label: entry.label,
        path: toDisplayPath(resolvePath(entry.path)),
        exists: await fs.pathExists(resolvePath(entry.path)),
        fileCount: filePaths.length,
        latestModified: latest?.toISOString(),
      };
    })
  );
}

export function addDashboardEvent(
  state: DashboardState,
  message: string,
  level: DashboardEvent["level"] = "info"
): DashboardState {
  return {
    ...state,
    errorCount: level === "error" ? state.errorCount + 1 : state.errorCount,
    events: [
      ...state.events,
      {
        time: new Date().toLocaleTimeString(),
        level,
        message,
      },
    ].slice(-250),
  };
}

async function listFiles(root: string): Promise<string[]> {
  if (!(await fs.pathExists(root))) {
    return [];
  }
  const stat = await fs.stat(root);
  if (stat.isFile()) {
    return [root];
  }

  const entries = await fs.readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const next = path.join(root, entry.name);
      return entry.isDirectory() ? listFiles(next) : Promise.resolve([next]);
    })
  );
  return nested.flat();
}

function titleFromMarkdown(content: string, filePath: string): string {
  return (
    content
      .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n+/, "")
      .match(/^#\s+(.+)$/m)?.[1]
      ?.trim() ??
    path
      .basename(filePath, path.extname(filePath))
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function importedProvider(content: string): string | undefined {
  return content.match(/agenthub:imported-skill provider="([^"]+)"/)?.[1];
}

function extractEnvRefs(server: McpConfig["servers"][string]): string[] {
  const refs = new Set<string>();
  for (const value of [...Object.values(server.env), ...Object.values(server.headers)]) {
    if (value.startsWith("env:")) refs.add(value.slice(4));
  }
  return [...refs].sort();
}
