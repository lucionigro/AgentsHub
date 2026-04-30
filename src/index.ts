#!/usr/bin/env node
import { createProgram } from "./cli/program.js";

createProgram().parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`x ${message}\n`);
  process.exitCode = 1;
});
