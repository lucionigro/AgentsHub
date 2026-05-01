import fs from "fs-extra";
import path from "node:path";
import type { AgentHubConfig, McpConfig, TargetDefinition } from "../config/schema.js";
import { resolvePath } from "../config/paths.js";
import { getProvider } from "../providers/registry.js";
import type { RenderedFile, SourceSection } from "../providers/types.js";
import { loadMcpConfig } from "../config/loadConfig.js";
import { normalizeSkillSectionContent, previewProviderSkills, type ProviderSkillPreview } from "./providerSkills.js";

export type RenderOptions = {
  previewProviderSkills?: boolean;
  providerSkillPreviews?: ProviderSkillPreview[];
};

export async function renderTarget(config: AgentHubConfig, target: TargetDefinition, options: RenderOptions = {}): Promise<RenderedFile[]> {
  const adapter = getProvider(target.provider);
  const generatedAt = new Date().toISOString();
  const sections = await readSections(config, target, options);
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

export async function renderAllTargets(config: AgentHubConfig, options: RenderOptions = {}): Promise<RenderedFile[]> {
  const rendered: RenderedFile[] = [];
  const providerSkillPreviews = options.previewProviderSkills
    ? options.providerSkillPreviews ?? await previewProviderSkills(config)
    : options.providerSkillPreviews;
  for (const target of config.targets) {
    if (!config.providers[target.provider]?.enabled) {
      continue;
    }
    rendered.push(...(await renderTarget(config, target, { ...options, providerSkillPreviews })));
  }
  return dedupeRenderedFiles(rendered);
}

export async function readSections(config: AgentHubConfig, target: TargetDefinition, options: RenderOptions = {}): Promise<SourceSection[]> {
  const root = resolvePath(config.source.root);
  const sections: SourceSection[] = [];
  const previews = options.providerSkillPreviews ?? [];
  const previewByPath = new Map(previews.map((preview) => [resolvePath(preview.targetPath), preview.section]));
  const includes = await expandIncludes(config, target, previews);

  for (const include of includes) {
    const filePath = resolvePath(include, root);
    const preview = previewByPath.get(filePath);
    if (preview) {
      sections.push(preview);
      continue;
    }
    if (!(await fs.pathExists(filePath))) {
      continue;
    }
    const content = await fs.readFile(filePath, "utf8");
    sections.push({
      title: titleFromContent(content) ?? titleFromInclude(include),
      path: path.relative(root, filePath),
      content: normalizeSkillSectionContent(content),
      kind: sourceKind(config, filePath)
    });
  }

  return sections;
}


async function expandIncludes(config: AgentHubConfig, target: TargetDefinition, previews: ProviderSkillPreview[] = []): Promise<string[]> {
  const includes = [...(target.includes ?? [])];
  if (target.type !== "instructions") {
    return includes;
  }

  const root = resolvePath(config.source.root);
  const skillsDir = resolvePath(config.source.skillsDir);
  if (!(await fs.pathExists(skillsDir))) {
    return appendPreviewIncludes(root, includes, previews);
  }

  const skillFiles = (await fs.readdir(skillsDir))
    .filter((entry) => entry.endsWith(".md"))
    .sort()
    .map((entry) => path.join(skillsDir, entry));
  const existing = new Set(includes.map((include) => resolvePath(include, root)));

  for (const skillFile of skillFiles) {
    const absolute = resolvePath(skillFile, root);
    if (!existing.has(absolute) && isSubpath(skillsDir, absolute)) {
      includes.push(skillFile);
      existing.add(absolute);
    }
  }

  return appendPreviewIncludes(root, includes, previews);
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

function appendPreviewIncludes(root: string, includes: string[], previews: ProviderSkillPreview[]): string[] {
  const existing = new Set(includes.map((include) => resolvePath(include, root)));
  for (const preview of previews) {
    const targetPath = resolvePath(preview.targetPath);
    if (!existing.has(targetPath)) {
      includes.push(targetPath);
      existing.add(targetPath);
    }
  }
  return includes;
}

function sourceKind(config: AgentHubConfig, filePath: string): SourceSection["kind"] {
  const memoryDir = resolvePath(config.source.memoryDir);
  const skillsDir = resolvePath(config.source.skillsDir);
  if (isSubpath(memoryDir, filePath)) return "memory";
  if (isSubpath(skillsDir, filePath)) return "skill";
  return "other";
}

function isSubpath(parent: string, child: string): boolean {
  const relative = path.relative(resolvePath(parent), resolvePath(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function dedupeRenderedFiles(files: RenderedFile[]): RenderedFile[] {
  const deduped: RenderedFile[] = [];
  const seen = new Map<string, RenderedFile>();
  for (const file of files) {
    const key = resolvePath(file.path);
    const existing = seen.get(key);
    if (existing && renderedFilesMatch(existing, file)) {
      continue;
    }
    seen.set(key, file);
    deduped.push(file);
  }
  return deduped;
}

function renderedFilesMatch(left: RenderedFile, right: RenderedFile): boolean {
  return left.content === right.content &&
    left.writeMode === right.writeMode &&
    left.format === right.format &&
    JSON.stringify(left.managedKeys ?? []) === JSON.stringify(right.managedKeys ?? []);
}
