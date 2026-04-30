import { runTui } from "../../tui/App.js";

export async function tuiCommand(): Promise<void> {
  await runTui();
}
