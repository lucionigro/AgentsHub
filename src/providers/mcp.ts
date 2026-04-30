import type { McpConfig, McpServer } from "../config/schema.js";

export function enabledServers(mcp: McpConfig): Array<[string, McpServer]> {
  return Object.entries(mcp.servers).filter(([, server]) => server.enabled !== false);
}

export function codexEnvValue(value: string): string {
  if (value.startsWith("env:")) {
    return `\${${value.slice(4)}}`;
  }
  return value;
}

export function opencodeEnvValue(value: string): string {
  if (value.startsWith("env:")) {
    return `{env:${value.slice(4)}}`;
  }
  return value;
}

export function renderCodexMcp(mcp: McpConfig): string {
  const lines: string[] = [];
  for (const [name, server] of enabledServers(mcp)) {
    lines.push(`[mcp_servers.${name}]`);
    if (server.url) {
      lines.push(`url = ${JSON.stringify(server.url)}`);
    }
    if (server.command) {
      lines.push(`command = ${JSON.stringify(server.command)}`);
      if (server.args.length > 0) {
        lines.push(`args = ${JSON.stringify(server.args)}`);
      }
    }
    const envEntries = Object.entries(server.env);
    if (envEntries.length > 0) {
      const env = Object.fromEntries(envEntries.map(([key, value]) => [key, codexEnvValue(value)]));
      lines.push(`env = ${JSON.stringify(env)}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}

export function renderOpenCodeMcpObject(mcp: McpConfig): Record<string, unknown> {
  const rendered: Record<string, unknown> = {};
  for (const [name, server] of enabledServers(mcp)) {
    if (server.url) {
      rendered[name] = {
        type: "remote",
        url: server.url,
        enabled: true,
        ...(Object.keys(server.headers).length > 0
          ? {
              headers: Object.fromEntries(
                Object.entries(server.headers).map(([key, value]) => [key, opencodeEnvValue(value)])
              )
            }
          : {}),
        ...(server.timeout ? { timeout: server.timeout } : {})
      };
      continue;
    }

    if (!server.command) {
      continue;
    }

    rendered[name] = {
      type: "local",
      command: [server.command, ...server.args],
      enabled: true,
      ...(Object.keys(server.env).length > 0
        ? {
            environment: Object.fromEntries(
              Object.entries(server.env).map(([key, value]) => [key, opencodeEnvValue(value)])
            )
          }
        : {}),
      ...(server.timeout ? { timeout: server.timeout } : {})
    };
  }
  return rendered;
}
