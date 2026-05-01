import fs from "fs-extra";
import Handlebars from "handlebars";
import { defaultWorkspaceRoot } from "../config/paths.js";
import type { ProviderAdapter, ProviderTargetContext, RenderContext, RenderedFile } from "./types.js";

const template = `# Claude Code Instructions

{{#each sections}}
## {{title}}

{{content}}
{{/each}}
`;

export const claudeAdapter: ProviderAdapter = {
  id: "claude",
  displayName: "Claude Code",

  async detect() {
    return { installed: await fs.pathExists(`${process.env.HOME ?? ""}/.claude`) };
  },

  async getDefaultTargets(context: ProviderTargetContext) {
    const workspaceRoot = context.workspaceRoot ?? defaultWorkspaceRoot();
    return [
      {
        id: "claude-workspace-instructions",
        provider: "claude",
        type: "instructions",
        scope: "workspace",
        workspace: "main",
        path: `${workspaceRoot}/CLAUDE.md`,
        writeMode: context.defaultWriteMode,
        includes: ["memory/global.md", "memory/coding-style.md", "memory/workflow.md", "skills/backend.md"]
      }
    ];
  },

  async renderInstructions(context: RenderContext): Promise<RenderedFile[]> {
    const compile = Handlebars.compile(template);
    return [
      {
        path: context.target.path,
        content: compile({ sections: context.sections }),
        writeMode: context.target.writeMode,
        format: "text"
      }
    ];
  }
};
