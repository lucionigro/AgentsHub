import fs from "fs-extra";
import path from "node:path";
import { backupRelativePath, resolvePath } from "../config/paths.js";

export async function createBackup(targetPath: string, backupRoot: string, timestamp: string): Promise<string | undefined> {
  const expandedTarget = resolvePath(targetPath);
  if (!(await fs.pathExists(expandedTarget))) {
    return undefined;
  }

  const backupPath = path.join(resolvePath(backupRoot), timestamp, backupRelativePath(expandedTarget));
  await fs.ensureDir(path.dirname(backupPath));
  await fs.copyFile(expandedTarget, backupPath);
  return backupPath;
}
