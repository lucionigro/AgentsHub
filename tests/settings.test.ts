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
import { createInitialInteractive, createInitialState, loadDashboardSnapshot, type SettingsDraft } from "../src/tui/state.js";
import { handleSettingsKeys } from "../src/tui/components/SettingsPanel.js";

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

  it("edits workspace root by typing a path in Settings", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-settings-edit-"));
    const workspace = path.join(tmp, "ManualWorkspace");
    let state = {
      ...createInitialState(path.join(tmp, ".agenthub", "config.yml")),
      currentView: "settings" as const,
      interactive: createInitialInteractive()
    };

    let result = await handleSettingsKeys("enter", state, state.interactive);
    expect(result).not.toBeNull();
    state = { ...result!.state, interactive: result!.interactive };

    result = await handleSettingsKeys("enter", state, state.interactive);
    expect(result?.interactive.mode).toBe("edit");
    state = { ...result!.state, interactive: result!.interactive };

    while (state.interactive.inputBuffer.length > 0) {
      result = await handleSettingsKeys("backspace", state, state.interactive);
      state = { ...result!.state, interactive: result!.interactive };
    }
    for (const char of workspace) {
      result = await handleSettingsKeys(char, state, state.interactive);
      state = { ...result!.state, interactive: result!.interactive };
    }

    result = await handleSettingsKeys("\r", state, state.interactive);
    expect(result).toBeNull();
    result = await handleSettingsKeys("\n", state, state.interactive);
    expect(result).toBeNull();

    result = await handleSettingsKeys("enter", state, state.interactive);
    expect(result?.interactive.settingsDraft?.workspaceRoot).toBe(workspace);
  });

  it("saves Global Memory during first-run with the active Settings draft", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-global-memory-"));
    const configPath = path.join(tmp, ".agenthub", "config.yml");
    const root = path.join(tmp, "source");
    const memoryDir = path.join(tmp, "memory-source");
    const workspace = path.join(tmp, "ManualWorkspace");
    const content = "# Team Memory\n\nUse the shared release checklist.\n";
    const draft: SettingsDraft = {
      workspaceRoot: workspace,
      root,
      memoryDir,
      skillsDir: path.join(root, "skills"),
      mcpFile: path.join(root, "mcp", "servers.yml"),
      providers: { claude: true, codex: false, opencode: true },
      writeMode: "append-block",
    };
    let state = {
      ...createInitialState(configPath),
      currentView: "settings" as const,
      interactive: createInitialInteractive()
    };
    let interactive = {
      ...createInitialInteractive(),
      mode: "focus" as const,
      cursorIndex: 5,
      scrollOffset: 0,
      settingsDraft: draft,
    };

    let result = await handleSettingsKeys("enter", state, interactive);
    expect(result?.interactive.mode).toBe("edit");
    expect(result?.interactive.settingsDraft?.editingField).toBe("globalMemory");

    interactive = { ...result!.interactive, inputBuffer: content, scrollOffset: content.length };
    state = { ...result!.state, interactive };
    result = await handleSettingsKeys("C-s", state, interactive);

    expect(result?.reload).toBe(true);
    expect(await fs.readFile(path.join(memoryDir, "global.md"), "utf8")).toBe(content);

    const saved = await loadConfig(configPath);
    expect(saved.workspaces[0]?.path).toBe(workspace);
    expect(saved.source.memoryDir).toBe(memoryDir);
    expect(saved.providers.codex.enabled).toBe(false);
    expect(saved.providers.opencode.enabled).toBe(true);
    expect(saved.targets.filter((target) => target.type === "instructions").every((target) => target.writeMode === "append-block")).toBe(true);
  });

  it("cancels Global Memory edits without writing", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-global-memory-cancel-"));
    const root = path.join(tmp, ".agenthub");
    const workspace = path.join(tmp, "Repository");
    await fs.ensureDir(workspace);
    await createSourceTree({ root, workspaceRoot: workspace, providers: ["claude"], overwrite: true });
    const configPath = path.join(root, "config.yml");
    const original = await fs.readFile(path.join(root, "memory", "global.md"), "utf8");
    let state = {
      ...await loadDashboardSnapshot(configPath),
      currentView: "settings" as const,
      interactive: createInitialInteractive()
    };
    let interactive = {
      ...createInitialInteractive(),
      mode: "focus" as const,
      cursorIndex: 5,
      scrollOffset: 0,
    };

    let result = await handleSettingsKeys("enter", state, interactive);
    expect(result?.interactive.mode).toBe("edit");

    interactive = { ...result!.interactive, inputBuffer: `${result!.interactive.inputBuffer}\nUnsaved`, scrollOffset: result!.interactive.inputBuffer.length + 8 };
    state = { ...result!.state, interactive };
    result = await handleSettingsKeys("escape", state, interactive);

    expect(result?.interactive.mode).toBe("focus");
    expect(await fs.readFile(path.join(root, "memory", "global.md"), "utf8")).toBe(original);
  });
});
