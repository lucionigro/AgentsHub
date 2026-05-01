import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { describe, expect, it } from "vitest";
import { defaultWorkspaceRoot, expandHome, resolvePath } from "../src/config/paths.js";

describe("paths", () => {
  it("expands home paths", () => {
    expect(expandHome("~")).toBe(os.homedir());
    expect(expandHome("~/x")).toBe(path.join(os.homedir(), "x"));
  });

  it("resolves relative paths from a base", () => {
    expect(resolvePath("memory/global.md", "/tmp/agenthub")).toBe("/tmp/agenthub/memory/global.md");
  });

  it("uses AGENTHUB_WORKSPACE as the portable default workspace when present", () => {
    const previous = process.env.AGENTHUB_WORKSPACE;
    process.env.AGENTHUB_WORKSPACE = "~/agenthub-workspace-test";
    try {
      expect(defaultWorkspaceRoot()).toBe(path.join(os.homedir(), "agenthub-workspace-test"));
    } finally {
      if (previous === undefined) {
        delete process.env.AGENTHUB_WORKSPACE;
      } else {
        process.env.AGENTHUB_WORKSPACE = previous;
      }
    }
  });

  it("falls back to the current working directory for new teammates", async () => {
    const previousEnv = process.env.AGENTHUB_WORKSPACE;
    const previousCwd = process.cwd();
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "agenthub-workspace-"));
    delete process.env.AGENTHUB_WORKSPACE;
    try {
      process.chdir(tmp);
      expect(defaultWorkspaceRoot()).toBe(await fs.realpath(tmp));
    } finally {
      process.chdir(previousCwd);
      if (previousEnv === undefined) {
        delete process.env.AGENTHUB_WORKSPACE;
      } else {
        process.env.AGENTHUB_WORKSPACE = previousEnv;
      }
    }
  });
});
