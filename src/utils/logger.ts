export type LogLevel = "info" | "warn" | "error" | "success";

const prefixes: Record<LogLevel, string> = {
  info: "i",
  warn: "!",
  error: "x",
  success: "✓"
};

export function log(level: LogLevel, message: string): void {
  const stream = level === "error" ? process.stderr : process.stdout;
  stream.write(`${prefixes[level]} ${message}\n`);
}

export const logger = {
  info: (message: string) => log("info", message),
  warn: (message: string) => log("warn", message),
  error: (message: string) => log("error", message),
  success: (message: string) => log("success", message)
};
