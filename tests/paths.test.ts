import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { expandHome, resolvePath } from "../src/config/paths.js";

describe("paths", () => {
  it("expands home paths", () => {
    expect(expandHome("~")).toBe(os.homedir());
    expect(expandHome("~/x")).toBe(path.join(os.homedir(), "x"));
  });

  it("resolves relative paths from a base", () => {
    expect(resolvePath("memory/global.md", "/tmp/agenthub")).toBe("/tmp/agenthub/memory/global.md");
  });
});
