import { loadConfig } from "../../config/loadConfig.js";
import { toDisplayPath } from "../../config/paths.js";
import { listProviders } from "../../providers/registry.js";
import { getStatus } from "../../core/sync.js";

export async function statusCommand(): Promise<void> {
  const config = await loadConfig();
  const statuses = await getStatus(config);

  process.stdout.write("AgentHub Status\n");
  process.stdout.write("Providers:\n");
  for (const provider of listProviders()) {
    const enabled = config.providers[provider.id as keyof typeof config.providers]?.enabled;
    process.stdout.write(`${enabled ? "✓" : "-"} ${provider.displayName}\n`);
  }

  process.stdout.write("Workspaces:\n");
  for (const workspace of config.workspaces) {
    process.stdout.write(`✓ ${workspace.name} ${workspace.path}\n`);
  }

  process.stdout.write("Targets:\n");
  for (const status of statuses) {
    const prefix = status.synced ? "✓" : status.exists ? "!" : "-";
    const text = status.synced ? "synced" : status.exists ? "differs" : "missing";
    process.stdout.write(`${prefix} ${toDisplayPath(status.path)} ${text}\n`);
  }

  if (config.state?.lastSync) {
    process.stdout.write(`Last sync: ${config.state.lastSync}\n`);
  }
}
