import { describe, expect, it } from "vitest";
import { renderCodexMcp, renderOpenCodeMcpObject } from "../src/providers/mcp.js";
import type { McpConfig } from "../src/config/schema.js";

const mcp: McpConfig = {
  servers: {
    filesystem: {
      enabled: true,
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/repo"],
      env: {}
    },
    github: {
      enabled: false,
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: { GITHUB_TOKEN: "env:GITHUB_TOKEN" }
    },
    remote: {
      enabled: true,
      url: "https://example.com/mcp",
      args: [],
      env: {},
      headers: { Authorization: "env:API_TOKEN" }
    }
  }
};

describe("mcp renderers", () => {
  it("renders enabled Codex servers only", () => {
    const content = renderCodexMcp(mcp);
    expect(content).toContain("[mcp_servers.filesystem]");
    expect(content).toContain("command = \"npx\"");
    expect(content).not.toContain("github");
  });

  it("renders OpenCode local and remote servers with env references", () => {
    const content = renderOpenCodeMcpObject(mcp);
    expect(content).toEqual({
      filesystem: {
        type: "local",
        command: ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/repo"],
        enabled: true
      },
      remote: {
        type: "remote",
        url: "https://example.com/mcp",
        enabled: true,
        headers: { Authorization: "{env:API_TOKEN}" }
      }
    });
  });
});
