import fs from "fs-extra";
import path from "node:path";

export async function pathExists(filePath: string): Promise<boolean> {
  return fs.pathExists(filePath);
}

export async function ensureParentDir(filePath: string): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
}

export async function readTextIfExists(filePath: string): Promise<string | undefined> {
  if (!(await fs.pathExists(filePath))) {
    return undefined;
  }
  return fs.readFile(filePath, "utf8");
}
