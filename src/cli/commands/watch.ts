import { loadConfig } from "../../config/loadConfig.js";
import { watchConfig } from "../../core/watcher.js";
import { logger } from "../../utils/logger.js";

export async function watchCommand(): Promise<void> {
  const config = await loadConfig();
  logger.info(`watching ${config.source.root}`);

  const close = watchConfig(config, (event) => {
    if (event.type === "error") logger.error(event.message);
    else if (event.type === "sync") logger.success(event.message);
    else logger.info(event.message);
  });

  const shutdown = async () => {
    await close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}
