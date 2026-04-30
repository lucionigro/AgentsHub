import fs from "fs-extra";
import path from "node:path";
import type { AgentHubConfig, McpConfig, TargetDefinition } from "../config/schema.js";
import { resolvePath } from "../config/paths.js";
import { getProvider } from "../providers/registry.js";
import type { RenderedFile, SourceSection } from "../providers/types.js";
import { loadMcpConfig } from "../config/loadConfig.js";
import { normalizeSkillSectionContent } from "./providerSkills.js";

export async function renderTarget(config: AgentHubConfig, target: TargetDefinition): Promise<RenderedFile[]> {
  const adapter = getProvider(target.provider);
  const generatedAt = new Date().toISOString();
  const sections = await readSections(config, target);
  const context = {
    config,
    target,
    generatedAt,
    sourceRoot: resolvePath(config.source.root),
    sections
  };

  if (target.type === "instructions") {
    return adapter.renderInstructions(context);
  }
  if (target.type === "skills" && adapter.renderSkills) {
    return adapter.renderSkills(context);
  }
  if (target.type === "mcp" && adapter.renderMcp) {
    const mcp = await loadMcpConfig(config);
    return adapter.renderMcp({ ...context, mcp });
  }

  return [];
}

export async function renderAllTargets(config: AgentHubConfig): Promise<RenderedFile[]> {
  const rendered: RenderedFile[] = [];
  for (const target of config.targets) {
    if (!config.providers[target.provider]?.enabled) {
      continue;
    }
    rendered.push(...(await renderTarget(config, target)));
  }
  return rendered;
}

export async function readSections(config: AgentHubConfig, target: TargetDefinition): Promise<SourceSection[]> {
  const root = resolvePath(config.source.root);
  const sections: SourceSection[] = [];
  const includes = await expandIncludes(config, target);

  for (const include of includes) {
    const filePath = resolvePath(include, root);
    if (!(await fs.pathExists(filePath))) {
      continue;
    }
    const content = await fs.readFile(filePath, "utf8");
    sections.push({
      title: titleFromContent(content) ?? titleFromInclude(include),
      path: path.relative(root, filePath),
      content: normalizeSkillSectionContent(content),
      kind: include.startsWith("memory/") ? "memory" : include.startsWith("skills/") ? "skill" : "other"
    });
  }

  return sections;
}


async function expandIncludes(config: AgentHubConfig, target: TargetDefinition): Promise<string[]> {
  const includes = [...(target.includes ?? [])];
  if (target.type !== "instructions") {
    return includes;
  }

  const root = resolvePath(config.source.root);
  const skillsDir = resolvePath(config.source.skillsDir);
  if (!(await fs.pathExists(skillsDir))) {
    return includes;
  }

  const skillFiles = (await fs.readdir(skillsDir))
    .filter((entry) => entry.endsWith(".md"))
    .sort()
    .map((entry) => path.join("skills", entry));
  const existing = new Set(includes.map((include) => path.normalize(include)));

  for (const skillFile of skillFiles) {
    const normalized = path.normalize(skillFile);
    const absolute = resolvePath(skillFile, root);
    if (!existing.has(normalized) && absolute.startsWith(skillsDir)) {
      includes.push(skillFile);
      existing.add(normalized);
    }
  }

  return includes;
}

function titleFromInclude(include: string): string {
  return path
    .basename(include, path.extname(include))
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function titleFromContent(content: string): string | undefined {
  return content
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n+/, "")
    .match(/^#\s+(.+)$/m)?.[1]
    ?.trim();
}
