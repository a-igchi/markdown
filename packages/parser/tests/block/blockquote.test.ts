import { describe, it, expect } from "vitest";
import { parse, renderToHtml } from "../../src/index.js";
import type { BlockQuote } from "../../src/ast/nodes.js";

describe("Block Quotes", () => {
  // Example 228: Simple block quote
  it("should parse simple block quote", () => {
    const doc = parse("> foo\n> bar");
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].type).toBe("block_quote");
    const bq = doc.children[0] as BlockQuote;
    expect(bq.children.length).toBeGreaterThanOrEqual(1);
    expect(bq.children[0].type).toBe("paragraph");
  });

  // Example 229: The > can optionally be followed by a space
  it("should allow omitting the space after >", () => {
    const doc = parse(">foo\n>bar");
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].type).toBe("block_quote");
  });

  // Example 230: The > can be indented 0-3 spaces
  it("should allow 1-3 spaces indent before >", () => {
    const doc1 = parse(" > foo");
    expect(doc1.children[0].type).toBe("block_quote");

    const doc2 = parse("  > foo");
    expect(doc2.children[0].type).toBe("block_quote");

    const doc3 = parse("   > foo");
    expect(doc3.children[0].type).toBe("block_quote");
  });

  // Example 231: 4 spaces indent is not a block quote
  it("should not parse with 4 spaces indent", () => {
    const doc = parse("    > foo");
    expect(doc.children[0].type).not.toBe("block_quote");
  });

  // Lazy continuation
  it("should support lazy continuation lines", () => {
    const doc = parse("> foo\nbar");
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].type).toBe("block_quote");
  });

  // Nested block quotes
  it("should support nested block quotes", () => {
    const doc = parse("> > foo");
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].type).toBe("block_quote");
    const outer = doc.children[0] as BlockQuote;
    expect(outer.children[0].type).toBe("block_quote");
  });

  // Block quote with heading
  it("should support headings inside block quotes", () => {
    const doc = parse("> # Heading");
    expect(doc.children).toHaveLength(1);
    const bq = doc.children[0] as BlockQuote;
    expect(bq.children[0].type).toBe("heading");
  });

  // Block quote with multiple paragraphs
  it("should support multiple paragraphs separated by blank quote lines", () => {
    const doc = parse("> foo\n>\n> bar");
    expect(doc.children).toHaveLength(1);
    const bq = doc.children[0] as BlockQuote;
    const paras = bq.children.filter((n) => n.type === "paragraph");
    expect(paras).toHaveLength(2);
  });

  // Block quote ends at blank line
  it("should end at blank line not preceded by >", () => {
    const doc = parse("> foo\n\nbar");
    expect(doc.children.length).toBeGreaterThanOrEqual(2);
    expect(doc.children[0].type).toBe("block_quote");
  });

  // Block quote with code block
  it("should support code blocks inside block quotes", () => {
    const doc = parse("> ```\n> code\n> ```");
    expect(doc.children).toHaveLength(1);
    const bq = doc.children[0] as BlockQuote;
    expect(bq.children[0].type).toBe("code_block");
  });

  // Block quote with thematic break
  it("should support thematic breaks inside block quotes", () => {
    const doc = parse("> ---");
    expect(doc.children).toHaveLength(1);
    const bq = doc.children[0] as BlockQuote;
    expect(bq.children[0].type).toBe("thematic_break");
  });

  // HTML rendering
  it("should render as <blockquote>", () => {
    const doc = parse("> foo");
    expect(renderToHtml(doc)).toBe("<blockquote>\n<p>foo</p>\n</blockquote>\n");
  });

  it("should render nested blockquotes", () => {
    const doc = parse("> > foo");
    const html = renderToHtml(doc);
    expect(html).toContain("<blockquote>");
    expect(html).toContain("foo");
  });

  // Source location
  it("should track source location", () => {
    const doc = parse("> foo");
    expect(doc.children[0].sourceLocation.start).toEqual({ line: 1, column: 1, offset: 0 });
  });
});
