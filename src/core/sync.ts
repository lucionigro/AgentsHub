import fs from "fs-extra";
import type { AgentHubConfig } from "../config/schema.js";
import { resolvePath } from "../config/paths.js";
import { renderAllTargets } from "./renderer.js";
import { writeRenderedFile, prepareNextContent } from "./fileWriter.js";
import { syncProviderSkills } from "./providerSkills.js";

export type TargetStatus = {
  id: string;
  path: string;
  provider: AgentHubConfig["targets"][number]["provider"];
  type: AgentHubConfig["targets"][number]["type"];
  scope: AgentHubConfig["targets"][number]["scope"];
  writeMode: AgentHubConfig["targets"][number]["writeMode"];
  exists: boolean;
  synced: boolean;
  updatedAt?: string;
};

export type SyncSummary = {
  changed: number;
  unchanged: number;
  skipped: number;
  backups: string[];
};

export async function pushConfig(config: AgentHubConfig): Promise<SyncSummary> {
  await syncProviderSkills(config);
  const rendered = await renderAllTargets(config);
  const timestamp = new Date().toISOString().replaceAll(":", "").replaceAll(".", "");
  const summary: SyncSummary = { changed: 0, unchanged: 0, skipped: 0, backups: [] };

  for (const file of rendered) {
    const result = await writeRenderedFile(file, `${config.source.root}/backups`, timestamp);
    if (result.skipped) summary.skipped += 1;
    else if (result.changed) summary.changed += 1;
    else summary.unchanged += 1;
    if (result.backupPath) summary.backups.push(result.backupPath);
  }

  return summary;
}

export async function getStatus(config: AgentHubConfig): Promise<TargetStatus[]> {
  const statuses: TargetStatus[] = [];
  const rendered = await renderAllTargets(config);

  for (const target of config.targets) {
    if (!config.providers[target.provider]?.enabled) {
      continue;
    }
    const files = rendered.filter((file) => resolvePath(file.path) === resolvePath(target.path));
    const targetPath = resolvePath(target.path);
    const exists = await fs.pathExists(targetPath);
    const existing = exists ? await fs.readFile(targetPath, "utf8") : undefined;
    const stat = exists ? await fs.stat(targetPath) : undefined;
    const synced =
      files.length > 0 &&
      files.every((file) => {
        const next = prepareNextContent(file, existing);
        return existing === next;
      });
    statuses.push({
      id: target.id,
      path: targetPath,
      provider: target.provider,
      type: target.type,
      scope: target.scope,
      writeMode: target.writeMode,
      exists,
      synced,
      updatedAt: stat?.mtime.toISOString()
    });
  }

  return statuses;
}
