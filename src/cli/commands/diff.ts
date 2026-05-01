import { loadConfig } from "../../config/loadConfig.js";
import { renderAllTargets } from "../../core/renderer.js";
import { diffRenderedFile } from "../../core/diff.js";

export async function diffCommand(): Promise<void> {
  const config = await loadConfig();
  const rendered = await renderAllTargets(config, { previewProviderSkills: true });
  let any = false;

  for (const file of rendered) {
    const diff = await diffRenderedFile(file);
    if (diff) {
      any = true;
      process.stdout.write(diff);
      if (!diff.endsWith("\n")) process.stdout.write("\n");
    }
  }

  if (!any) {
    process.stdout.write("No differences.\n");
  }
}
