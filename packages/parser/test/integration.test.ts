import { describe, it, expect } from "vitest";
import {
  parse,
  getText,
  findChildren,
  findFirstToken,
  isNode,
  SyntaxKind,
  type SyntaxNode,
  type SyntaxToken,
} from "../src/index.js";

describe("integration: complex documents", () => {
  it("parses a document with headings, paragraphs, and lists", () => {
    const input = `# Title

This is a paragraph
with multiple lines.

## Section

- item one
- item two
- item three

### Subsection

1. first
2. second
3. third
`;
    const doc = parse(input);
    expect(getText(doc)).toBe(input);

    const headings = findChildren(doc, SyntaxKind.ATX_HEADING);
    expect(headings).toHaveLength(3);

    const paragraphs = findChildren(doc, SyntaxKind.PARAGRAPH);
    expect(paragraphs).toHaveLength(1);

    const lists = findChildren(doc, SyntaxKind.LIST);
    expect(lists).toHaveLength(2);
  });

  it("parses document with thematic breaks separating sections", () => {
    const input = `# Part 1

Some text.

---

# Part 2

More text.
`;
    const doc = parse(input);
    expect(getText(doc)).toBe(input);

    const breaks = findChildren(doc, SyntaxKind.THEMATIC_BREAK);
    expect(breaks).toHaveLength(1);
  });

  it("parses nested lists with mixed types", () => {
    const input = `- bullet one
  1. nested ordered
  2. nested ordered two
- bullet two
`;
    const doc = parse(input);
    expect(getText(doc)).toBe(input);

    const list = findChildren(doc, SyntaxKind.LIST)[0] as SyntaxNode;
    expect(list.children).toHaveLength(2);

    const firstItem = list.children[0] as SyntaxNode;
    const nestedList = firstItem.children.find(
      (c) => c.kind === SyntaxKind.LIST,
    ) as SyntaxNode;
    expect(nestedList).toBeDefined();
    expect(nestedList.children).toHaveLength(2);
  });

  it("preserves all whitespace and formatting", () => {
    const input = `   ## Indented Heading ##

  ***

   - list item
`;
    const doc = parse(input);
    expect(getText(doc)).toBe(input);
  });

  it("handles empty document", () => {
    const doc = parse("");
    expect(getText(doc)).toBe("");
    expect(doc.children).toHaveLength(0);
  });

  it("handles document that is just blank lines", () => {
    const input = "\n\n\n";
    const doc = parse(input);
    expect(getText(doc)).toBe(input);
    expect(doc.children).toHaveLength(3);
  });

  it("all offsets and lengths are consistent", () => {
    const input = `# Hello

World

- a
- b

---
`;
    const doc = parse(input);

    // Check that offsets are monotonically increasing and non-overlapping
    const checkOffsets = (node: SyntaxNode) => {
      let expectedOffset = node.offset;
      for (const child of node.children) {
        expect(child.offset).toBe(expectedOffset);
        expectedOffset += child.length;
        if (isNode(child)) {
          checkOffsets(child);
        }
      }
      expect(node.length).toBe(expectedOffset - node.offset);
    };

    checkOffsets(doc);
    expect(doc.length).toBe(input.length);
  });

  it("findFirstToken works through the tree", () => {
    const doc = parse("# Title\n\n- item\n");
    const heading = findChildren(doc, SyntaxKind.ATX_HEADING)[0] as SyntaxNode;
    const hashToken = findFirstToken(heading, SyntaxKind.HASH);
    expect(hashToken).toBeDefined();
    expect(hashToken!.text).toBe("#");
  });

  it("loose list with blank lines between items", () => {
    const input = `- one

- two

- three
`;
    const doc = parse(input);
    expect(getText(doc)).toBe(input);

    const list = findChildren(doc, SyntaxKind.LIST)[0] as SyntaxNode;
    expect(list.children).toHaveLength(3);
  });

  it("heading immediately after paragraph", () => {
    const input = `paragraph
# heading
`;
    const doc = parse(input);
    expect(getText(doc)).toBe(input);
    expect(doc.children).toHaveLength(2);
    expect(doc.children[0].kind).toBe(SyntaxKind.PARAGRAPH);
    expect(doc.children[1].kind).toBe(SyntaxKind.ATX_HEADING);
  });
});
