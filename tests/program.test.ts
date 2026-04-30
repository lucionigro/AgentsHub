import { describe, expect, it } from "vitest";
import { createProgram } from "../src/cli/program.js";

describe("cli program", () => {
  it("runs the live dashboard action when no subcommand is provided", async () => {
    let opened = false;
    const program = createProgram({
      defaultAction: async () => {
        opened = true;
      }
    });

    await program.exitOverride().parseAsync(["node", "agenthub"], { from: "node" });
    expect(opened).toBe(true);
  });

  it("does not expose the removed init command", () => {
    const program = createProgram();
    expect(program.helpInformation()).not.toContain("init");
  });
});
