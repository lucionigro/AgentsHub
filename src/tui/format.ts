import type { ReadinessState } from "./state.js";

export type Tone = "success" | "warn" | "danger" | "muted" | "accent" | "secondary";

export function color(text: string, fg: string): string {
  return `{${fg}-fg}${text}{/${fg}-fg}`;
}

export function statusPill(label: string, tone: Tone = "muted"): string {
  const fgMap: Record<Tone, string> = {
    success: "green",
    warn: "yellow",
    danger: "red",
    muted: "gray",
    accent: "cyan",
    secondary: "blue",
  };
  return color(`[${label}]`, fgMap[tone]);
}

export function targetTone(input: { exists: boolean; synced: boolean }): "success" | "warn" {
  if (!input.exists) return "warn";
  return input.synced ? "success" : "warn";
}

export function targetLabel(input: { exists: boolean; synced: boolean }): string {
  if (!input.exists) return "PENDING";
  return input.synced ? "OK" : "DRIFT";
}

export function policyLabel(input: { exists: boolean; synced: boolean }): string {
  return targetLabel(input);
}

export function compactStatus(input: { exists: boolean; synced: boolean }): {
  label: "OK" | "DRIFT" | "PENDING";
  tone: "success" | "warn";
} {
  if (!input.exists) return { label: "PENDING", tone: "warn" };
  if (!input.synced) return { label: "DRIFT", tone: "warn" };
  return { label: "OK", tone: "success" };
}

export function healthTone(score: number): "success" | "warn" | "danger" {
  if (score >= 80) return "success";
  if (score >= 50) return "warn";
  return "danger";
}

export const postureTone = healthTone;

export function readinessLabel(state: ReadinessState): string {
  switch (state) {
    case "ready": return "Ready";
    case "pending": return "Needs Materialization";
    case "drift": return "Drift Detected";
    case "attention": return "Attention Required";
  }
}

export function readinessTone(state: ReadinessState): Tone {
  switch (state) {
    case "ready": return "success";
    case "pending": return "warn";
    case "drift": return "warn";
    case "attention": return "danger";
  }
}

export function compactPath(filePath: string, maxLength: number): string {
  if (filePath.length <= maxLength) return filePath;
  if (maxLength <= 8) return filePath.slice(0, maxLength);
  const keepStart = Math.max(3, Math.floor((maxLength - 3) * 0.35));
  const keepEnd = Math.max(3, maxLength - keepStart - 3);
  return `${filePath.slice(0, keepStart)}...${filePath.slice(filePath.length - keepEnd)}`;
}

export const truncateMiddle = compactPath;

export function relativeTime(input?: string): string {
  if (!input) return "-";
  const timestamp = new Date(input).getTime();
  if (Number.isNaN(timestamp)) return "-";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function metricCard(
  title: string,
  value: string,
  caption: string,
  tone: "success" | "warn" | "danger" | "accent" = "accent"
): string {
  const fgMap: Record<string, string> = {
    success: "green", warn: "yellow", danger: "red", accent: "cyan",
  };
  const fg = fgMap[tone] ?? "cyan";
  return `${color(title, "gray")}\n${color(value, fg)}\n${color(caption, "gray")}`;
}

export function monoMetric(title: string, value: string, caption: string, tone: Tone = "muted"): string {
  return metricCard(title, value, caption, tone as "success" | "warn" | "danger" | "accent");
}

export function entityLine(parts: {
  label: string;
  tone: Tone;
  primary: string;
  secondary?: string;
  meta?: string;
}): string {
  const pill = statusPill(parts.label, parts.tone);
  const sec = parts.secondary ? ` ${parts.secondary}` : "";
  const mt = parts.meta ? ` ${parts.meta}` : "";
  return `${pill} ${parts.primary}${sec}${mt}`;
}

import type { DashboardEvent } from "./state.js";

export function eventLine(event: DashboardEvent): string {
  return `${event.time}  [${event.level.toUpperCase()}]  ${event.message}`;
}

export function actionPrompt(input: { pending: number; drift: number; errors: number }): string {
  const parts: string[] = [];
  if (input.pending > 0) parts.push(`${input.pending} pending`);
  if (input.drift > 0) parts.push(`${input.drift} drift`);
  if (input.errors > 0) parts.push(`${input.errors} errors`);
  if (parts.length === 0) return "System in policy";
  return parts.join(", ");
}

export function panelTitle(text: string): string {
  return ` ${text} `;
}
