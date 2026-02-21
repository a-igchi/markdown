import type {
  Document,
  BlockNode,
  Heading,
  Paragraph,
  List,
  ListItem,
  ThematicBreak,
  CodeBlock,
  BlockQuote,
} from "./ast/nodes.js";
import { parseBlocks } from "./parser/block/block-parser.js";
import { parseInlines } from "./parser/inline/inline-parser.js";
import type { LinkReference } from "./ast/nodes.js";

export type {
  Document,
  BlockNode,
  Heading,
  Paragraph,
  List,
  ListItem,
  ThematicBreak,
  CodeBlock,
  BlockQuote,
} from "./ast/nodes.js";
export type {
  InlineNode,
  Text,
  Emphasis,
  Strong,
  Link,
  SoftBreak,
  HardBreak,
  CodeSpan,
} from "./ast/nodes.js";
export type { SourceLocation, Position, LinkReference } from "./ast/nodes.js";
export { renderToHtml } from "./renderer/html-renderer.js";

/**
 * Parse a CommonMark markdown string into an AST.
 */
export function parse(input: string): Document {
  const { document, references } = parseBlocks(input);

  // Phase 2: parse inline content for all blocks
  processInlines(document.children, references);

  return document;
}

function processInlines(nodes: BlockNode[], references: Map<string, LinkReference>): void {
  for (const node of nodes) {
    switch (node.type) {
      case "heading": {
        const raw = (node as any).rawContent as string | undefined;
        if (raw !== undefined) {
          node.children = parseInlines(
            raw,
            node.sourceLocation.start.offset,
            node.sourceLocation.start.line,
            references,
          );
          delete (node as any).rawContent;
        }
        break;
      }
      case "paragraph": {
        const raw = (node as any).rawContent as string | undefined;
        if (raw !== undefined) {
          node.children = parseInlines(
            raw,
            node.sourceLocation.start.offset,
            node.sourceLocation.start.line,
            references,
          );
          delete (node as any).rawContent;
        }
        break;
      }
      case "list": {
        for (const item of node.children) {
          processInlines(item.children, references);
        }
        break;
      }
      case "list_item": {
        processInlines(node.children, references);
        break;
      }
      case "block_quote": {
        processInlines(node.children, references);
        break;
      }
      // blank_line, thematic_break, code_block have no inline content
    }
  }
}
