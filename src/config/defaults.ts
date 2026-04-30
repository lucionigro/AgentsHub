import fs from "fs-extra";
import path from "node:path";
import YAML from "yaml";
import type { AgentHubConfig, McpConfig, ProviderId, WriteMode } from "./schema.js";
import { defaultWorkspaceRoot, resolvePath } from "./paths.js";
import { getProvider } from "../providers/registry.js";
import { saveConfig } from "./saveConfig.js";

export type InitOptions = {
  root: string;
  configPath?: string;
  workspaceRoot?: string;
  providers?: ProviderId[];
  defaultWriteMode?: WriteMode;
  overwrite?: boolean;
};

const memoryFiles: Record<string, string> = {
  "global.md": `# Global Memory

Shared guidance that every coding agent should load.
`,
  "coding-style.md": `# Coding Style

- Prefer clear, typed, maintainable code.
- Follow the conventions already present in the target project.
`,
  "workflow.md": `# Workflow

- Understand the repository before making broad changes.
- Validate changes with the narrowest useful test command.
`
};

const skillFiles: Record<string, string> = {
  "backend.md": `# Backend Skill

Use existing backend architecture, schemas, and tests before introducing new patterns.
`,
  "frontend.md": `# Frontend Skill

Keep user workflows efficient, accessible, and consistent with the existing design system.
`,
  "sql.md": `# SQL Skill

Prefer explicit schema-aware queries and safe migrations.
`,
  "debugging.md": `# Debugging Skill

Reproduce the failure, isolate the layer, and verify the fix.
`
};

const templateFiles: Record<string, string> = {
  "claude/instructions.md.hbs": `# Claude Code Instructions

{{#each sections}}
## {{title}}

{{content}}
{{/each}}
`,
  "codex/agents.md.hbs": `# AGENTS.md

{{#each sections}}
## {{title}}

{{content}}
{{/each}}
`,
  "codex/config.toml.hbs": `{{content}}`,
  "opencode/agents.md.hbs": `# OpenCode Instructions

{{#each sections}}
## {{title}}

{{content}}
{{/each}}
`,
  "opencode/config.json.hbs": `{{content}}`
};

export function createDefaultMcpConfig(workspaceRoot = defaultWorkspaceRoot): McpConfig {
  return {
    servers: {
      filesystem: {
        enabled: true,
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", workspaceRoot],
        env: {},
        headers: {}
      },
      github: {
        enabled: false,
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: {
          GITHUB_TOKEN: "env:GITHUB_TOKEN"
        },
        headers: {}
      },
      postgres: {
        enabled: false,
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost:5432/app"],
        env: {},
        headers: {}
      }
    }
  };
}

export async function createSourceTree(options: InitOptions): Promise<AgentHubConfig> {
  const root = resolvePath(options.root);
  const workspaceRoot = options.workspaceRoot ?? defaultWorkspaceRoot;
  const providers = options.providers ?? ["claude", "codex", "opencode"];
  const defaultWriteMode = options.defaultWriteMode ?? "managed";

  await fs.ensureDir(root);
  await fs.ensureDir(path.join(root, "memory"));
  await fs.ensureDir(path.join(root, "skills"));
  await fs.ensureDir(path.join(root, "mcp"));
  await fs.ensureDir(path.join(root, "templates"));
  await fs.ensureDir(path.join(root, "backups"));

  for (const [name, content] of Object.entries(memoryFiles)) {
    await writeDefault(path.join(root, "memory", name), content, options.overwrite);
  }
  for (const [name, content] of Object.entries(skillFiles)) {
    await writeDefault(path.join(root, "skills", name), content, options.overwrite);
  }
  for (const [name, content] of Object.entries(templateFiles)) {
    await writeDefault(path.join(root, "templates", name), content, options.overwrite);
  }
  await writeDefault(path.join(root, "mcp", "servers.yml"), YAML.stringify(createDefaultMcpConfig(workspaceRoot)), options.overwrite);

  const partialConfig: AgentHubConfig = {
    version: 1,
    profile: "default",
    source: {
      root,
      memoryDir: path.join(root, "memory"),
      skillsDir: path.join(root, "skills"),
      mcpFile: path.join(root, "mcp", "servers.yml")
    },
    workspaces: [{ name: "main", path: workspaceRoot, mode: "workspace-root" }],
    providers: {
      claude: { enabled: providers.includes("claude") },
      codex: { enabled: providers.includes("codex") },
      opencode: { enabled: providers.includes("opencode") }
    },
    targets: []
  };

  for (const providerId of providers) {
    const adapter = getProvider(providerId);
    const targets = await adapter.getDefaultTargets({ config: partialConfig, workspaceRoot, defaultWriteMode });
    partialConfig.targets.push(...targets);
  }

  await saveConfig(partialConfig, options.configPath ?? path.join(root, "config.yml"));
  return partialConfig;
}

async function writeDefault(filePath: string, content: string, overwrite = false): Promise<void> {
  if (!overwrite && (await fs.pathExists(filePath))) {
    return;
  }
  await fs.outputFile(filePath, content, "utf8");
}
