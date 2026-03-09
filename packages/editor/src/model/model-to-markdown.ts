import type { Document } from "./types.js";

/**
 * Serialize a Document Model to a Markdown string.
 *
 * Serialization rules:
 * - Between two adjacent content blocks (no blank_line): "\n\n"
 * - When either side of the separator is blank_line: "\n"
 * - blank_line blocks contribute no content, only affect separators
 *
 * Examples:
 *   [para("Hello"), blank_line, para("World")] → "Hello\n\nWorld"
 *   [para("Hello"), blank_line, blank_line, blank_line, para("World")] → "Hello\n\n\n\nWorld"
 *   [para("Hello"), para("World")] → "Hello\n\nWorld"
 */
export function modelToMarkdown(doc: Document): string {
  const blocks = doc.blocks;
  if (blocks.length === 0) return "";

  const parts: string[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const prev = i > 0 ? blocks[i - 1] : null;

    if (i > 0) {
      if (prev!.type === "blank_line" || block.type === "blank_line") {
        // One side is blank_line: single newline separator
        parts.push("\n");
      } else {
        // Both sides are content blocks: double newline (Markdown block separator)
        parts.push("\n\n");
      }
    }

    if (block.type !== "blank_line") {
      parts.push(block.content);
    }
  }

  // A trailing blank_line contributes one more '\n' (e.g. [para, blank_line] → "para\n\n")
  if (blocks[blocks.length - 1].type === "blank_line") {
    parts.push("\n");
  }

  return parts.join("");
}
