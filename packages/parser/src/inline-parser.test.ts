import { describe, it, expect } from "vitest";
import { parseInlines, parseInlineWithHardLineBreak } from "./inline-parser.js";
import { SyntaxKind } from "./syntax-kind.js";
import { getText, type SyntaxToken } from "./nodes.js";

describe("parseInlines: plain text", () => {
  it("returns TEXT token for plain string", () => {
    const result = parseInlines("hello", 0);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe(SyntaxKind.TEXT);
    expect((result[0] as SyntaxToken).text).toBe("hello");
  });

  it("returns empty array for empty string", () => {
    expect(parseInlines("", 0)).toHaveLength(0);
  });

  it("sets correct base offset", () => {
    const result = parseInlines("hello", 10);
    expect(result[0].offset).toBe(10);
  });
});

describe("parseInlines: code spans", () => {
  it("parses simple code span", () => {
    const result = parseInlines("`foo`", 0);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe(SyntaxKind.CODE_SPAN);
    expect(getText(result[0])).toBe("`foo`");
  });

  it("parses double-backtick code span", () => {
    const result = parseInlines("``foo``", 0);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe(SyntaxKind.CODE_SPAN);
    expect(getText(result[0])).toBe("``foo``");
  });

  it("parses code span with surrounding text", () => {
    const result = parseInlines("before `code` after", 0);
    expect(result).toHaveLength(3);
    expect(result[0].kind).toBe(SyntaxKind.TEXT);
    expect((result[0] as SyntaxToken).text).toBe("before ");
    expect(result[1].kind).toBe(SyntaxKind.CODE_SPAN);
    expect(result[2].kind).toBe(SyntaxKind.TEXT);
    expect((result[2] as SyntaxToken).text).toBe(" after");
  });

  it("backtick with no matching close is literal", () => {
    const result = parseInlines("`foo", 0);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe(SyntaxKind.TEXT);
    expect((result[0] as SyntaxToken).text).toBe("`foo");
  });

  it("double backtick does not match single backtick", () => {
    const result = parseInlines("``foo`bar``", 0);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe(SyntaxKind.CODE_SPAN);
    expect(getText(result[0])).toBe("``foo`bar``");
  });

  it("round-trips code span text", () => {
    const inputs = ["`foo`", "``foo``", "before `code` after", "`a` and `b`"];
    for (const input of inputs) {
      const result = parseInlines(input, 0);
      const reconstructed = result.map((el) => getText(el)).join("");
      expect(reconstructed).toBe(input);
    }
  });
});

describe("parseInlines: emphasis", () => {
  it("parses *emphasis*", () => {
    const result = parseInlines("*foo*", 0);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe(SyntaxKind.EMPHASIS);
    expect(getText(result[0])).toBe("*foo*");
  });

  it("parses **strong**", () => {
    const result = parseInlines("**foo**", 0);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe(SyntaxKind.STRONG_EMPHASIS);
    expect(getText(result[0])).toBe("**foo**");
  });

  it("parses _emphasis_", () => {
    const result = parseInlines("_foo_", 0);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe(SyntaxKind.EMPHASIS);
    expect(getText(result[0])).toBe("_foo_");
  });

  it("parses __strong__", () => {
    const result = parseInlines("__foo__", 0);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe(SyntaxKind.STRONG_EMPHASIS);
    expect(getText(result[0])).toBe("__foo__");
  });

  it("round-trips emphasis text", () => {
    const inputs = ["*foo*", "**bar**", "_baz_", "__qux__", "a *b* c"];
    for (const input of inputs) {
      const result = parseInlines(input, 0);
      expect(result.map((el) => getText(el)).join("")).toBe(input);
    }
  });
});

describe("parseInlines: links", () => {
  it("parses inline link", () => {
    const result = parseInlines("[text](url)", 0);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe(SyntaxKind.LINK);
    expect(getText(result[0])).toBe("[text](url)");
  });

  it("parses inline link with title", () => {
    const result = parseInlines('[text](url "title")', 0);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe(SyntaxKind.LINK);
    expect(getText(result[0])).toBe('[text](url "title")');
  });

  it("parses image", () => {
    const result = parseInlines("![alt](url)", 0);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe(SyntaxKind.IMAGE);
    expect(getText(result[0])).toBe("![alt](url)");
  });

  it("round-trips links", () => {
    const inputs = ["[text](url)", "![alt](img.png)", '[a](b "c")'];
    for (const input of inputs) {
      const result = parseInlines(input, 0);
      expect(result.map((el) => getText(el)).join("")).toBe(input);
    }
  });
});

describe("parseInlineWithHardLineBreak", () => {
  it("returns no hard line break for plain text", () => {
    const { inlines, hardLineBreak } = parseInlineWithHardLineBreak("foo", true, 0);
    expect(hardLineBreak).toBeNull();
    expect(inlines).toHaveLength(1);
  });

  it("detects trailing 2+ spaces as hard line break", () => {
    const { inlines, hardLineBreak } = parseInlineWithHardLineBreak("foo  ", true, 0);
    expect(hardLineBreak).not.toBeNull();
    expect(hardLineBreak!.kind).toBe(SyntaxKind.HARD_LINE_BREAK);
    expect((hardLineBreak as SyntaxToken).text).toBe("  \n");
    expect(inlines.map((el) => getText(el)).join("")).toBe("foo");
  });

  it("detects backslash as hard line break", () => {
    const { inlines, hardLineBreak } = parseInlineWithHardLineBreak("foo\\", true, 0);
    expect(hardLineBreak).not.toBeNull();
    expect((hardLineBreak as SyntaxToken).text).toBe("\\\n");
    expect(inlines.map((el) => getText(el)).join("")).toBe("foo");
  });

  it("no hard line break when no newline", () => {
    const { hardLineBreak } = parseInlineWithHardLineBreak("foo  ", false, 0);
    expect(hardLineBreak).toBeNull();
  });

  it("round-trips hard line break", () => {
    const lineText = "foo  ";
    const { inlines, hardLineBreak } = parseInlineWithHardLineBreak(lineText, true, 0);
    const fullText = inlines.map((el) => getText(el)).join("") + (hardLineBreak ? getText(hardLineBreak) : "\n");
    expect(fullText).toBe("foo  \n");
  });
});
