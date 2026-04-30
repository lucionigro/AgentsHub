import { describe, expect, it } from "vitest";
import { mergeJsonContent, prepareNextContent, replaceAppendBlock } from "../src/core/fileWriter.js";
import type { RenderedFile } from "../src/providers/types.js";

describe("fileWriter", () => {
  it("replaces only existing append blocks", () => {
    const existing = ["# Manual", "keep", "<!-- agenthub:start -->", "old", "<!-- agenthub:end -->", "tail"].join("\n");
    const next = replaceAppendBlock(existing, "new");
    expect(next).toContain("# Manual\nkeep");
    expect(next).toContain("<!-- agenthub:start -->\nnew\n<!-- agenthub:end -->");
    expect(next).toContain("tail");
    expect(next).not.toContain("old");
  });

  it("appends a block when markers do not exist", () => {
    const next = replaceAppendBlock("# Manual\nkeep\n", "generated");
    expect(next).toBe("# Manual\nkeep\n\n<!-- agenthub:start -->\ngenerated\n<!-- agenthub:end -->\n");
  });

  it("merges JSON by managed keys only", () => {
    const rendered: RenderedFile = {
      path: "/tmp/opencode.json",
      writeMode: "append-block",
      format: "json",
      managedKeys: ["mcp"],
      content: JSON.stringify({ $schema: "schema", mcp: { filesystem: { type: "local" } } })
    };
    const next = mergeJsonContent(rendered, JSON.stringify({ theme: "nord", mcp: { old: true } }));
    expect(JSON.parse(next)).toEqual({
      theme: "nord",
      mcp: { filesystem: { type: "local" } },
      $schema: "schema"
    });
  });

  it("managed content is stable for status comparisons", () => {
    const rendered: RenderedFile = { path: "/tmp/a", writeMode: "managed", content: "body", format: "text" };
    expect(prepareNextContent(rendered)).toBe(prepareNextContent(rendered));
  });
});
