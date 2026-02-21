import { describe, it, expect } from "vitest";
import { parseBlocks } from "../../src/parser/block/block-parser.js";

describe("Blank Lines", () => {
  it("should parse blank lines between paragraphs", () => {
    const result = parseBlocks("foo\n\nbar");
    expect(result.document.children).toHaveLength(3);
    expect(result.document.children[0].type).toBe("paragraph");
    expect(result.document.children[1].type).toBe("blank_line");
    expect(result.document.children[2].type).toBe("paragraph");
  });

  it("should parse multiple consecutive blank lines", () => {
    const result = parseBlocks("foo\n\n\n\nbar");
    const blanks = result.document.children.filter((n) => n.type === "blank_line");
    expect(blanks.length).toBeGreaterThanOrEqual(1);
  });

  it("should handle blank lines at start of input", () => {
    const result = parseBlocks("\n\nfoo");
    const blanks = result.document.children.filter((n) => n.type === "blank_line");
    expect(blanks.length).toBeGreaterThanOrEqual(1);
  });

  it("should handle blank lines at end of input", () => {
    const result = parseBlocks("foo\n\n");
    const blanks = result.document.children.filter((n) => n.type === "blank_line");
    expect(blanks.length).toBeGreaterThanOrEqual(1);
  });

  it("should handle lines with only spaces as blank", () => {
    const result = parseBlocks("foo\n   \nbar");
    expect(result.document.children).toHaveLength(3);
    expect(result.document.children[1].type).toBe("blank_line");
  });
});
