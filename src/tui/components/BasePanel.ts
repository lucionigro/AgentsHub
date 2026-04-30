import blessed, { type Widgets } from "neo-blessed";
import { palette } from "../theme/palette.js";
import { panelStyle } from "../theme/styles.js";

export interface BasePanelOptions {
  label?: string;
  borderColor?: string;
  top?: number | string;
  left?: number | string;
  width?: number | string;
  height?: number | string;
  scrollable?: boolean;
  hidden?: boolean;
}

/**
 * Create a standard blessed box with cyberpunk panel styling.
 */
export function createBasePanel(options: BasePanelOptions): Widgets.BoxElement {
  return blessed.box({
    top: options.top ?? 0,
    left: options.left ?? 0,
    width: options.width ?? "100%",
    height: options.height ?? 1,
    label: options.label ? ` ${options.label} ` : undefined,
    border: { type: "line" },
    tags: true,
    scrollable: options.scrollable ?? false,
    alwaysScroll: false,
    hidden: options.hidden ?? false,
    style: panelStyle(options.borderColor),
  });
}

/**
 * Update a panel's position and dimensions.
 */
export function setBox(
  widget: Widgets.BoxElement,
  top: number | string,
  left: number | string,
  width: number | string,
  height: number | string
): void {
  widget.top = top;
  widget.left = left;
  widget.width = width;
  widget.height = height;
}

/**
 * Show multiple widgets.
 */
export function show(...widgets: Widgets.BoxElement[]): void {
  for (const widget of widgets) widget.show();
}

/**
 * Hide multiple widgets.
 */
export function hide(...widgets: Widgets.BoxElement[]): void {
  for (const widget of widgets) widget.hide();
}
