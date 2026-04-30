import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { createSourceTree } from "../src/config/defaults.js";
import { loadConfig } from "../src/config/loadConfig.js";
import { saveSettingsConfig } from "../src/config/settings.js";
import { getStatus } from "../src/core/sync.js";
import type { McpConfig } from "../src/config/schema.js";

describe("settings-only configuration", () => {
  it("creates the first-run source tree and config from Settings", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-settings-"));
    const root = path.join(tmp, ".agenthub");
    const configPath = path.join(root, "config.yml");
    const workspace = path.join(tmp, "Repository");

    const config = await saveSettingsConfig({
      configPath,
      root,
      workspaceRoot: workspace,
      providerEnabled: { opencode: false },
      instructionWriteMode: "append-block",
    });

    expect(await fs.pathExists(configPath)).toBe(true);
    expect(await fs.pathExists(path.join(root, "memory"))).toBe(true);
    expect(await fs.pathExists(path.join(root, "skills"))).toBe(true);
    expect(config.providers.opencode.enabled).toBe(false);
    expect(config.targets.filter((target) => target.type === "instructions").every((target) => target.writeMode === "append-block")).toBe(true);
    expect(config.targets.filter((target) => target.type === "mcp").every((target) => target.writeMode === "append-block")).toBe(true);

    const reloaded = await loadConfig(configPath);
    expect(reloaded.workspaces[0]?.path).toBe(workspace);

    const mcp = YAML.parse(await fs.readFile(reloaded.source.mcpFile, "utf8")) as McpConfig;
    expect(mcp.servers.filesystem.args.at(-1)).toBe(workspace);
  });

  it("updates workspace-derived targets and filesystem MCP", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-settings-"));
    const root = path.join(tmp, ".agenthub");
    const configPath = path.join(root, "config.yml");
    const oldWorkspace = path.join(tmp, "OldRepository");
    const newWorkspace = path.join(tmp, "NewRepository");
    await fs.ensureDir(oldWorkspace);
    await fs.ensureDir(newWorkspace);
    const config = await createSourceTree({ root, configPath, workspaceRoot: oldWorkspace, providers: ["claude", "codex"], overwrite: true });

    const updated = await saveSettingsConfig({ config, configPath, workspaceRoot: newWorkspace });

    expect(updated.workspaces[0]?.path).toBe(newWorkspace);
    expect(updated.targets.find((target) => target.id === "claude-workspace-instructions")?.path).toBe(path.join(newWorkspace, "CLAUDE.md"));
    expect(updated.targets.find((target) => target.id === "codex-workspace-agents")?.path).toBe(path.join(newWorkspace, "AGENTS.md"));

    const mcp = YAML.parse(await fs.readFile(updated.source.mcpFile, "utf8")) as McpConfig;
    expect(mcp.servers.filesystem.args.at(-1)).toBe(newWorkspace);
  });

  it("ignores disabled provider targets in status metrics", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-settings-"));
    const root = path.join(tmp, ".agenthub");
    const workspace = path.join(tmp, "Repository");
    await fs.ensureDir(workspace);
    const config = await createSourceTree({ root, workspaceRoot: workspace, providers: ["claude", "codex"], overwrite: true });
    const updated = await saveSettingsConfig({
      config,
      configPath: path.join(root, "config.yml"),
      providerEnabled: { codex: false },
    });

    const statuses = await getStatus(updated);
    expect(statuses.map((status) => status.provider)).toEqual(["claude"]);
  });

  it("changes write mode only for instruction targets", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-settings-"));
    const root = path.join(tmp, ".agenthub");
    const configPath = path.join(root, "config.yml");
    const workspace = path.join(tmp, "Repository");
    await fs.ensureDir(workspace);
    const config = await createSourceTree({
      root,
      configPath,
      workspaceRoot: workspace,
      providers: ["claude", "codex", "opencode"],
      defaultWriteMode: "append-block",
      overwrite: true,
    });

    const updated = await saveSettingsConfig({ config, configPath, instructionWriteMode: "managed" });

    expect(updated.targets.filter((target) => target.type === "instructions").every((target) => target.writeMode === "managed")).toBe(true);
    expect(updated.targets.filter((target) => target.type === "mcp").every((target) => target.writeMode === "append-block")).toBe(true);
  });
});
