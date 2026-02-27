import { describe, it, expect } from "vitest";
import { SyntaxKind } from "./syntax-kind.js";
import { getText, isNode, isToken, type SyntaxNode, type SyntaxToken } from "./nodes.js";
import { parse } from "./parser.js";

// Helper to get child kinds
const childKinds = (node: SyntaxNode) =>
  node.children.map((c) => c.kind);

// Helper to get token text at index
const tokenText = (node: SyntaxNode, index: number) =>
  (node.children[index] as SyntaxToken).text;

// Helper to get child node at index
const childNode = (node: SyntaxNode, index: number) =>
  node.children[index] as SyntaxNode;

describe("parse: blank lines", () => {
  it("parses a single blank line", () => {
    const doc = parse("\n");
    expect(doc.kind).toBe(SyntaxKind.DOCUMENT);
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].kind).toBe(SyntaxKind.BLANK_LINE);
    expect((doc.children[0] as SyntaxToken).text).toBe("\n");
  });

  it("parses multiple blank lines", () => {
    const doc = parse("\n\n\n");
    expect(doc.children).toHaveLength(3);
    doc.children.forEach((child) => {
      expect(child.kind).toBe(SyntaxKind.BLANK_LINE);
    });
  });

  it("parses blank line with spaces", () => {
    const doc = parse("   \n");
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].kind).toBe(SyntaxKind.BLANK_LINE);
    expect((doc.children[0] as SyntaxToken).text).toBe("   \n");
  });
});

describe("parse: paragraphs", () => {
  it("parses a single-line paragraph", () => {
    const doc = parse("Hello world\n");
    expect(doc.children).toHaveLength(1);
    const para = childNode(doc, 0);
    expect(para.kind).toBe(SyntaxKind.PARAGRAPH);
    expect(childKinds(para)).toEqual([SyntaxKind.TEXT, SyntaxKind.NEWLINE]);
    expect(tokenText(para, 0)).toBe("Hello world");
    expect(tokenText(para, 1)).toBe("\n");
  });

  it("parses a multi-line paragraph (lazy continuation)", () => {
    const doc = parse("line1\nline2\n");
    expect(doc.children).toHaveLength(1);
    const para = childNode(doc, 0);
    expect(para.kind).toBe(SyntaxKind.PARAGRAPH);
    expect(childKinds(para)).toEqual([
      SyntaxKind.TEXT, SyntaxKind.NEWLINE,
      SyntaxKind.TEXT, SyntaxKind.NEWLINE,
    ]);
  });

  it("parses paragraph without trailing newline (EOF)", () => {
    const doc = parse("Hello");
    expect(doc.children).toHaveLength(1);
    const para = childNode(doc, 0);
    expect(para.kind).toBe(SyntaxKind.PARAGRAPH);
    expect(childKinds(para)).toEqual([SyntaxKind.TEXT]);
    expect(tokenText(para, 0)).toBe("Hello");
  });

  it("blank line separates two paragraphs", () => {
    const doc = parse("para1\n\npara2\n");
    expect(doc.children).toHaveLength(3);
    expect(doc.children[0].kind).toBe(SyntaxKind.PARAGRAPH);
    expect(doc.children[1].kind).toBe(SyntaxKind.BLANK_LINE);
    expect(doc.children[2].kind).toBe(SyntaxKind.PARAGRAPH);
  });
});

describe("parse: ATX headings", () => {
  it("parses level 1 heading", () => {
    const doc = parse("# Hello\n");
    expect(doc.children).toHaveLength(1);
    const heading = childNode(doc, 0);
    expect(heading.kind).toBe(SyntaxKind.ATX_HEADING);
    expect(childKinds(heading)).toEqual([
      SyntaxKind.HASH, SyntaxKind.WHITESPACE, SyntaxKind.TEXT, SyntaxKind.NEWLINE,
    ]);
    expect(tokenText(heading, 0)).toBe("#");
    expect(tokenText(heading, 2)).toBe("Hello");
  });

  it("parses level 3 heading", () => {
    const doc = parse("### Title\n");
    const heading = childNode(doc, 0);
    expect(tokenText(heading, 0)).toBe("###");
  });

  it("parses heading with closing hashes", () => {
    const doc = parse("## Title ##\n");
    const heading = childNode(doc, 0);
    // HASH, WS, TEXT, WS, HASH, NEWLINE
    expect(childKinds(heading)).toEqual([
      SyntaxKind.HASH, SyntaxKind.WHITESPACE, SyntaxKind.TEXT,
      SyntaxKind.WHITESPACE, SyntaxKind.HASH, SyntaxKind.NEWLINE,
    ]);
    expect(tokenText(heading, 2)).toBe("Title");
    expect(tokenText(heading, 4)).toBe("##");
  });

  it("parses heading with indent", () => {
    const doc = parse("  ## Indented\n");
    const heading = childNode(doc, 0);
    expect(heading.children[0].kind).toBe(SyntaxKind.WHITESPACE);
    expect(tokenText(heading, 0)).toBe("  ");
  });

  it("parses empty heading", () => {
    const doc = parse("#\n");
    const heading = childNode(doc, 0);
    expect(heading.kind).toBe(SyntaxKind.ATX_HEADING);
    expect(childKinds(heading)).toEqual([SyntaxKind.HASH, SyntaxKind.NEWLINE]);
  });

  it("parses heading without trailing newline", () => {
    const doc = parse("# Hello");
    const heading = childNode(doc, 0);
    expect(heading.kind).toBe(SyntaxKind.ATX_HEADING);
    expect(childKinds(heading)).toEqual([
      SyntaxKind.HASH, SyntaxKind.WHITESPACE, SyntaxKind.TEXT,
    ]);
  });
});

describe("parse: thematic breaks", () => {
  it("parses ---", () => {
    const doc = parse("---\n");
    expect(doc.children).toHaveLength(1);
    const tb = childNode(doc, 0);
    expect(tb.kind).toBe(SyntaxKind.THEMATIC_BREAK);
    expect(childKinds(tb)).toEqual([SyntaxKind.THEMATIC_BREAK_CHARS, SyntaxKind.NEWLINE]);
    expect(tokenText(tb, 0)).toBe("---");
  });

  it("parses *** with spaces", () => {
    const doc = parse("* * *\n");
    const tb = childNode(doc, 0);
    expect(tb.kind).toBe(SyntaxKind.THEMATIC_BREAK);
    expect(tokenText(tb, 0)).toBe("* * *");
  });

  it("parses with indent", () => {
    const doc = parse("  ---\n");
    const tb = childNode(doc, 0);
    expect(childKinds(tb)).toEqual([
      SyntaxKind.WHITESPACE, SyntaxKind.THEMATIC_BREAK_CHARS, SyntaxKind.NEWLINE,
    ]);
  });

  it("thematic break interrupts paragraph", () => {
    const doc = parse("para\n---\n");
    expect(doc.children).toHaveLength(2);
    expect(doc.children[0].kind).toBe(SyntaxKind.PARAGRAPH);
    expect(doc.children[1].kind).toBe(SyntaxKind.THEMATIC_BREAK);
  });
});

describe("parse: bullet lists", () => {
  it("parses single-item bullet list", () => {
    const doc = parse("- item\n");
    expect(doc.children).toHaveLength(1);
    const list = childNode(doc, 0);
    expect(list.kind).toBe(SyntaxKind.LIST);
    expect(list.children).toHaveLength(1);
    const item = childNode(list, 0);
    expect(item.kind).toBe(SyntaxKind.LIST_ITEM);
    // MARKER, then content (PARAGRAPH with TEXT + NEWLINE)
    expect(item.children[0].kind).toBe(SyntaxKind.MARKER);
    expect(tokenText(item, 0)).toBe("- ");
    const itemPara = childNode(item, 1);
    expect(itemPara.kind).toBe(SyntaxKind.PARAGRAPH);
  });

  it("parses multi-item bullet list", () => {
    const doc = parse("- one\n- two\n- three\n");
    const list = childNode(doc, 0);
    expect(list.kind).toBe(SyntaxKind.LIST);
    expect(list.children).toHaveLength(3);
  });

  it("parses bullet list with * marker", () => {
    const doc = parse("* item\n");
    const list = childNode(doc, 0);
    const item = childNode(list, 0);
    expect(tokenText(item, 0)).toBe("* ");
  });

  it("parses bullet list with + marker", () => {
    const doc = parse("+ item\n");
    const list = childNode(doc, 0);
    const item = childNode(list, 0);
    expect(tokenText(item, 0)).toBe("+ ");
  });
});

describe("parse: ordered lists", () => {
  it("parses single-item ordered list", () => {
    const doc = parse("1. item\n");
    const list = childNode(doc, 0);
    expect(list.kind).toBe(SyntaxKind.LIST);
    const item = childNode(list, 0);
    expect(item.kind).toBe(SyntaxKind.LIST_ITEM);
    expect(tokenText(item, 0)).toBe("1. ");
  });

  it("parses multi-item ordered list", () => {
    const doc = parse("1. one\n2. two\n3. three\n");
    const list = childNode(doc, 0);
    expect(list.children).toHaveLength(3);
  });

  it("parses ordered list with ) delimiter", () => {
    const doc = parse("1) item\n");
    const list = childNode(doc, 0);
    const item = childNode(list, 0);
    expect(tokenText(item, 0)).toBe("1) ");
  });
});

describe("parse: nested lists", () => {
  it("parses nested bullet list", () => {
    const doc = parse("- outer\n  - inner\n");
    const list = childNode(doc, 0);
    expect(list.kind).toBe(SyntaxKind.LIST);
    // The outer list should have 1 item
    expect(list.children).toHaveLength(1);
    const outerItem = childNode(list, 0);
    // The outer item should contain: MARKER, PARAGRAPH, LIST (nested)
    const nestedList = outerItem.children.find(
      (c) => c.kind === SyntaxKind.LIST,
    ) as SyntaxNode;
    expect(nestedList).toBeDefined();
    expect(nestedList.children).toHaveLength(1);
  });

  it("parses ordered nested in bullet", () => {
    const doc = parse("- outer\n  1. inner\n");
    const list = childNode(doc, 0);
    const outerItem = childNode(list, 0);
    const nestedList = outerItem.children.find(
      (c) => c.kind === SyntaxKind.LIST,
    ) as SyntaxNode;
    expect(nestedList).toBeDefined();
  });
});

describe("parse: empty list item does not produce BLANK_LINE", () => {
  it("empty list item with newline uses NEWLINE token, not BLANK_LINE", () => {
    const doc = parse("- item1\n- \n- item2\n");
    const list = childNode(doc, 0);
    expect(list.children).toHaveLength(3);
    // The second item (empty) should have MARKER + NEWLINE, not BLANK_LINE
    const emptyItem = childNode(list, 1);
    const hasBlankLine = emptyItem.children.some(
      (c) => c.kind === SyntaxKind.BLANK_LINE,
    );
    expect(hasBlankLine).toBe(false);
    const hasNewline = emptyItem.children.some(
      (c) => isToken(c) && c.kind === SyntaxKind.NEWLINE,
    );
    expect(hasNewline).toBe(true);
  });
});

describe("parse: tight vs loose lists", () => {
  it("parses tight list (no blank lines between items)", () => {
    const doc = parse("- one\n- two\n");
    const list = childNode(doc, 0);
    expect(list.children).toHaveLength(2);
    // Tight list items have paragraphs
  });

  it("parses loose list (blank line between items)", () => {
    const doc = parse("- one\n\n- two\n");
    const list = childNode(doc, 0);
    // Loose list: blank line is part of the structure
    expect(list.children).toHaveLength(2);
    // The blank line should be inside the first list item
    const firstItem = childNode(list, 0);
    const hasBlankLine = firstItem.children.some(
      (c) => c.kind === SyntaxKind.BLANK_LINE,
    );
    expect(hasBlankLine).toBe(true);
  });
});

describe("parse: list interrupts paragraph", () => {
  it("bullet list interrupts paragraph", () => {
    const doc = parse("text\n- item\n");
    expect(doc.children).toHaveLength(2);
    expect(doc.children[0].kind).toBe(SyntaxKind.PARAGRAPH);
    expect(doc.children[1].kind).toBe(SyntaxKind.LIST);
  });

  it("ordered list starting with 1 interrupts paragraph", () => {
    const doc = parse("text\n1. item\n");
    expect(doc.children).toHaveLength(2);
    expect(doc.children[0].kind).toBe(SyntaxKind.PARAGRAPH);
    expect(doc.children[1].kind).toBe(SyntaxKind.LIST);
  });
});

describe("parse: multi-line list items", () => {
  it("parses list item with continuation line", () => {
    const doc = parse("- line1\n  line2\n");
    const list = childNode(doc, 0);
    expect(list.children).toHaveLength(1);
    const item = childNode(list, 0);
    const para = item.children.find(
      (c) => c.kind === SyntaxKind.PARAGRAPH,
    ) as SyntaxNode;
    expect(para).toBeDefined();
    // The paragraph should have both lines
    expect(getText(para)).toBe("line1\n  line2\n");
  });
});

describe("parse: round-trip fidelity", () => {
  const cases = [
    "",
    "\n",
    "\n\n",
    "Hello\n",
    "Hello",
    "line1\nline2\n",
    "# Heading\n",
    "## Heading ##\n",
    "  ## Indented\n",
    "#\n",
    "---\n",
    "***\n",
    "* * *\n",
    "  ---\n",
    "- item\n",
    "- one\n- two\n",
    "1. one\n2. two\n",
    "- outer\n  - inner\n",
    "para\n\n# Heading\n\n---\n\n- a\n- b\n",
    "# Title\n\nparagraph\n\n- item1\n- item2\n",
    "   \n",
    "- one\n\n- two\n",
    "- line1\n  line2\n",
    // Windows line endings
    "Hello\r\nWorld\r\n",
    // Unicode content
    "# 日本語の見出し\n",
    "こんにちは世界\n",
    "# Ñoño\n\n🎉 emoji paragraph\n",
    // Empty list item
    "- \n",
    // Deep nested list (3+ levels)
    "- a\n  - b\n    - c\n",
    // Long numbered list
    "999999999. item\n",
    // Consecutive thematic breaks
    "---\n---\n",
    "---\n\n---\n",
    // Heading immediately followed by list
    "# Title\n- item\n",
    // Complex document with all block types
    "# Title\n\nparagraph\n\n- a\n- b\n\n1. one\n2. two\n\n---\n\n## Sub\n\nmore text\n",
  ];

  cases.forEach((input) => {
    it(`round-trips: ${JSON.stringify(input)}`, () => {
      const doc = parse(input);
      expect(getText(doc)).toBe(input);
    });
  });
});

describe("parse: stripIndent tab handling", () => {
  it("round-trips list continuation with tab indent", () => {
    const input = "- line1\n\tline2\n";
    const doc = parse(input);
    expect(getText(doc)).toBe(input);
  });

  it("round-trips list with mixed tab and space indent", () => {
    const input = "- line1\n \tline2\n";
    const doc = parse(input);
    expect(getText(doc)).toBe(input);
  });
});

describe("parse: inline elements in paragraphs", () => {
  it("parses code span in paragraph", () => {
    const doc = parse("`code`\n");
    const para = childNode(doc, 0);
    expect(para.kind).toBe(SyntaxKind.PARAGRAPH);
    const span = para.children.find((c) => c.kind === SyntaxKind.CODE_SPAN);
    expect(span).toBeDefined();
  });

  it("parses emphasis in paragraph", () => {
    const doc = parse("*bold*\n");
    const para = childNode(doc, 0);
    const em = para.children.find((c) => c.kind === SyntaxKind.EMPHASIS);
    expect(em).toBeDefined();
  });

  it("round-trips paragraph with code span", () => {
    const input = "Hello `world`\n";
    expect(getText(parse(input))).toBe(input);
  });

  it("round-trips paragraph with link", () => {
    const input = "[text](url)\n";
    expect(getText(parse(input))).toBe(input);
  });

  it("round-trips heading with emphasis", () => {
    const input = "# *Hello*\n";
    expect(getText(parse(input))).toBe(input);
  });
});

describe("parse: hard line breaks", () => {
  it("detects trailing 2+ spaces as hard line break", () => {
    const doc = parse("foo  \nbar\n");
    const para = childNode(doc, 0);
    const hlb = para.children.find((c) => c.kind === SyntaxKind.HARD_LINE_BREAK);
    expect(hlb).toBeDefined();
  });

  it("round-trips hard line break (trailing spaces)", () => {
    const input = "foo  \nbar\n";
    expect(getText(parse(input))).toBe(input);
  });

  it("round-trips hard line break (backslash)", () => {
    const input = "foo\\\nbar\n";
    expect(getText(parse(input))).toBe(input);
  });
});

describe("parse: fenced code blocks", () => {
  it("parses basic fenced code block", () => {
    const doc = parse("```\ncode\n```\n");
    expect(doc.children).toHaveLength(1);
    const fcb = childNode(doc, 0);
    expect(fcb.kind).toBe(SyntaxKind.FENCED_CODE_BLOCK);
    // CODE_FENCE, NEWLINE, CODE_CONTENT, CODE_FENCE, NEWLINE
    expect(fcb.children.some((c) => c.kind === SyntaxKind.CODE_FENCE)).toBe(true);
    expect(fcb.children.some((c) => c.kind === SyntaxKind.CODE_CONTENT)).toBe(true);
  });

  it("parses fenced code block with info string", () => {
    const doc = parse("```js\nconst x = 1;\n```\n");
    const fcb = childNode(doc, 0);
    expect(fcb.kind).toBe(SyntaxKind.FENCED_CODE_BLOCK);
    const info = fcb.children.find((c) => c.kind === SyntaxKind.INFO_STRING);
    expect(info).toBeDefined();
    expect((info as SyntaxToken).text).toBe("js");
  });

  it("parses unclosed fenced code block (EOF)", () => {
    const doc = parse("```\ncode");
    const fcb = childNode(doc, 0);
    expect(fcb.kind).toBe(SyntaxKind.FENCED_CODE_BLOCK);
    const content = fcb.children.find((c) => c.kind === SyntaxKind.CODE_CONTENT);
    expect(content).toBeDefined();
    expect((content as SyntaxToken).text).toBe("code");
  });

  it("parses tilde fenced code block", () => {
    const doc = parse("~~~\ncode\n~~~\n");
    const fcb = childNode(doc, 0);
    expect(fcb.kind).toBe(SyntaxKind.FENCED_CODE_BLOCK);
  });

  it("does not close with fewer fence chars", () => {
    const doc = parse("````\ncode\n```\nmore\n````\n");
    const fcb = childNode(doc, 0);
    expect(fcb.kind).toBe(SyntaxKind.FENCED_CODE_BLOCK);
    const content = fcb.children.find((c) => c.kind === SyntaxKind.CODE_CONTENT);
    expect((content as SyntaxToken).text).toBe("code\n```\nmore\n");
  });

  it("fenced code block interrupts paragraph", () => {
    const doc = parse("para\n```\ncode\n```\n");
    expect(doc.children).toHaveLength(2);
    expect(doc.children[0].kind).toBe(SyntaxKind.PARAGRAPH);
    expect(doc.children[1].kind).toBe(SyntaxKind.FENCED_CODE_BLOCK);
  });
});

describe("parse: block quotes", () => {
  it("parses single-line block quote", () => {
    const doc = parse("> foo\n");
    expect(doc.children).toHaveLength(1);
    const bq = childNode(doc, 0);
    expect(bq.kind).toBe(SyntaxKind.BLOCK_QUOTE);
    expect(bq.children.some((c) => c.kind === SyntaxKind.BLOCK_QUOTE_MARKER)).toBe(true);
  });

  it("parses multi-line block quote", () => {
    const doc = parse("> foo\n> bar\n");
    const bq = childNode(doc, 0);
    expect(bq.kind).toBe(SyntaxKind.BLOCK_QUOTE);
    const markers = bq.children.filter((c) => c.kind === SyntaxKind.BLOCK_QUOTE_MARKER);
    expect(markers).toHaveLength(2);
  });

  it("block quote ends at non-> line", () => {
    const doc = parse("> foo\nparagraph\n");
    expect(doc.children).toHaveLength(2);
    expect(doc.children[0].kind).toBe(SyntaxKind.BLOCK_QUOTE);
    expect(doc.children[1].kind).toBe(SyntaxKind.PARAGRAPH);
  });
});

describe("parse: fenced code block round-trips", () => {
  const cases = [
    "```\n```\n",
    "```\ncode\n```\n",
    "```js\nconst x = 1;\n```\n",
    "~~~\nfoo\n~~~\n",
    "````\nhas ``` inside\n````\n",
    "```\ncode",
    "   ```\ncode\n   ```\n",
    "```\nline1\nline2\n```\n",
  ];
  cases.forEach((input) => {
    it(`round-trips: ${JSON.stringify(input)}`, () => {
      expect(getText(parse(input))).toBe(input);
    });
  });
});

describe("parse: block quote round-trips", () => {
  const cases = [
    "> foo\n",
    "> foo\n> bar\n",
    ">foo\n",
    "   > foo\n",
  ];
  cases.forEach((input) => {
    it(`round-trips: ${JSON.stringify(input)}`, () => {
      expect(getText(parse(input))).toBe(input);
    });
  });
});

describe("parse: offsets", () => {
  it("sets correct offsets for tokens", () => {
    const doc = parse("# Hi\n");
    const heading = childNode(doc, 0);
    expect(heading.offset).toBe(0);
    // "#"
    expect(heading.children[0].offset).toBe(0);
    // " "
    expect(heading.children[1].offset).toBe(1);
    // "Hi"
    expect(heading.children[2].offset).toBe(2);
    // "\n"
    expect(heading.children[3].offset).toBe(4);
  });

  it("sets correct offsets across multiple blocks", () => {
    const doc = parse("# A\n\nB\n");
    // heading: offset 0, length 4
    expect(doc.children[0].offset).toBe(0);
    expect(doc.children[0].length).toBe(4);
    // blank line: offset 4, length 1
    expect(doc.children[1].offset).toBe(4);
    expect(doc.children[1].length).toBe(1);
    // paragraph: offset 5, length 2
    expect(doc.children[2].offset).toBe(5);
    expect(doc.children[2].length).toBe(2);
  });
});
