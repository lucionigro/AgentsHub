import fs from "fs-extra";
import Handlebars from "handlebars";
import { defaultWorkspaceRoot } from "../config/paths.js";
import { renderCodexMcp } from "./mcp.js";
import type {
  McpRenderContext,
  ProviderAdapter,
  ProviderTargetContext,
  RenderContext,
  RenderedFile
} from "./types.js";

const instructionsTemplate = `# AGENTS.md

{{#each sections}}
## {{title}}

{{content}}
{{/each}}
`;

export const codexAdapter: ProviderAdapter = {
  id: "codex",
  displayName: "Codex",

  async detect() {
    return { installed: await fs.pathExists(`${process.env.HOME ?? ""}/.codex`) };
  },

  async getDefaultTargets(context: ProviderTargetContext) {
    const workspaceRoot = context.workspaceRoot ?? defaultWorkspaceRoot;
    return [
      {
        id: "codex-workspace-agents",
        provider: "codex",
        type: "instructions",
        scope: "workspace",
        workspace: "main",
        path: `${workspaceRoot}/AGENTS.md`,
        writeMode: context.defaultWriteMode,
        includes: ["memory/global.md", "memory/coding-style.md", "memory/workflow.md", "skills/backend.md"]
      },
      {
        id: "codex-global-config",
        provider: "codex",
        type: "mcp",
        scope: "global",
        path: "~/.codex/config.toml",
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
    return [
      {
        path: context.target.path,
        content: renderCodexMcp(context.mcp),
        writeMode: context.target.writeMode,
        format: "toml"
      }
    ];
  }
};
