import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import type { AgentHubConfig, ProviderId } from "../config/schema.js";
import { resolvePath } from "../config/paths.js";
import type { SourceSection } from "../providers/types.js";

const importMarker = "<!-- agenthub:imported-skill";
const ignoredSkillDirs = new Set([".git", ".system", ".tmp", "node_modules", "vendor_imports", "cache", "memories"]);

type SkillProvider = ProviderId;

type ProviderSkillRoot = {
  provider: SkillProvider;
  root: string;
};

export type ProviderSkillImportSummary = {
  imported: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
  warnings: string[];
};

export type ProviderSkillPreview = {
  targetPath: string;
  content: string;
  section: SourceSection;
};

type DiscoveredSkill = {
  provider: SkillProvider;
  slug: string;
  sourcePath: string;
  title: string;
  description?: string;
  body: string;
};

type ProviderSkillReadResults = {
  skills: DiscoveredSkill[];
  warnings: string[];
};

type ProviderSkillImportEntry = {
  skill: DiscoveredSkill;
  targetPath?: string;
  content?: string;
  status: "imported" | "updated" | "unchanged" | "skipped";
};

type ProviderSkillImportPlan = {
  entries: ProviderSkillImportEntry[];
  summary: ProviderSkillImportSummary;
};

export async function syncProviderSkills(config: AgentHubConfig): Promise<ProviderSkillImportSummary> {
  const plan = await planProviderSkillImports(config);
  await fs.ensureDir(resolvePath(config.source.skillsDir));

  for (const entry of plan.entries) {
    if (!entry.targetPath || !entry.content || (entry.status !== "imported" && entry.status !== "updated")) {
      continue;
    }

    await fs.outputFile(entry.targetPath, entry.content, "utf8");
  }

  return plan.summary;
}

export async function discoverProviderSkills(config: AgentHubConfig): Promise<DiscoveredSkill[]> {
  return (await discoverProviderSkillResults(config)).skills;
}

export async function previewProviderSkills(config: AgentHubConfig): Promise<ProviderSkillPreview[]> {
  const plan = await planProviderSkillImports(config);
  const root = resolvePath(config.source.root);
  return plan.entries
    .filter((entry) => entry.targetPath && entry.content && entry.status !== "skipped")
    .map((entry) => ({
      targetPath: entry.targetPath as string,
      content: entry.content as string,
      section: {
        title: entry.skill.title,
        path: path.relative(root, entry.targetPath as string),
        content: normalizeSkillSectionContent(entry.content as string),
        kind: "skill"
      }
    }));
}

export async function previewProviderSkillImportSummary(config: AgentHubConfig): Promise<ProviderSkillImportSummary> {
  return (await planProviderSkillImports(config)).summary;
}

export function emptyProviderSkillImportSummary(): ProviderSkillImportSummary {
  return { imported: 0, updated: 0, unchanged: 0, skipped: 0, failed: 0, warnings: [] };
}

async function planProviderSkillImports(config: AgentHubConfig): Promise<ProviderSkillImportPlan> {
  const { skills, warnings } = await discoverProviderSkillResults(config);
  const summary = emptyProviderSkillImportSummary();
  summary.failed = warnings.length;
  summary.warnings.push(...warnings);
  const entries: ProviderSkillImportEntry[] = [];

  for (const skill of skills) {
    const targetPath = await targetPathForImportedSkill(config, skill);
    if (!targetPath) {
      summary.skipped += 1;
      summary.warnings.push(`Skipped ${skill.sourcePath}: a non-AgentHub skill already uses ${skill.slug}.md`);
      entries.push({ skill, status: "skipped" });
      continue;
    }

    const content = renderImportedSkill(skill);
    const exists = await fs.pathExists(targetPath);
    const previous = exists ? await fs.readFile(targetPath, "utf8") : undefined;
    const status = !exists ? "imported" : previous === content ? "unchanged" : "updated";
    summary[status] += 1;
    entries.push({ skill, targetPath, content, status });
  }

  return { entries, summary };
}

async function discoverProviderSkillResults(config: AgentHubConfig): Promise<ProviderSkillReadResults> {
  const roots = await getProviderSkillRootEntries(config);
  const skillPaths = new Map<string, SkillProvider>();
  for (const root of roots) {
    for (const skillPath of await findSkillFiles(root.root)) {
      skillPaths.set(skillPath, root.provider);
    }
  }

  const skills: DiscoveredSkill[] = [];
  const warnings: string[] = [];
  for (const [skillPath, provider] of [...skillPaths.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    try {
      const skill = await readProviderSkill(provider, skillPath);
      if (skill) {
        skills.push(skill);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Skipped ${skillPath}: ${message}`);
    }
  }
  return { skills, warnings };
}

export async function getProviderSkillWatchGlobs(config: AgentHubConfig): Promise<string[]> {
  const roots = await getProviderSkillRootEntries(config);
  return roots.map((entry) => path.join(entry.root, "**/*"));
}

export function normalizeSkillSectionContent(content: string): string {
  const hasImportMarker = content.includes(importMarker);
  const normalized = content
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n+/, "")
    .replace(/^#\s+.+\r?\n+/, "")
    .replace(new RegExp(`${escapeRegExp(importMarker)}[^>]*>\\r?\\n+`, "g"), "");

  return (hasImportMarker ? normalized.replace(/^>\s+.+(?:\r?\n>\s+.*)*\r?\n+/m, "") : normalized)
    .trim();
}

async function getProviderSkillRoots(config: AgentHubConfig): Promise<string[]> {
  const roots = await getProviderSkillRootEntries(config);
  return roots.map((entry) => entry.root);
}

async function getProviderSkillRootEntries(config: AgentHubConfig): Promise<ProviderSkillRoot[]> {
  const home = os.homedir();
  const workspaceRoots = config.workspaces.map((workspace) => resolvePath(workspace.path));
  const roots: ProviderSkillRoot[] = [
    { provider: "claude", root: path.join(home, ".claude", "skills") },
    { provider: "codex", root: path.join(home, ".codex", "skills") },
    { provider: "opencode", root: globalAgentsSkillsRoot() },
    { provider: "opencode", root: path.join(home, ".config", "opencode", "skills") },
  ];

  for (const workspaceRoot of workspaceRoots) {
    roots.push(
      { provider: "claude", root: path.join(workspaceRoot, ".claude", "skills") },
      { provider: "codex", root: path.join(workspaceRoot, ".codex", "skills") },
      { provider: "opencode", root: path.join(workspaceRoot, ".opencode", "skills") }
    );
  }

  const seen = new Set<string>();
  return roots
    .map((entry) => ({ ...entry, root: resolvePath(entry.root) }))
    .filter((entry) => {
      const key = `${entry.provider}:${entry.root}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function globalAgentsSkillsRoot(): string {
  return process.env.AGENTHUB_GLOBAL_AGENTS_SKILLS ?? path.join(os.homedir(), ".agents", "skills");
}

async function findSkillFiles(root: string, allowLooseMarkdown = true): Promise<string[]> {
  if (!(await fs.pathExists(root))) {
    return [];
  }
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (ignoredSkillDirs.has(entry.name)) {
      continue;
    }
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const skillPath = path.join(entryPath, "SKILL.md");
      if (await fs.pathExists(skillPath)) {
        files.push(skillPath);
        continue;
      }
      files.push(...(await findSkillFiles(entryPath, false)));
    } else if (entry.isFile() && entry.name === "SKILL.md") {
      files.push(entryPath);
    } else if (allowLooseMarkdown && entry.isFile() && isLooseMarkdownSkill(entry.name)) {
      files.push(entryPath);
    }
  }
  return [...new Set(files)];
}

function isLooseMarkdownSkill(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".md") && !["readme.md", "agents.md", "claude.md"].includes(lower);
}

async function readProviderSkill(provider: SkillProvider, sourcePath: string): Promise<DiscoveredSkill | undefined> {
  const raw = await fs.readFile(sourcePath, "utf8");
  const { frontmatter, body } = parseFrontmatter(raw);
  const h1 = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const slug = slugFromPath(sourcePath);
  if (!slug) {
    throw new Error("Skill path does not produce a usable slug");
  }
  const title = String(frontmatter.name ?? h1 ?? titleFromSlug(slug));
  const description = typeof frontmatter.description === "string" ? frontmatter.description.trim() : undefined;
  return {
    provider,
    slug,
    sourcePath,
    title,
    description,
    body: normalizeSkillSectionContent(body)
  };
}

async function targetPathForImportedSkill(config: AgentHubConfig, skill: DiscoveredSkill): Promise<string | undefined> {
  const skillsDir = resolvePath(config.source.skillsDir);
  const preferred = path.join(skillsDir, `${skill.slug}.md`);
  const fallback = path.join(skillsDir, `${skill.provider}-${skill.slug}.md`);

  for (const candidate of [preferred, fallback]) {
    if (!(await fs.pathExists(candidate))) {
      return candidate;
    }
    const existing = await fs.readFile(candidate, "utf8");
    if (existing.includes(`${importMarker} provider="${skill.provider}" source="${skill.sourcePath}"`)) {
      return candidate;
    }
  }

  return undefined;
}

function renderImportedSkill(skill: DiscoveredSkill): string {
  const lines = [
    `# ${skill.title}`,
    "",
    `${importMarker} provider="${skill.provider}" source="${skill.sourcePath}" -->`,
    ""
  ];
  if (skill.description) {
    lines.push(`> ${skill.description}`, "");
  }
  lines.push(skill.body.trim(), "");
  return lines.join("\n");
}

function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  const parsed = YAML.parse(match[1]) as unknown;
  const frontmatter = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  return { frontmatter, body: content.slice(match[0].length) };
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function slugFromPath(sourcePath: string): string {
  const base = path.basename(sourcePath) === "SKILL.md"
    ? path.basename(path.dirname(sourcePath))
    : path.basename(sourcePath, path.extname(sourcePath));
  return slugify(base);
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
