import fs from "fs-extra";
import path from "node:path";
import YAML from "yaml";
import { createDefaultMcpConfig, createSourceTree } from "./defaults.js";
import { defaultAgentHubRoot, defaultWorkspaceRoot, resolvePath } from "./paths.js";
import { saveConfig } from "./saveConfig.js";
import type { AgentHubConfig, McpConfig, ProviderId, WriteMode } from "./schema.js";
import { mcpConfigSchema } from "./schema.js";
import { readYamlFile, writeYamlFile } from "../utils/yaml.js";
import { getProvider } from "../providers/registry.js";

export const settingsProviderIds: ProviderId[] = ["claude", "codex", "opencode"];

export type SettingsConfigInput = {
  config?: AgentHubConfig;
  configPath: string;
  root?: string;
  memoryDir?: string;
  skillsDir?: string;
  mcpFile?: string;
  workspaceRoot?: string;
  providerEnabled?: Partial<Record<ProviderId, boolean>>;
  instructionWriteMode?: WriteMode;
  mcpServerEnabled?: Record<string, boolean>;
};

export function defaultRootForConfigPath(configPath: string): string {
  const resolved = resolvePath(configPath);
  return path.basename(resolved) === "config.yml" ? path.dirname(resolved) : resolvePath(defaultAgentHubRoot);
}

export async function saveSettingsConfig(input: SettingsConfigInput): Promise<AgentHubConfig> {
  const configPath = resolvePath(input.configPath);
  const root = resolvePath(input.root ?? input.config?.source.root ?? defaultRootForConfigPath(configPath));
  const workspaceRoot = resolvePath(input.workspaceRoot ?? input.config?.workspaces[0]?.path ?? defaultWorkspaceRoot);
  const writeMode = input.instructionWriteMode ?? firstInstructionWriteMode(input.config) ?? "managed";

  const baseConfig = input.config
    ? cloneConfig(input.config)
    : await createSourceTree({
        root,
        configPath,
        workspaceRoot,
        providers: settingsProviderIds,
        defaultWriteMode: writeMode,
      });

  const source = {
    root,
    memoryDir: resolvePath(input.memoryDir ?? defaultSourcePath(baseConfig, root, "memoryDir", "memory")),
    skillsDir: resolvePath(input.skillsDir ?? defaultSourcePath(baseConfig, root, "skillsDir", "skills")),
    mcpFile: resolvePath(input.mcpFile ?? defaultSourcePath(baseConfig, root, "mcpFile", "mcp/servers.yml")),
  };

  let updated: AgentHubConfig = {
    ...baseConfig,
    source,
    workspaces: upsertMainWorkspace(baseConfig, workspaceRoot),
    providers: applyProviderSettings(baseConfig, input.providerEnabled),
    targets: baseConfig.targets.map((target) => ({ ...target })),
  };

  updated = await ensureDefaultTargets(updated, workspaceRoot, writeMode);
  updated = {
    ...updated,
    targets: updated.targets.map((target) => {
      const defaultPath = defaultTargetPath(target.id, workspaceRoot);
      return {
        ...target,
        ...(defaultPath ? { path: defaultPath } : {}),
        ...(target.type === "instructions" ? { writeMode } : {}),
      };
    }),
  };

  await ensureSourceDirs(updated);

  const mcp = await loadOrDefaultMcp(updated, workspaceRoot);
  const syncedMcp = applyMcpServerUpdates(syncFilesystemMcpWorkspace(mcp, workspaceRoot), input.mcpServerEnabled);
  await writeYamlFile(resolvePath(updated.source.mcpFile), syncedMcp);

  await saveConfig(updated, configPath);
  return updated;
}

export async function loadEditableMcpConfig(config: AgentHubConfig, workspaceRoot = config.workspaces[0]?.path ?? defaultWorkspaceRoot): Promise<McpConfig> {
  return loadOrDefaultMcp(config, workspaceRoot);
}

function cloneConfig(config: AgentHubConfig): AgentHubConfig {
  return JSON.parse(JSON.stringify(config)) as AgentHubConfig;
}

function firstInstructionWriteMode(config?: AgentHubConfig): WriteMode | undefined {
  return config?.targets.find((target) => target.type === "instructions")?.writeMode;
}

function defaultSourcePath(
  config: AgentHubConfig,
  root: string,
  key: keyof AgentHubConfig["source"],
  fallback: string
): string {
  const current = config.source[key];
  const oldRoot = resolvePath(config.source.root);
  if (resolvePath(root) !== oldRoot) {
    return path.join(root, fallback);
  }
  return current;
}

function upsertMainWorkspace(config: AgentHubConfig, workspaceRoot: string): AgentHubConfig["workspaces"] {
  const workspaces = config.workspaces.map((workspace) =>
    workspace.name === "main" ? { ...workspace, path: workspaceRoot, mode: "workspace-root" as const } : workspace
  );
  if (workspaces.some((workspace) => workspace.name === "main")) {
    return workspaces;
  }
  return [{ name: "main", path: workspaceRoot, mode: "workspace-root" }, ...workspaces];
}

function applyProviderSettings(
  config: AgentHubConfig,
  providerEnabled?: Partial<Record<ProviderId, boolean>>
): AgentHubConfig["providers"] {
  return {
    claude: { enabled: providerEnabled?.claude ?? config.providers.claude.enabled },
    codex: { enabled: providerEnabled?.codex ?? config.providers.codex.enabled },
    opencode: { enabled: providerEnabled?.opencode ?? config.providers.opencode.enabled },
  };
}

async function ensureDefaultTargets(
  config: AgentHubConfig,
  workspaceRoot: string,
  writeMode: WriteMode
): Promise<AgentHubConfig> {
  const targets = [...config.targets];
  const existingIds = new Set(targets.map((target) => target.id));
  for (const providerId of settingsProviderIds) {
    const defaults = await getProvider(providerId).getDefaultTargets({ config, workspaceRoot, defaultWriteMode: writeMode });
    for (const target of defaults) {
      if (!existingIds.has(target.id)) {
        targets.push(target);
        existingIds.add(target.id);
      }
    }
  }
  return { ...config, targets };
}

function defaultTargetPath(targetId: string, workspaceRoot: string): string | undefined {
  switch (targetId) {
    case "claude-workspace-instructions":
      return path.join(workspaceRoot, "CLAUDE.md");
    case "codex-workspace-agents":
      return path.join(workspaceRoot, "AGENTS.md");
    default:
      return undefined;
  }
}

async function ensureSourceDirs(config: AgentHubConfig): Promise<void> {
  await fs.ensureDir(resolvePath(config.source.root));
  await fs.ensureDir(resolvePath(config.source.memoryDir));
  await fs.ensureDir(resolvePath(config.source.skillsDir));
  await fs.ensureDir(path.dirname(resolvePath(config.source.mcpFile)));
  await fs.ensureDir(path.join(resolvePath(config.source.root), "templates"));
  await fs.ensureDir(path.join(resolvePath(config.source.root), "backups"));
}

async function loadOrDefaultMcp(config: AgentHubConfig, workspaceRoot: string): Promise<McpConfig> {
  const filePath = resolvePath(config.source.mcpFile);
  if (!(await fs.pathExists(filePath))) {
    return createDefaultMcpConfig(workspaceRoot);
  }
  try {
    const raw = await readYamlFile<unknown>(filePath);
    return mcpConfigSchema.parse(raw);
  } catch {
    const parsed = YAML.parse(await fs.readFile(filePath, "utf8")) as unknown;
    return mcpConfigSchema.parse(parsed);
  }
}

function syncFilesystemMcpWorkspace(mcp: McpConfig, workspaceRoot: string): McpConfig {
  const next: McpConfig = cloneMcp(mcp);
  const server = next.servers.filesystem;
  if (!server) {
    next.servers.filesystem = createDefaultMcpConfig(workspaceRoot).servers.filesystem;
    return next;
  }

  const filesystemPackageIndex = server.args.findIndex((arg) => arg === "@modelcontextprotocol/server-filesystem");
  if (filesystemPackageIndex >= 0) {
    server.args = [...server.args.slice(0, filesystemPackageIndex + 1), workspaceRoot];
  }
  return next;
}

function applyMcpServerUpdates(mcp: McpConfig, updates?: Record<string, boolean>): McpConfig {
  if (!updates) return mcp;
  const next = cloneMcp(mcp);
  for (const [name, enabled] of Object.entries(updates)) {
    if (next.servers[name]) {
      next.servers[name] = { ...next.servers[name], enabled };
    }
  }
  return next;
}

function cloneMcp(mcp: McpConfig): McpConfig {
  return JSON.parse(JSON.stringify(mcp)) as McpConfig;
}
