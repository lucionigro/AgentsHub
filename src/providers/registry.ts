import type { ProviderId } from "../config/schema.js";
import type { ProviderAdapter } from "./types.js";
import { claudeAdapter } from "./claude.js";
import { codexAdapter } from "./codex.js";
import { opencodeAdapter } from "./opencode.js";

const providers: Record<ProviderId, ProviderAdapter> = {
  claude: claudeAdapter,
  codex: codexAdapter,
  opencode: opencodeAdapter
};

export function getProvider(id: ProviderId): ProviderAdapter {
  return providers[id];
}

export function listProviders(): ProviderAdapter[] {
  return Object.values(providers);
}
