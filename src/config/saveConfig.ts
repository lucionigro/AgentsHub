import type { AgentHubConfig } from "./schema.js";
import { resolvePath } from "./paths.js";
import { writeYamlFile } from "../utils/yaml.js";

export async function saveConfig(config: AgentHubConfig, configPath: string): Promise<void> {
  await writeYamlFile(resolvePath(configPath), config);
}
