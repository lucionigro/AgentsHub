import type { Widgets } from "neo-blessed";
import blessed from "neo-blessed";
import { palette } from "../theme/palette.js";
import { hex } from "../theme/styles.js";
import { symbols } from "../theme/symbols.js";
import { formatTime } from "../utils/text.js";
import type { DashboardView } from "../state.js";
import { VIEW_LABELS } from "../state.js";
import { padCenterTagged, visibleLength } from "../visual.js";

export function createHeader(screen: Widgets.Screen): Widgets.BoxElement {
  return blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: "100%",
    height: 3,
    tags: true,
    style: {
      fg: palette.white,
      bg: palette.bgHeader,
    },
  });
}

export function renderHeader(
  widget: Widgets.BoxElement,
  currentView: DashboardView,
  watchActive: boolean
): void {
  const time = formatTime();
  const logo = `${hex(symbols.logo, palette.cyan)} ${hex("AgentHub", palette.cyanGlow)} ${hex("v0.1.0", palette.white)}`;
  const viewLabel = hex(`[ ${VIEW_LABELS[currentView]} ]`, palette.cyan);
  const watch = watchActive
    ? `${hex(symbols.bulletOn, palette.magenta)} ${hex("WATCH", palette.magenta)}`
    : `${hex(symbols.bulletOff, palette.gray)} ${hex("IDLE", palette.gray)}`;
  const right = `${watch} ${hex(time, palette.whiteDim)}`;
  const subtitle = hex("Agent Memory & Config Sync", palette.gray);

  const w = Math.max(1, Number(widget.width) || 160);
  const visualLeft = visibleLength(logo);
  const visualRight = visibleLength(right);
  const remaining = Math.max(1, w - visualLeft - visualRight - 2);
  const centerPadded = padCenterTagged(viewLabel, remaining);
  const line1 = `${logo}${centerPadded}${right}`;
  const line2 = subtitle;
  const divider = hex(symbols.h.repeat(Math.max(0, w)), palette.cyanDim);

  widget.setContent(`${line1}\n${line2}\n${divider}`);
}
