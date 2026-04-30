import { describe, expect, it } from "vitest";
import { palette } from "../src/tui/theme/palette.js";
import { hex } from "../src/tui/theme/styles.js";
import {
  boxedLines,
  eventDisplayLabel,
  statusBadge,
  visibleLength,
  wrapBlocks,
} from "../src/tui/visual.js";

describe("TUI visual helpers", () => {
  it("measures blessed tags without counting color markup", () => {
    expect(visibleLength(hex("AgentHub", palette.cyan))).toBe("AgentHub".length);
  });

  it("renders boxed cards at a stable visible width", () => {
    const lines = boxedLines("Skills", 34, [hex("Backend Skill", palette.white), ""]);
    expect(lines).toHaveLength(4);
    expect(lines.every((line) => visibleLength(line) === 34)).toBe(true);
  });

  it("wraps metric cards without exceeding the target row width", () => {
    const blocks = [
      boxedLines("Providers", 18, ["3/3"]),
      boxedLines("Targets", 18, ["4/4"]),
      boxedLines("MCP", 18, ["1/3"]),
    ];
    const lines = wrapBlocks(blocks, 38, 1);
    expect(lines.filter(Boolean).every((line) => visibleLength(line) <= 38)).toBe(true);
  });

  it("maps status badges to the expected cyberpunk tones", () => {
    expect(statusBadge("READY")).toContain(palette.green.replace("#", ""));
    expect(statusBadge("DRIFT")).toContain(palette.yellow.replace("#", ""));
    expect(statusBadge("ERROR")).toContain(palette.red.replace("#", ""));
    expect(statusBadge("WATCH")).toContain(palette.magenta.replace("#", ""));
    expect(statusBadge("OFF", "muted")).toContain(palette.gray.replace("#", ""));
  });

  it("derives compact activity labels from event level and message", () => {
    expect(eventDisplayLabel({ level: "success", message: "4 outputs synced" })).toEqual({ label: "SYNC", tone: "success" });
    expect(eventDisplayLabel({ level: "info", message: "Watching for changes..." })).toEqual({ label: "WATCH", tone: "watch" });
    expect(eventDisplayLabel({ level: "success", message: "System in policy" })).toEqual({ label: "OK", tone: "success" });
    expect(eventDisplayLabel({ level: "warn", message: "1 target drifted" })).toEqual({ label: "WARN", tone: "warn" });
  });
});
