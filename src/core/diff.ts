import fs from "fs-extra";
import { createTwoFilesPatch } from "diff";
import { resolvePath } from "../config/paths.js";
import type { RenderedFile } from "../providers/types.js";
import { prepareNextContent } from "./fileWriter.js";

export async function diffRenderedFile(rendered: RenderedFile): Promise<string> {
  const targetPath = resolvePath(rendered.path);
  const existing = (await fs.pathExists(targetPath)) ? await fs.readFile(targetPath, "utf8") : "";
  const next = prepareNextContent(rendered, existing || undefined);
  if (existing === next) {
    return "";
  }
  return createTwoFilesPatch(targetPath, `${targetPath} (agenthub)`, existing, next);
}
