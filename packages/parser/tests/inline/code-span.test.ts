import { describe, it, expect } from "vitest";
import { parse, renderToHtml } from "../../src/index.js";
import type { Paragraph, CodeSpan } from "../../src/ast/nodes.js";

function getParagraph(doc: ReturnType<typeof parse>): Paragraph {
  const para = doc.children[0];
  expect(para.type).toBe("paragraph");
  return para as Paragraph;
}

describe("Code Spans", () => {
  // Example 349: Simple code span
  it("should parse simple code span", () => {
    const para = getParagraph(parse("`foo`"));
    expect(para.children).toHaveLength(1);
    expect(para.children[0].type).toBe("code_span");
    expect((para.children[0] as CodeSpan).value).toBe("foo");
  });

  // Example 350: Double backtick code span
  it("should parse double backtick code span", () => {
    const para = getParagraph(parse("``foo ` bar``"));
    expect(para.children).toHaveLength(1);
    expect(para.children[0].type).toBe("code_span");
    expect((para.children[0] as CodeSpan).value).toBe("foo ` bar");
  });

  // Example 351: Spaces are preserved
  it("should strip one leading and trailing space", () => {
    const para = getParagraph(parse("` `` `"));
    expect(para.children[0].type).toBe("code_span");
    expect((para.children[0] as CodeSpan).value).toBe("``");
  });

  // Example 352: Only a space - not stripped
  it("should not strip spaces if content is only spaces", () => {
    const para = getParagraph(parse("` `"));
    expect(para.children[0].type).toBe("code_span");
    expect((para.children[0] as CodeSpan).value).toBe(" ");
  });

  it("should not strip spaces for double-space content", () => {
    const para = getParagraph(parse("`  `"));
    expect(para.children[0].type).toBe("code_span");
    expect((para.children[0] as CodeSpan).value).toBe("  ");
  });

  // Example 353: Line endings converted to spaces
  it("should convert line endings to spaces", () => {
    const para = getParagraph(parse("`foo\nbar`"));
    expect(para.children[0].type).toBe("code_span");
    expect((para.children[0] as CodeSpan).value).toBe("foo bar");
  });

  // Example 354: Stripping with newlines
  it("should strip space after converting newlines", () => {
    const para = getParagraph(parse("` foo\nbar `"));
    expect(para.children[0].type).toBe("code_span");
    expect((para.children[0] as CodeSpan).value).toBe("foo bar");
  });

  // Code span with text around it
  it("should parse code span with surrounding text", () => {
    const para = getParagraph(parse("foo `bar` baz"));
    expect(para.children).toHaveLength(3);
    expect(para.children[0].type).toBe("text");
    expect(para.children[1].type).toBe("code_span");
    expect(para.children[2].type).toBe("text");
    expect((para.children[1] as CodeSpan).value).toBe("bar");
  });

  // Unmatched backticks treated as literal
  it("should treat unmatched backticks as literal text", () => {
    const para = getParagraph(parse("foo `bar"));
    const codeSpans = para.children.filter((n) => n.type === "code_span");
    expect(codeSpans).toHaveLength(0);
  });

  // Backticks of different lengths don't match
  it("should not match backticks of different lengths", () => {
    const para = getParagraph(parse("``foo`"));
    const codeSpans = para.children.filter((n) => n.type === "code_span");
    expect(codeSpans).toHaveLength(0);
  });

  // Code span takes precedence over emphasis
  it("should take precedence over emphasis markers", () => {
    const para = getParagraph(parse("`*foo*`"));
    expect(para.children).toHaveLength(1);
    expect(para.children[0].type).toBe("code_span");
    expect((para.children[0] as CodeSpan).value).toBe("*foo*");
  });

  // HTML rendering
  it("should render as <code>", () => {
    const doc = parse("`foo`");
    expect(renderToHtml(doc)).toBe("<p><code>foo</code></p>\n");
  });

  // HTML entities in code spans are escaped
  it("should escape HTML entities", () => {
    const doc = parse("`<div>&</div>`");
    expect(renderToHtml(doc)).toContain("&lt;div&gt;&amp;&lt;/div&gt;");
  });

  // Source location
  it("should track source location", () => {
    const para = getParagraph(parse("`foo`"));
    expect(para.children[0].sourceLocation).toBeDefined();
  });
});
