import { describe, it, expect } from "vitest";
import { parseBlocks } from "../../src/parser/block/block-parser.js";

describe("ATX Headings", () => {
  // Example 62: Simple headings level 1-6
  it("should parse headings level 1-6", () => {
    const input = "# foo\n## foo\n### foo\n#### foo\n##### foo\n###### foo";
    const result = parseBlocks(input);
    const headings = result.document.children.filter((n) => n.type === "heading");
    expect(headings).toHaveLength(6);
    expect(headings.map((h) => h.level)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  // Example 63: More than 6 # is not a heading
  it("should not parse 7+ hashes as heading", () => {
    const result = parseBlocks("####### foo");
    const headings = result.document.children.filter((n) => n.type === "heading");
    expect(headings).toHaveLength(0);
  });

  // Example 64: Need space after hashes
  it("should require space after hashes", () => {
    const result = parseBlocks("#5 bolt");
    const headings = result.document.children.filter((n) => n.type === "heading");
    expect(headings).toHaveLength(0);
  });

  // Example 65: Escaped # is not a heading
  it("should treat escaped hash as not a heading", () => {
    const result = parseBlocks("\\## foo");
    const headings = result.document.children.filter((n) => n.type === "heading");
    expect(headings).toHaveLength(0);
  });

  // Example 66: Content after hashes
  it("should parse heading with inline content", () => {
    const result = parseBlocks("# foo *bar* \\*baz\\*");
    const headings = result.document.children.filter((n) => n.type === "heading");
    expect(headings).toHaveLength(1);
    expect((headings[0] as any).rawContent).toBe("foo *bar* \\*baz\\*");
  });

  // Example 67: Leading and trailing spaces stripped
  it("should strip leading and trailing spaces from content", () => {
    const result = parseBlocks("#                  foo                     ");
    const headings = result.document.children.filter((n) => n.type === "heading");
    expect(headings).toHaveLength(1);
    expect((headings[0] as any).rawContent).toBe("foo");
  });

  // Example 68: 1-3 spaces indentation allowed
  it("should allow 1-3 spaces of leading indentation", () => {
    const inputs = [" # foo", "  # foo", "   # foo"];
    for (const input of inputs) {
      const result = parseBlocks(input);
      const headings = result.document.children.filter((n) => n.type === "heading");
      expect(headings).toHaveLength(1);
    }
  });

  // Example 69: 4 spaces is too much
  it("should not parse heading with 4+ spaces indent", () => {
    const result = parseBlocks("    # foo");
    const headings = result.document.children.filter((n) => n.type === "heading");
    expect(headings).toHaveLength(0);
  });

  // Example 73: Closing # sequence optional
  it("should allow optional closing # sequence", () => {
    const result = parseBlocks("## foo ##");
    const headings = result.document.children.filter((n) => n.type === "heading");
    expect(headings).toHaveLength(1);
    expect(headings[0].level).toBe(2);
    expect((headings[0] as any).rawContent).toBe("foo");
  });

  // Example 74: Closing sequence can differ in length
  it("should allow closing # sequence of any length", () => {
    const result = parseBlocks("# foo ##################################");
    const headings = result.document.children.filter((n) => n.type === "heading");
    expect(headings).toHaveLength(1);
    expect(headings[0].level).toBe(1);
    expect((headings[0] as any).rawContent).toBe("foo");
  });

  // Example 75: Closing sequence must have spaces before it
  it("should require space before closing # sequence", () => {
    const result = parseBlocks("### foo ###");
    const headings = result.document.children.filter((n) => n.type === "heading");
    expect(headings).toHaveLength(1);
    expect((headings[0] as any).rawContent).toBe("foo");
  });

  // Example 77: Trailing # not part of heading if not preceded by space
  it("should not strip # without leading space", () => {
    const result = parseBlocks("### foo#");
    const headings = result.document.children.filter((n) => n.type === "heading");
    expect(headings).toHaveLength(1);
    expect((headings[0] as any).rawContent).toBe("foo#");
  });

  // Example 79: Empty heading
  it("should parse empty heading", () => {
    const inputs = ["## ", "#", "### ###"];
    for (const input of inputs) {
      const result = parseBlocks(input);
      const headings = result.document.children.filter((n) => n.type === "heading");
      expect(headings).toHaveLength(1);
    }
  });

  // Source location
  it("should track source location", () => {
    const result = parseBlocks("# Hello");
    const heading = result.document.children[0];
    expect(heading.sourceLocation.start).toEqual({ line: 1, column: 1, offset: 0 });
    expect(heading.sourceLocation.end).toEqual({ line: 1, column: 8, offset: 7 });
  });
});
