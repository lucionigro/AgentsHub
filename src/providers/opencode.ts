import fs from "fs-extra";
import Handlebars from "handlebars";
import { defaultWorkspaceRoot } from "../config/paths.js";
import type { TargetDefinition } from "../config/schema.js";
import { renderOpenCodeMcpObject } from "./mcp.js";
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

export const opencodeAdapter: ProviderAdapter = {
  id: "opencode",
  displayName: "OpenCode",

  async detect() {
    return { installed: await fs.pathExists(`${process.env.HOME ?? ""}/.config/opencode`) };
  },

  async getDefaultTargets(context: ProviderTargetContext) {
    const workspaceRoot = context.workspaceRoot ?? defaultWorkspaceRoot();
    const targetDefinitions: TargetDefinition[] = [];

    if (!context.config.providers.codex.enabled) {
      targetDefinitions.push({
        id: "opencode-workspace-agents",
        provider: "opencode" as const,
        type: "instructions" as const,
        scope: "workspace" as const,
        workspace: "main",
        path: `${workspaceRoot}/AGENTS.md`,
        writeMode: context.defaultWriteMode,
        includes: ["memory/global.md", "memory/coding-style.md", "memory/workflow.md", "skills/backend.md"]
      });
    }

    targetDefinitions.push(
      {
        id: "opencode-global-config",
        provider: "opencode",
        type: "mcp",
        scope: "global",
        path: "~/.config/opencode/opencode.json",
        writeMode: "append-block",
        includes: []
      }
    );
    return targetDefinitions;
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
    const workspaceRoot = workspace?.path ?? defaultWorkspaceRoot();
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
