import { z } from "zod";

export const providerIdSchema = z.enum(["claude", "codex", "opencode"]);
export type ProviderId = z.infer<typeof providerIdSchema>;

export const writeModeSchema = z.enum(["managed", "append-block"]);
export type WriteMode = z.infer<typeof writeModeSchema>;

export const targetTypeSchema = z.enum(["instructions", "skills", "mcp"]);
export type TargetType = z.infer<typeof targetTypeSchema>;

export const scopeSchema = z.enum(["global", "workspace", "project", "mixed"]);
export type TargetScope = z.infer<typeof scopeSchema>;

export const sourceSchema = z.object({
  root: z.string(),
  memoryDir: z.string(),
  skillsDir: z.string(),
  mcpFile: z.string()
});

export const workspaceSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  mode: z.enum(["workspace-root", "per-project", "mixed"])
});

export const providerConfigSchema = z.object({
  enabled: z.boolean().default(true)
});

export const targetDefinitionSchema = z.object({
  id: z.string().min(1),
  provider: providerIdSchema,
  type: targetTypeSchema,
  scope: scopeSchema,
  workspace: z.string().optional(),
  project: z.string().optional(),
  path: z.string().min(1),
  writeMode: writeModeSchema,
  includes: z.array(z.string()).default([])
});

export const agentHubConfigSchema = z.object({
  version: z.literal(1),
  profile: z.string().default("default"),
  source: sourceSchema,
  workspaces: z.array(workspaceSchema).default([]),
  providers: z.object({
    claude: providerConfigSchema.default({ enabled: true }),
    codex: providerConfigSchema.default({ enabled: true }),
    opencode: providerConfigSchema.default({ enabled: true })
  }),
  targets: z.array(targetDefinitionSchema).default([]),
  state: z
    .object({
      lastSync: z.string().optional()
    })
    .optional()
});

export type AgentHubConfig = z.infer<typeof agentHubConfigSchema>;
export type TargetDefinition = z.infer<typeof targetDefinitionSchema>;

export const mcpServerSchema = z.object({
  enabled: z.boolean().default(true),
  type: z.enum(["local", "remote", "stdio", "http"]).optional(),
  command: z.string().optional(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).default({}),
  url: z.string().optional(),
  headers: z.record(z.string(), z.string()).default({}),
  timeout: z.number().optional()
});

export const mcpConfigSchema = z.object({
  servers: z.record(z.string(), mcpServerSchema).default({})
});

export type McpServer = z.infer<typeof mcpServerSchema>;
export type McpConfig = z.infer<typeof mcpConfigSchema>;
