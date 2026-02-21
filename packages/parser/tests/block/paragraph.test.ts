import { describe, it, expect } from "vitest";
import { parseBlocks } from "../../src/parser/block/block-parser.js";

describe("Paragraphs", () => {
  it("should parse a simple paragraph", () => {
    const result = parseBlocks("Hello world");
    expect(result.document.children).toHaveLength(1);
    expect(result.document.children[0].type).toBe("paragraph");
    expect((result.document.children[0] as any).rawContent).toBe("Hello world");
  });

  it("should parse multi-line paragraph", () => {
    const result = parseBlocks("aaa\nbbb\nccc");
    expect(result.document.children).toHaveLength(1);
    expect(result.document.children[0].type).toBe("paragraph");
    expect((result.document.children[0] as any).rawContent).toBe("aaa\nbbb\nccc");
  });

  it("should split paragraphs at blank lines", () => {
    const result = parseBlocks("aaa\n\nbbb");
    const paragraphs = result.document.children.filter((n) => n.type === "paragraph");
    expect(paragraphs).toHaveLength(2);
    expect((paragraphs[0] as any).rawContent).toBe("aaa");
    expect((paragraphs[1] as any).rawContent).toBe("bbb");
  });

  it("should handle multiple blank lines between paragraphs", () => {
    const result = parseBlocks("aaa\n\n\nbbb");
    const paragraphs = result.document.children.filter((n) => n.type === "paragraph");
    expect(paragraphs).toHaveLength(2);
  });

  it("should strip leading spaces from paragraph lines", () => {
    const result = parseBlocks("  aaa\n bbb");
    expect(result.document.children).toHaveLength(1);
    expect(result.document.children[0].type).toBe("paragraph");
  });

  it("should break paragraph before heading", () => {
    const result = parseBlocks("foo\n# bar");
    expect(result.document.children).toHaveLength(2);
    expect(result.document.children[0].type).toBe("paragraph");
    expect(result.document.children[1].type).toBe("heading");
  });

  it("should track source location for multi-line paragraph", () => {
    const result = parseBlocks("aaa\nbbb");
    const para = result.document.children[0];
    expect(para.sourceLocation.start).toEqual({ line: 1, column: 1, offset: 0 });
    expect(para.sourceLocation.end).toEqual({ line: 2, column: 4, offset: 7 });
  });
});
