import type { Widgets } from "neo-blessed";
import blessed from "neo-blessed";
import { palette } from "../theme/palette.js";
import { hex, hexBg } from "../theme/styles.js";

export type TextInputOptions = {
  label?: string;
  placeholder?: string;
  top?: number | string;
  left?: number | string;
  width?: number | string;
  height?: number | string;
};

export function createTextInput(
  screen: Widgets.Screen,
  options: TextInputOptions = {}
): Widgets.BoxElement {
  const label = options.label
    ? blessed.text({
        parent: screen,
        top: options.top ?? 0,
        left: options.left ?? 0,
        width: options.width ?? "100%",
        height: 1,
        tags: true,
        content: `  ${hex(options.label, palette.cyan)}`,
        style: {
          fg: palette.white,
          bg: palette.bgPanel,
        },
      })
    : null;

  const input = blessed.box({
    parent: screen,
    top: label ? (typeof options.top === "number" ? options.top + 1 : options.top) : (options.top ?? 0),
    left: options.left ?? 0,
    width: options.width ?? "100%",
    height: options.height ?? 3,
    border: { type: "line" },
    tags: true,
    style: {
      fg: palette.white,
      bg: palette.bgPanel,
      border: { fg: palette.cyan },
    },
  });

  return input;
}

export function renderTextInput(
  value: string,
  placeholder: string = "",
  cursorPos: number,
  active: boolean
): string {
  const displayValue = value || placeholder;
  const displayColor = value ? palette.white : palette.gray;

  if (!active) {
    return `  ${hex(displayValue, displayColor)}`;
  }

  const before = displayValue.slice(0, cursorPos);
  const at = displayValue[cursorPos] || " ";
  const after = displayValue.slice(cursorPos + 1);

  return `  ${hex(before, displayColor)}${hexBg(at, palette.cyan, palette.bg)}${hex(after, displayColor)}`;
}
