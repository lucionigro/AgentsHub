import { Command } from "commander";
import { statusCommand } from "./commands/status.js";
import { pushCommand } from "./commands/push.js";
import { diffCommand } from "./commands/diff.js";
import { watchCommand } from "./commands/watch.js";
import { tuiCommand } from "./commands/tui.js";

export type ProgramOptions = {
  defaultAction?: () => Promise<void>;
};

export function createProgram(options: ProgramOptions = {}): Command {
  const program = new Command();
  const defaultAction = options.defaultAction ?? tuiCommand;

  program
    .name("agenthub")
    .description("Live terminal hub for AI-agent instructions, skills, and MCP configs.")
    .version("0.1.0")
    .action(() => run(defaultAction));

  program.command("status").description("Show providers, workspaces, targets, and sync state").action(() => run(statusCommand));
  program.command("push").description("Render configured targets").action(() => run(pushCommand));
  program.command("diff").description("Show target differences without writing").action(() => run(diffCommand));
  program.command("watch").description("Watch source files and sync on changes").action(() => run(watchCommand));
  program.command("tui").description("Open the live terminal dashboard").action(() => run(tuiCommand));

  return program;
}

async function run(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    reportError(error);
    process.exitCode = 1;
  }
}

function reportError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`x ${message}\n`);
}
