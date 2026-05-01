import chokidar from "chokidar";
import type { AgentHubConfig } from "../config/schema.js";
import { resolvePath } from "../config/paths.js";
import { pushConfig } from "./sync.js";
import { getProviderSkillWatchGlobs } from "./providerSkills.js";

export type WatchEvent = {
  type: "change" | "sync" | "warn" | "error";
  message: string;
};

export function watchConfig(config: AgentHubConfig, onEvent: (event: WatchEvent) => void): () => Promise<void> {
  const watched = [
    `${config.source.root}/config.yml`,
    `${config.source.memoryDir}/**/*`,
    `${config.source.skillsDir}/**/*`,
    `${resolvePath(config.source.root)}/mcp/**/*`,
    `${resolvePath(config.source.root)}/templates/**/*`
  ].map((entry) => resolvePath(entry));

  let timer: NodeJS.Timeout | undefined;
  const watcher = chokidar.watch(watched, { ignoreInitial: true });

  void getProviderSkillWatchGlobs(config).then((globs) => {
    for (const glob of globs) {
      watcher.add(glob);
    }
  });

  const schedule = (filePath: string) => {
    onEvent({ type: "change", message: `${filePath} changed` });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void pushConfig(config)
        .then((summary) => {
          const skillChanges = summary.skillImports.imported + summary.skillImports.updated;
          onEvent({
            type: "sync",
            message: `sync complete: ${summary.changed} changed, ${summary.unchanged} unchanged, ${skillChanges} skill import changes`
          });
          for (const warning of summary.skillImports.warnings.slice(0, 3)) {
            onEvent({ type: "warn", message: warning });
          }
        })
        .catch((error: unknown) => {
          onEvent({ type: "error", message: error instanceof Error ? error.message : String(error) });
        });
    }, 250);
  };

  watcher.on("add", schedule);
  watcher.on("change", schedule);
  watcher.on("unlink", schedule);
  watcher.on("error", (error) => onEvent({ type: "error", message: String(error) }));

  return async () => {
    if (timer) clearTimeout(timer);
    await watcher.close();
  };
}
