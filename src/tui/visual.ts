import { palette } from "./theme/palette.js";
import { symbols } from "./theme/symbols.js";
import { hex, hexBg } from "./theme/styles.js";

export type Tone = "success" | "warn" | "danger" | "accent" | "watch" | "muted" | "primary";

export type TableColumn<T> = {
  title: string;
  width: number;
  render: (row: T) => string;
  align?: "left" | "right" | "center";
};

export type DashboardEventLike = {
  level: "info" | "success" | "warn" | "error";
  message: string;
};

export function stripTags(text: string): string {
  return text.replace(/\{[^}]*\}/g, "");
}

export function visibleLength(text: string): number {
  return stripTags(text).length;
}

export function fitText(text: string, width: number): string {
  if (width <= 0) return "";
  if (text.length <= width) return text;
  if (width <= 3) return text.slice(0, width);
  return `${text.slice(0, Math.max(0, width - 3))}...`;
}

export function fitTagged(text: string, width: number): string {
  if (visibleLength(text) <= width) return text;
  return fitText(stripTags(text), width);
}

export function padEndTagged(text: string, width: number): string {
  const fitted = fitTagged(text, width);
  return fitted + " ".repeat(Math.max(0, width - visibleLength(fitted)));
}

export function padStartTagged(text: string, width: number): string {
  const fitted = fitTagged(text, width);
  return " ".repeat(Math.max(0, width - visibleLength(fitted))) + fitted;
}

export function padCenterTagged(text: string, width: number): string {
  const fitted = fitTagged(text, width);
  const pad = Math.max(0, width - visibleLength(fitted));
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + fitted + " ".repeat(pad - left);
}

export function toneColor(tone: Tone): string {
  switch (tone) {
    case "success": return palette.green;
    case "warn": return palette.yellow;
    case "danger": return palette.red;
    case "watch": return palette.magenta;
    case "accent": return palette.cyan;
    case "primary": return palette.white;
    case "muted": return palette.gray;
  }
}

export function statusBadge(label: string, tone: Tone = toneForStatus(label)): string {
  return hex(`[${label.toUpperCase()}]`, toneColor(tone));
}

export function toneForStatus(label: string): Tone {
  const normalized = label.toUpperCase();
  if (["READY", "SYNCED", "ACTIVE", "OK"].includes(normalized)) return "success";
  if (["DRIFT", "PENDING", "WARN", "WARNING"].includes(normalized)) return "warn";
  if (["ERROR", "ATTENTION", "FAILED"].includes(normalized)) return "danger";
  if (["WATCH", "WATCHING", "LIVE"].includes(normalized)) return "watch";
  return "accent";
}

export function boxedLines(
  title: string,
  width: number,
  content: string[],
  options: { subtitle?: string; borderTone?: Tone; titleTone?: Tone } = {}
): string[] {
  const boxWidth = Math.max(16, width);
  const titleText = fitText(title.toUpperCase(), Math.max(4, boxWidth - 8));
  const borderColor = toneColor(options.borderTone ?? "accent");
  const titleColor = toneColor(options.titleTone ?? "accent");
  const fill = Math.max(1, boxWidth - titleText.length - 5);
  const inner = Math.max(1, boxWidth - 4);
  const lines = [
    `${hex(`${symbols.tl}${symbols.h} `, borderColor)}${hex(titleText, titleColor)}${hex(` ${symbols.h.repeat(fill)}${symbols.tr}`, borderColor)}`,
  ];

  if (options.subtitle) {
    lines.push(boxContentLine(hex(fitText(options.subtitle, inner), palette.gray), inner, borderColor));
    lines.push(boxDivider(boxWidth, borderColor));
  }

  for (const line of content) {
    lines.push(boxContentLine(line, inner, borderColor));
  }

  lines.push(hex(`${symbols.bl}${symbols.h.repeat(Math.max(0, boxWidth - 2))}${symbols.br}`, borderColor));
  return lines;
}

export function boxDivider(width: number, color: string = palette.cyanDim): string {
  return hex(`${symbols.lj}${symbols.h.repeat(Math.max(0, width - 2))}${symbols.rj}`, color);
}

export function mutedDivider(width: number): string {
  return hex(symbols.h.repeat(Math.max(0, width)), palette.grayDark);
}

export function keyValueLine(label: string, value: string, width: number): string {
  const labelWidth = Math.min(18, Math.max(10, Math.floor(width * 0.34)));
  const valueWidth = Math.max(1, width - labelWidth - 2);
  return `${hex(padEndTagged(label, labelWidth), palette.gray)}  ${hex(fitText(value, valueWidth), palette.white)}`;
}

export function tableLines<T>(
  columns: TableColumn<T>[],
  rows: T[],
  activeIndex = -1,
  active = false
): string[] {
  const header = columns
    .map((column) => alignCell(hex(column.title.toUpperCase(), palette.gray), column.width, column.align))
    .join(" ");
  const lines = [header, hex(symbols.h.repeat(visibleLength(header)), palette.grayDark)];

  for (let i = 0; i < rows.length; i++) {
    const row = columns
      .map((column) => alignCell(column.render(rows[i]), column.width, column.align))
      .join(" ");
    lines.push(active && i === activeIndex ? hexBg(` ${row} `, palette.cyan, palette.bg) : row);
  }

  return lines;
}

export function hstack(blocks: string[][], gap = 2): string[] {
  const heights = blocks.map((block) => block.length);
  const maxHeight = Math.max(0, ...heights);
  const widths = blocks.map(blockWidth);
  const lines: string[] = [];

  for (let row = 0; row < maxHeight; row++) {
    lines.push(
      blocks
        .map((block, index) => padEndTagged(block[row] ?? "", widths[index]))
        .join(" ".repeat(gap))
    );
  }

  return lines;
}

export function wrapBlocks(blocks: string[][], maxWidth: number, gap = 1): string[] {
  const rows: string[][][] = [];
  let current: string[][] = [];
  let currentWidth = 0;

  for (const block of blocks) {
    const width = blockWidth(block);
    const nextWidth = current.length === 0 ? width : currentWidth + gap + width;
    if (current.length > 0 && nextWidth > maxWidth) {
      rows.push(current);
      current = [block];
      currentWidth = width;
    } else {
      current.push(block);
      currentWidth = nextWidth;
    }
  }

  if (current.length > 0) rows.push(current);
  return rows.flatMap((row, index) => {
    const stacked = hstack(row, gap);
    return index === rows.length - 1 ? stacked : [...stacked, ""];
  });
}

export function blockWidth(block: string[]): number {
  return Math.max(0, ...block.map(visibleLength));
}

export function eventDisplayLabel(event: DashboardEventLike): { label: string; tone: Tone } {
  const message = event.message.toLowerCase();
  if (event.level === "error") return { label: "ERROR", tone: "danger" };
  if (event.level === "warn") return { label: "WARN", tone: "warn" };
  if (message.includes("watch")) return { label: "WATCH", tone: "watch" };
  if (message.includes("sync") || message.includes("updated") || message.includes("materializ")) {
    return { label: "SYNC", tone: "success" };
  }
  if (event.level === "success") return { label: "OK", tone: "success" };
  return { label: "INFO", tone: "accent" };
}

export function emptyState(title: string, body: string, width: number): string[] {
  return boxedLines(title, width, [
    hex(body, palette.gray),
    "",
    hex("Use Settings or add source files to populate this panel.", palette.whiteDim),
  ], { borderTone: "muted" });
}

function boxContentLine(line: string, innerWidth: number, borderColor: string): string {
  return `${hex(symbols.v, borderColor)} ${padEndTagged(line, innerWidth)} ${hex(symbols.v, borderColor)}`;
}

function alignCell(
  text: string,
  width: number,
  align: "left" | "right" | "center" = "left"
): string {
  if (align === "right") return padStartTagged(text, width);
  if (align === "center") return padCenterTagged(text, width);
  return padEndTagged(text, width);
}
