import { loadConfig } from "../../config/loadConfig.js";
import { pushConfig } from "../../core/sync.js";
import { logger } from "../../utils/logger.js";

export async function pushCommand(): Promise<void> {
  const config = await loadConfig();
  const summary = await pushConfig(config);
  logger.success(`push complete: ${summary.changed} changed, ${summary.unchanged} unchanged, ${summary.skipped} skipped`);
  const imports = summary.skillImports;
  const importChanges = imports.imported + imports.updated + imports.failed + imports.skipped;
  if (importChanges > 0) {
    logger.info(
      `skills: ${imports.imported} imported, ${imports.updated} updated, ${imports.unchanged} unchanged, ${imports.skipped} skipped, ${imports.failed} failed`
    );
  }
  for (const warning of imports.warnings.slice(0, 5)) {
    logger.warn(warning);
  }
  if (summary.backups.length > 0) {
    logger.info(`${summary.backups.length} backup(s) created`);
  }
}
