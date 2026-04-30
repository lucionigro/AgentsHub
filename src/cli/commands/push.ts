import { loadConfig } from "../../config/loadConfig.js";
import { pushConfig } from "../../core/sync.js";
import { logger } from "../../utils/logger.js";

export async function pushCommand(): Promise<void> {
  const config = await loadConfig();
  const summary = await pushConfig(config);
  logger.success(`push complete: ${summary.changed} changed, ${summary.unchanged} unchanged, ${summary.skipped} skipped`);
  if (summary.backups.length > 0) {
    logger.info(`${summary.backups.length} backup(s) created`);
  }
}
