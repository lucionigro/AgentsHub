export type MultilineEditResult = {
  content: string;
  cursor: number;
};

export function editMultilineContent(content: string, cursor: number, key: string): MultilineEditResult {
  const safeCursor = clamp(cursor, 0, content.length);

  if (key === "enter" || key === "return") {
    return insertAt(content, safeCursor, "\n");
  }

  if (key === "backspace") {
    if (safeCursor === 0) return { content, cursor: safeCursor };
    return {
      content: content.slice(0, safeCursor - 1) + content.slice(safeCursor),
      cursor: safeCursor - 1,
    };
  }

  if (key === "left") {
    return { content, cursor: Math.max(0, safeCursor - 1) };
  }

  if (key === "right") {
    return { content, cursor: Math.min(content.length, safeCursor + 1) };
  }

  if (key === "up" || key === "down") {
    return { content, cursor: verticalCursorMove(content, safeCursor, key) };
  }

  const char = key === "space" ? " " : isPrintableEditorKey(key) ? key : "";
  if (char) {
    return insertAt(content, safeCursor, char);
  }

  return { content, cursor: safeCursor };
}

export function isPrintableEditorKey(key: string): boolean {
  return key.length === 1 && key >= " " && key !== "\x7f";
}

export function cursorLineAndColumn(content: string, cursor: number): { line: number; column: number } {
  const safeCursor = clamp(cursor, 0, content.length);
  const before = content.slice(0, safeCursor);
  const lines = before.split("\n");
  return {
    line: lines.length - 1,
    column: lines[lines.length - 1]?.length ?? 0,
  };
}

export function offsetFromLineAndColumn(content: string, line: number, column: number): number {
  const lines = content.split("\n");
  const safeLine = clamp(line, 0, Math.max(0, lines.length - 1));
  let offset = 0;

  for (let i = 0; i < safeLine; i++) {
    offset += lines[i].length + 1;
  }

  return offset + clamp(column, 0, lines[safeLine]?.length ?? 0);
}

function insertAt(content: string, cursor: number, text: string): MultilineEditResult {
  return {
    content: content.slice(0, cursor) + text + content.slice(cursor),
    cursor: cursor + text.length,
  };
}

function verticalCursorMove(content: string, cursor: number, key: "up" | "down"): number {
  const { line, column } = cursorLineAndColumn(content, cursor);
  const nextLine = key === "up" ? line - 1 : line + 1;
  return offsetFromLineAndColumn(content, nextLine, column);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
