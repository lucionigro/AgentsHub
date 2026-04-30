import fs from "fs-extra";
import Handlebars from "handlebars";
import { defaultWorkspaceRoot } from "../config/paths.js";
import { renderOpenCodeMcpObject } from "./mcp.js";
import type {
  McpRenderContext,
  ProviderAdapter,
  ProviderTargetContext,
  RenderContext,
  RenderedFile
} from "./types.js";

const instructionsTemplate = `# OpenCode Instructions

{{#each sections}}
## {{title}}

{{content}}
{{/each}}
`;

export const opencodeAdapter: ProviderAdapter = {
  id: "opencode",
  displayName: "OpenCode",

  async detect() {
    return { installed: await fs.pathExists(`${process.env.HOME ?? ""}/.config/opencode`) };
  },

  async getDefaultTargets(context: ProviderTargetContext) {
    return [
      {
        id: "opencode-global-config",
        provider: "opencode",
        type: "mcp",
        scope: "global",
        path: "~/.config/opencode/opencode.json",
        writeMode: "append-block",
        includes: []
      }
    ];
  },

  async renderInstructions(context: RenderContext): Promise<RenderedFile[]> {
    const compile = Handlebars.compile(instructionsTemplate);
    return [
      {
        path: context.target.path,
        content: compile({ sections: context.sections }),
        writeMode: context.target.writeMode,
        format: "text"
      }
    ];
  },

  async renderMcp(context: McpRenderContext): Promise<RenderedFile[]> {
    const workspace = context.config.workspaces.find((entry) => entry.name === "main");
    const workspaceRoot = workspace?.path ?? defaultWorkspaceRoot;
    const content = JSON.stringify(
      {
        $schema: "https://opencode.ai/config.json",
        instructions: [`${workspaceRoot}/AGENTS.md`],
        mcp: renderOpenCodeMcpObject(context.mcp)
      },
      null,
      2
    );
    return [
      {
        path: context.target.path,
        content,
        writeMode: context.target.writeMode,
        format: "json",
        managedKeys: ["instructions", "mcp"]
      }
    ];
  }
};
