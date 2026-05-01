import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createSourceTree } from "../src/config/defaults.js";
import { pushConfig, getStatus } from "../src/core/sync.js";
import { renderAllTargets } from "../src/core/renderer.js";
import { diffRenderedFile } from "../src/core/diff.js";
import { normalizeSkillSectionContent } from "../src/core/providerSkills.js";

describe("AgentHub integration", () => {
  it("initializes a source tree and pushes workspace instructions", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-"));
    const root = path.join(tmp, ".agenthub");
    const workspace = path.join(tmp, "Repository");
    await fs.ensureDir(workspace);

    const config = await createSourceTree({ root, workspaceRoot: workspace, providers: ["claude", "codex"], overwrite: true });
    config.targets = config.targets.map((target) =>
      target.scope === "global" ? { ...target, path: path.join(tmp, "global", path.basename(target.path)) } : target
    );
    expect(await fs.pathExists(path.join(root, "config.yml"))).toBe(true);
    expect(config.targets).toHaveLength(3);

    const summary = await pushConfig(config);
    expect(summary.changed).toBe(3);
    expect(await fs.readFile(path.join(workspace, "CLAUDE.md"), "utf8")).toContain("<!-- agenthub:managed -->");
    expect(await fs.readFile(path.join(workspace, "AGENTS.md"), "utf8")).toContain("# AGENTS.md");

    const status = await getStatus(config);
    expect(status.every((entry) => entry.synced)).toBe(true);
  });

  it("diffs without writing", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-"));
    const root = path.join(tmp, ".agenthub");
    const workspace = path.join(tmp, "Repository");
    await fs.ensureDir(workspace);
    const config = await createSourceTree({ root, workspaceRoot: workspace, providers: ["claude"], overwrite: true });
    const rendered = await renderAllTargets(config);
    const diff = await diffRenderedFile(rendered[0]);
    expect(diff).toContain("CLAUDE.md");
    expect(await fs.pathExists(path.join(workspace, "CLAUDE.md"))).toBe(false);
  });

  it("creates backups before overwriting", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-"));
    const root = path.join(tmp, ".agenthub");
    const workspace = path.join(tmp, "Repository");
    await fs.ensureDir(workspace);
    const config = await createSourceTree({ root, workspaceRoot: workspace, providers: ["claude"], overwrite: true });

    await fs.writeFile(path.join(workspace, "CLAUDE.md"), "manual", "utf8");
    const summary = await pushConfig(config);
    expect(summary.backups).toHaveLength(1);
    expect(await fs.readFile(summary.backups[0], "utf8")).toBe("manual");
  });

  it("syncs newly added skills into Codex AGENTS automatically", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-"));
    const root = path.join(tmp, ".agenthub");
    const workspace = path.join(tmp, "Repository");
    await fs.ensureDir(workspace);
    const config = await createSourceTree({ root, workspaceRoot: workspace, providers: ["codex"], overwrite: true });
    config.targets = config.targets.map((target) =>
      target.scope === "global" ? { ...target, path: path.join(tmp, "global", path.basename(target.path)) } : target
    );

    await fs.writeFile(
      path.join(root, "skills", "agenthub-sync-test.md"),
      "# AgentHub Sync Test\n\nThis skill proves new skill files are rendered into Codex AGENTS.\n",
      "utf8"
    );

    await pushConfig(config);
    const agents = await fs.readFile(path.join(workspace, "AGENTS.md"), "utf8");
    expect(agents).toContain("## AgentHub Sync Test");
    expect(agents).toContain("This skill proves new skill files are rendered into Codex AGENTS.");
  });

  it("imports Claude Code skills and propagates them into Codex AGENTS", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-"));
    const root = path.join(tmp, ".agenthub");
    const workspace = path.join(tmp, "Repository");
    await fs.ensureDir(workspace);
    const config = await createSourceTree({ root, workspaceRoot: workspace, providers: ["claude", "codex"], overwrite: true });
    config.targets = config.targets.map((target) =>
      target.scope === "global" ? { ...target, path: path.join(tmp, "global", path.basename(target.path)) } : target
    );

    const claudeSkillPath = path.join(workspace, ".claude", "skills", "reviewer", "SKILL.md");
    await fs.outputFile(
      claudeSkillPath,
      [
        "---",
        "name: Claude Reviewer",
        "description: Imported from Claude Code",
        "---",
        "# Claude Reviewer",
        "",
        "Prefer review findings that cite behavioral risk.",
        ""
      ].join("\n"),
      "utf8"
    );

    await pushConfig(config);

    const importedSkill = await fs.readFile(path.join(root, "skills", "reviewer.md"), "utf8");
    expect(importedSkill).toContain('agenthub:imported-skill provider="claude"');
    expect(importedSkill).toContain("Imported from Claude Code");

    const agents = await fs.readFile(path.join(workspace, "AGENTS.md"), "utf8");
    expect(agents).toContain("## Claude Reviewer");
    expect(agents).toContain("Prefer review findings that cite behavioral risk.");
    expect(agents).not.toContain("agenthub:imported-skill");
    expect(agents).not.toContain("name: Claude Reviewer");
  });

  it("imports Codex skills and propagates them into Claude and Codex outputs", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-"));
    const root = path.join(tmp, ".agenthub");
    const workspace = path.join(tmp, "Repository");
    await fs.ensureDir(workspace);
    const config = await createSourceTree({ root, workspaceRoot: workspace, providers: ["claude", "codex"], overwrite: true });
    config.targets = config.targets.map((target) =>
      target.scope === "global" ? { ...target, path: path.join(tmp, "global", path.basename(target.path)) } : target
    );

    const codexSkillPath = path.join(workspace, ".codex", "skills", "triage-helper", "SKILL.md");
    await fs.outputFile(
      codexSkillPath,
      [
        "---",
        "name: Codex Triage Helper",
        "description: Imported from Codex",
        "---",
        "# Codex Triage Helper",
        "",
        "Classify failures before editing code.",
        ""
      ].join("\n"),
      "utf8"
    );

    await pushConfig(config);

    const importedSkill = await fs.readFile(path.join(root, "skills", "triage-helper.md"), "utf8");
    expect(importedSkill).toContain('agenthub:imported-skill provider="codex"');
    expect(importedSkill).toContain("Imported from Codex");

    const agents = await fs.readFile(path.join(workspace, "AGENTS.md"), "utf8");
    const claude = await fs.readFile(path.join(workspace, "CLAUDE.md"), "utf8");
    expect(agents).toContain("## Codex Triage Helper");
    expect(agents).toContain("Classify failures before editing code.");
    expect(claude).toContain("## Codex Triage Helper");
    expect(claude).toContain("Classify failures before editing code.");
    expect(agents).not.toContain("agenthub:imported-skill");
  });

  it("imports OpenCode skills and propagates them into Claude and Codex outputs", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-"));
    const root = path.join(tmp, ".agenthub");
    const workspace = path.join(tmp, "Repository");
    await fs.ensureDir(workspace);
    const config = await createSourceTree({ root, workspaceRoot: workspace, providers: ["claude", "codex", "opencode"], overwrite: true });
    config.targets = config.targets.map((target) =>
      target.scope === "global" ? { ...target, path: path.join(tmp, "global", path.basename(target.path)) } : target
    );

    const opencodeSkillPath = path.join(workspace, ".opencode", "skills", "release-check", "SKILL.md");
    await fs.outputFile(
      opencodeSkillPath,
      [
        "---",
        "name: OpenCode Release Check",
        "description: Imported from OpenCode",
        "---",
        "# OpenCode Release Check",
        "",
        "Verify release blockers before publishing.",
        ""
      ].join("\n"),
      "utf8"
    );

    await pushConfig(config);

    const importedSkill = await fs.readFile(path.join(root, "skills", "release-check.md"), "utf8");
    expect(importedSkill).toContain('agenthub:imported-skill provider="opencode"');
    expect(importedSkill).toContain("Imported from OpenCode");

    const agents = await fs.readFile(path.join(workspace, "AGENTS.md"), "utf8");
    const claude = await fs.readFile(path.join(workspace, "CLAUDE.md"), "utf8");
    expect(agents).toContain("## OpenCode Release Check");
    expect(agents).toContain("Verify release blockers before publishing.");
    expect(claude).toContain("## OpenCode Release Check");
    expect(claude).toContain("Verify release blockers before publishing.");
  });

  it("generates shared AGENTS when only OpenCode is enabled", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-"));
    const root = path.join(tmp, ".agenthub");
    const workspace = path.join(tmp, "Repository");
    await fs.ensureDir(workspace);
    const config = await createSourceTree({ root, workspaceRoot: workspace, providers: ["opencode"], overwrite: true });
    config.targets = config.targets.map((target) =>
      target.scope === "global" ? { ...target, path: path.join(tmp, "opencode.json") } : target
    );

    await pushConfig(config);

    const opencode = JSON.parse(await fs.readFile(path.join(tmp, "opencode.json"), "utf8")) as { instructions?: string[] };
    expect(opencode.instructions).toEqual([path.join(workspace, "AGENTS.md")]);
    expect(await fs.pathExists(path.join(workspace, "AGENTS.md"))).toBe(true);
    expect(await fs.readFile(path.join(workspace, "AGENTS.md"), "utf8")).toContain("# AGENTS.md");
  });

  it("uses the Codex AGENTS target when Codex and OpenCode are both enabled", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-"));
    const root = path.join(tmp, ".agenthub");
    const workspace = path.join(tmp, "Repository");
    await fs.ensureDir(workspace);
    const config = await createSourceTree({ root, workspaceRoot: workspace, providers: ["codex", "opencode"], overwrite: true });

    expect(config.targets.some((target) => target.id === "codex-workspace-agents")).toBe(true);
    expect(config.targets.some((target) => target.id === "opencode-workspace-agents")).toBe(false);
  });

  it("previews external provider skills in status and diff before mutating the AgentHub skills dir", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-"));
    const root = path.join(tmp, ".agenthub");
    const workspace = path.join(tmp, "Repository");
    await fs.ensureDir(workspace);
    const config = await createSourceTree({ root, workspaceRoot: workspace, providers: ["codex"], overwrite: true });
    config.targets = config.targets.map((target) =>
      target.scope === "global" ? { ...target, path: path.join(tmp, "global.toml") } : target
    );
    await pushConfig(config);

    await fs.outputFile(
      path.join(workspace, ".codex", "skills", "new-live", "SKILL.md"),
      [
        "---",
        "name: New Live Skill",
        "---",
        "# New Live Skill",
        "",
        "This should appear before import persistence.",
        ""
      ].join("\n"),
      "utf8"
    );

    const statuses = await getStatus(config);
    const rendered = await renderAllTargets(config, { previewProviderSkills: true });
    const diffs = await Promise.all(rendered.map(diffRenderedFile));

    expect(statuses.find((status) => status.id === "codex-workspace-agents")?.synced).toBe(false);
    expect(diffs.join("\n")).toContain("New Live Skill");
    expect(await fs.pathExists(path.join(root, "skills", "new-live.md"))).toBe(false);
  });

  it("skips malformed provider skill frontmatter without blocking sync", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-"));
    const root = path.join(tmp, ".agenthub");
    const workspace = path.join(tmp, "Repository");
    const globalAgentsSkills = path.join(tmp, ".agents", "skills");
    const previous = process.env.AGENTHUB_GLOBAL_AGENTS_SKILLS;
    process.env.AGENTHUB_GLOBAL_AGENTS_SKILLS = globalAgentsSkills;

    try {
      await fs.ensureDir(workspace);
      await fs.outputFile(path.join(globalAgentsSkills, "bad", "SKILL.md"), "---\nname: [bad\n---\n# Bad\n\nBody\n", "utf8");
      const config = await createSourceTree({ root, workspaceRoot: workspace, providers: ["codex"], overwrite: true });
      config.targets = config.targets.map((target) =>
        target.scope === "global" ? { ...target, path: path.join(tmp, "global.toml") } : target
      );

      const summary = await pushConfig(config);

      expect(summary.skillImports.failed).toBeGreaterThanOrEqual(1);
      expect(summary.skillImports.warnings.join("\n")).toContain("bad");
      expect(await fs.pathExists(path.join(workspace, "AGENTS.md"))).toBe(true);
    } finally {
      if (previous === undefined) {
        delete process.env.AGENTHUB_GLOBAL_AGENTS_SKILLS;
      } else {
        process.env.AGENTHUB_GLOBAL_AGENTS_SKILLS = previous;
      }
    }
  });

  it("does not import README files inside SKILL.md packages", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-"));
    const root = path.join(tmp, ".agenthub");
    const workspace = path.join(tmp, "Repository");
    await fs.ensureDir(workspace);
    await fs.outputFile(path.join(workspace, ".codex", "skills", "release", "SKILL.md"), "# Release Skill\n\nDo release work.\n", "utf8");
    await fs.outputFile(path.join(workspace, ".codex", "skills", "release", "README.md"), "# Internal README\n\nNot a skill.\n", "utf8");
    const config = await createSourceTree({ root, workspaceRoot: workspace, providers: ["codex"], overwrite: true });
    config.targets = config.targets.map((target) =>
      target.scope === "global" ? { ...target, path: path.join(tmp, "global.toml") } : target
    );

    await pushConfig(config);

    expect(await fs.pathExists(path.join(root, "skills", "release.md"))).toBe(true);
    expect(await fs.pathExists(path.join(root, "skills", "readme.md"))).toBe(false);
  });

  it("imports global agents skills used by OpenCode and propagates them into Codex", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-"));
    const root = path.join(tmp, ".agenthub");
    const workspace = path.join(tmp, "Repository");
    const globalAgentsSkills = path.join(tmp, ".agents", "skills");
    const previous = process.env.AGENTHUB_GLOBAL_AGENTS_SKILLS;
    process.env.AGENTHUB_GLOBAL_AGENTS_SKILLS = globalAgentsSkills;

    try {
      await fs.ensureDir(workspace);
      const config = await createSourceTree({ root, workspaceRoot: workspace, providers: ["codex", "opencode"], overwrite: true });
      config.targets = config.targets.map((target) =>
        target.scope === "global" ? { ...target, path: path.join(tmp, "global", path.basename(target.path)) } : target
      );

      await fs.outputFile(
        path.join(globalAgentsSkills, "gitpr", "SKILL.md"),
        [
          "---",
          "name: Git PR",
          "description: Imported from the shared agents skill root",
          "---",
          "# Git PR",
          "",
          "Review pull requests with repository context.",
          ""
        ].join("\n"),
        "utf8"
      );

      await pushConfig(config);

      const importedSkill = await fs.readFile(path.join(root, "skills", "gitpr.md"), "utf8");
      expect(importedSkill).toContain('agenthub:imported-skill provider="opencode"');

      const agents = await fs.readFile(path.join(workspace, "AGENTS.md"), "utf8");
      expect(agents).toContain("## Git PR");
      expect(agents).toContain("Review pull requests with repository context.");
    } finally {
      if (previous === undefined) {
        delete process.env.AGENTHUB_GLOBAL_AGENTS_SKILLS;
      } else {
        process.env.AGENTHUB_GLOBAL_AGENTS_SKILLS = previous;
      }
    }
  });

  it("normalizes provider skill content before rendering sections", () => {
    const normalized = normalizeSkillSectionContent(
      [
        "---",
        "name: Claude Reviewer",
        "---",
        "# Claude Reviewer",
        "",
        '<!-- agenthub:imported-skill provider="claude" source="/tmp/SKILL.md" -->',
        "",
        "Only the operative skill body remains.",
        ""
      ].join("\n")
    );

    expect(normalized).toBe("Only the operative skill body remains.");
  });
});
