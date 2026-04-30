import os from "node:os";
import path from "node:path";

export const defaultAgentHubRoot = "~/.agenthub";
export const defaultWorkspaceRoot = "/Users/lucionigro/Repository";

export function expandHome(input: string): string {
  if (input === "~") {
    return os.homedir();
  }
  if (input.startsWith("~/")) {
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}

export function resolvePath(input: string, base?: string): string {
  const expanded = expandHome(input);
  if (path.isAbsolute(expanded)) {
    return path.normalize(expanded);
  }
  return path.resolve(base ? expandHome(base) : process.cwd(), expanded);
}

export function toDisplayPath(input: string): string {
  const home = os.homedir();
  return input.startsWith(home) ? `~${input.slice(home.length)}` : input;
}

export function backupRelativePath(targetPath: string): string {
  const expanded = resolvePath(targetPath);
  const parsed = path.parse(expanded);
  return path.join(parsed.root.replaceAll(path.sep, ""), expanded.slice(parsed.root.length));
}
