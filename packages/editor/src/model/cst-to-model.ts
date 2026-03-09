import { type SyntaxNode, SyntaxKind, isToken, isNode, getText } from "parser-cst";
import type { Block, Document } from "./types.js";

/**
 * Convert a CST Document node into a Document Model.
 *
 * Each block node's content is getText() with trailing \n stripped.
 * BLANK_LINE tokens become blank_line blocks with empty content.
 */
export function cstToModel(doc: SyntaxNode): Document {
  const blocks: Block[] = [];

  for (const child of doc.children) {
    if (isToken(child)) {
      if (child.kind === SyntaxKind.BLANK_LINE) {
        blocks.push({ type: "blank_line", content: "" });
      }
      // Skip EOF and other non-block tokens
    } else if (isNode(child)) {
      const content = getText(child).replace(/\n$/, "");
      switch (child.kind) {
        case SyntaxKind.ATX_HEADING:
          blocks.push({ type: "heading", content });
          break;
        case SyntaxKind.PARAGRAPH:
          blocks.push({ type: "paragraph", content });
          break;
        case SyntaxKind.THEMATIC_BREAK:
          blocks.push({ type: "thematic_break", content });
          break;
        case SyntaxKind.LIST:
          blocks.push({ type: "list", content });
          break;
        case SyntaxKind.FENCED_CODE_BLOCK:
          blocks.push({ type: "fenced_code_block", content });
          break;
        case SyntaxKind.BLOCK_QUOTE:
          blocks.push({ type: "block_quote", content });
          break;
      }
    }
  }

  return { blocks };
}
