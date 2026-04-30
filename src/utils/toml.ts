import toml from "@iarna/toml";

export function stringifyToml(data: Record<string, unknown>): string {
  return toml.stringify(data as never);
}
