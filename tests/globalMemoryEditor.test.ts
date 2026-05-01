import { describe, expect, it } from "vitest";
import {
  cursorLineAndColumn,
  editMultilineContent,
  offsetFromLineAndColumn,
} from "../src/tui/components/globalMemoryEditor.js";

describe("global memory editor", () => {
  it("inserts multiline content at the cursor", () => {
    const newline = editMultilineContent("abc", 1, "enter");
    expect(newline).toEqual({ content: "a\nbc", cursor: 2 });

    const typed = editMultilineContent(newline.content, newline.cursor, "x");
    expect(typed).toEqual({ content: "a\nxbc", cursor: 3 });
  });

  it("moves vertically while preserving the nearest column", () => {
    const content = "abc\nde\nfghi";
    const start = offsetFromLineAndColumn(content, 0, 3);
    const down = editMultilineContent(content, start, "down");
    expect(cursorLineAndColumn(content, down.cursor)).toEqual({ line: 1, column: 2 });

    const downAgain = editMultilineContent(content, down.cursor, "down");
    expect(cursorLineAndColumn(content, downAgain.cursor)).toEqual({ line: 2, column: 2 });

    const up = editMultilineContent(content, downAgain.cursor, "up");
    expect(cursorLineAndColumn(content, up.cursor)).toEqual({ line: 1, column: 2 });
  });

  it("backs through line boundaries without dropping surrounding text", () => {
    const edit = editMultilineContent("a\nb", 2, "backspace");
    expect(edit).toEqual({ content: "ab", cursor: 1 });
  });
});
