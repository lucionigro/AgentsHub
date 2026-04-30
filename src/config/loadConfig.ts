import { agentHubConfigSchema, type AgentHubConfig, mcpConfigSchema, type McpConfig } from "./schema.js";
import { defaultAgentHubRoot, expandHome, resolvePath } from "./paths.js";
import { readYamlFile } from "../utils/yaml.js";

export function getAgentHubRoot(): string {
  return resolvePath(process.env.AGENTHUB_HOME ?? defaultAgentHubRoot);
}

export function getConfigPath(): string {
  return resolvePath(process.env.AGENTHUB_CONFIG ?? `${getAgentHubRoot()}/config.yml`);
}

export async function loadConfig(configPath = getConfigPath()): Promise<AgentHubConfig> {
  const raw = await readYamlFile<unknown>(expandHome(configPath));
  return agentHubConfigSchema.parse(raw);
}

export async function loadMcpConfig(config: AgentHubConfig): Promise<McpConfig> {
  const raw = await readYamlFile<unknown>(resolvePath(config.source.mcpFile));
  return mcpConfigSchema.parse(raw);
}
