import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createSourceTree } from "../src/config/defaults.js";
import {
  loadDashboardSnapshot,
  getMcpSummary,
  getSourceDocuments,
  getSourceSummaries,
  deriveDashboardMetrics,
  derivePrimaryAction,
  deriveReadinessState
} from "../src/tui/state.js";
import { compactStatus, policyLabel, readinessLabel, readinessTone, statusPill, truncateMiddle } from "../src/tui/format.js";

describe("dashboard state", () => {
  it("returns not initialized when config is missing", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-"));
    const state = await loadDashboardSnapshot(path.join(tmp, ".agenthub", "config.yml"));
    expect(state.initialized).toBe(false);
    expect(state.status).toBe("not initialized");
    expect(state.readinessState).toBe("attention");
    expect(state.currentView).toBe("settings");
    expect(state.primaryAction).toBe("Complete guided Settings setup");
  });

  it("builds dashboard summaries from config", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-"));
    const root = path.join(tmp, ".agenthub");
    const workspace = path.join(tmp, "Repository");
    await fs.ensureDir(workspace);
    const config = await createSourceTree({ root, workspaceRoot: workspace, providers: ["claude", "codex"], overwrite: true });

    const state = await loadDashboardSnapshot(path.join(root, "config.yml"));
    expect(state.initialized).toBe(true);
    expect(state.providers.some((provider) => provider.id === "codex" && provider.enabled)).toBe(true);
    expect(state.targets.length).toBe(config.targets.length);
    expect(state.primaryAction).toContain("sync");

    const mcp = await getMcpSummary(config);
    expect(mcp.total).toBe(3);
    expect(mcp.enabled).toBe(1);

    const sources = await getSourceSummaries(config);
    expect(sources.find((source) => source.label === "memory")?.fileCount).toBeGreaterThan(0);

    const memoryFiles = await getSourceDocuments(config, "memory");
    const skillFiles = await getSourceDocuments(config, "skill");
    expect(memoryFiles.map((file) => file.title)).toContain("Global Memory");
    expect(skillFiles.map((file) => file.title)).toContain("Backend Skill");
  });

  it("shows configured MCP servers with command and env refs", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-"));
    const root = path.join(tmp, ".agenthub");
    const workspace = path.join(tmp, "Repository");
    await fs.ensureDir(workspace);
    const config = await createSourceTree({ root, workspaceRoot: workspace, providers: ["codex"], overwrite: true });

    const mcp = await getMcpSummary(config);
    expect(mcp.servers.find((server) => server.name === "filesystem")?.command).toContain("@modelcontextprotocol/server-filesystem");
    expect(mcp.servers.find((server) => server.name === "github")?.envRefs).toEqual(["GITHUB_TOKEN"]);
  });

  it("derives executive dashboard metrics from real state", () => {
    const metrics = deriveDashboardMetrics({
      errorCount: 1,
      mcp: { total: 3, enabled: 1, disabled: 2, envRefs: ["GITHUB_TOKEN"], servers: [] },
      providers: [
        { id: "claude", displayName: "Claude", enabled: true, configured: true, detected: true, notes: [] },
        { id: "codex", displayName: "Codex", enabled: true, configured: true, detected: false, notes: [] }
      ],
      targets: [
        {
          id: "a",
          path: "/tmp/a",
          provider: "claude",
          type: "instructions",
          scope: "workspace",
          writeMode: "managed",
          exists: true,
          synced: true
        },
        {
          id: "b",
          path: "/tmp/b",
          provider: "codex",
          type: "instructions",
          scope: "workspace",
          writeMode: "managed",
          exists: false,
          synced: false
        }
      ]
    });

    expect(metrics.providerCount).toBe(2);
    expect(metrics.detectedProviders).toBe(1);
    expect(metrics.syncedTargets).toBe(1);
    expect(metrics.missingTargets).toBe(1);
    expect(metrics.envRefCount).toBe(1);
    expect(metrics.healthScore).toBeLessThan(100);
  });

  it("derives readiness states and primary actions", () => {
    const base = {
      providerCount: 3,
      configuredProviders: 3,
      detectedProviders: 3,
      targetCount: 4,
      syncedTargets: 4,
      missingTargets: 0,
      driftTargets: 0,
      enabledMcp: 1,
      disabledMcp: 2,
      envRefCount: 1,
      healthScore: 100
    };

    expect(deriveReadinessState({ metrics: base, status: "watching", errorCount: 0 })).toBe("ready");
    expect(deriveReadinessState({ metrics: { ...base, missingTargets: 2 }, status: "watching", errorCount: 0 })).toBe("pending");
    expect(deriveReadinessState({ metrics: { ...base, driftTargets: 1 }, status: "watching", errorCount: 0 })).toBe("drift");
    expect(deriveReadinessState({ metrics: base, status: "error", errorCount: 1 })).toBe("attention");
    expect(derivePrimaryAction({ metrics: { ...base, missingTargets: 2 }, readinessState: "pending", errorCount: 0 })).toBe("Press p to sync 2 pending outputs");
    expect(derivePrimaryAction({ metrics: base, readinessState: "ready", errorCount: 0 })).toBe("System in policy");
  });

  it("formats compact policy labels and paths for the command surface", () => {
    expect(policyLabel({ exists: true, synced: true })).toBe("OK");
    expect(policyLabel({ exists: true, synced: false })).toBe("DRIFT");
    expect(policyLabel({ exists: false, synced: false })).toBe("PENDING");
    expect(readinessLabel("ready")).toBe("Ready");
    expect(readinessLabel("pending")).toBe("Needs Materialization");
    expect(readinessLabel("drift")).toBe("Drift Detected");
    expect(readinessLabel("attention")).toBe("Attention Required");
    expect(readinessTone("ready")).toBe("success");
    expect(readinessTone("pending")).toBe("warn");
    expect(readinessTone("attention")).toBe("danger");
    expect(compactStatus({ exists: false, synced: false })).toEqual({ label: "PENDING", tone: "warn" });
    expect(statusPill(compactStatus({ exists: false, synced: false }).label, compactStatus({ exists: false, synced: false }).tone)).not.toContain("{green-fg}");
    expect(statusPill("drift", "warn")).toContain("{yellow-fg}");
    expect(truncateMiddle("/Users/lucionigro/Repository/AgentHub/src/tui/App.ts", 28)).toHaveLength(28);
  });
});
