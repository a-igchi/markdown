import { describe, it, expect } from "vitest";
import { parse, renderToHtml } from "../../src/index.js";

describe("Thematic Breaks", () => {
  // Example 43: Three characters
  it("should parse --- as thematic break", () => {
    const doc = parse("---");
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].type).toBe("thematic_break");
  });

  it("should parse *** as thematic break", () => {
    const doc = parse("***");
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].type).toBe("thematic_break");
  });

  it("should parse ___ as thematic break", () => {
    const doc = parse("___");
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].type).toBe("thematic_break");
  });

  // Example 44: Not enough characters
  it("should not parse -- as thematic break", () => {
    const doc = parse("--");
    expect(doc.children[0].type).toBe("paragraph");
  });

  it("should not parse ** as thematic break", () => {
    const doc = parse("**");
    expect(doc.children[0].type).toBe("paragraph");
  });

  it("should not parse __ as thematic break", () => {
    const doc = parse("__");
    expect(doc.children[0].type).toBe("paragraph");
  });

  // Example 49: More than three characters
  it("should parse more than three characters", () => {
    const doc = parse("-----");
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].type).toBe("thematic_break");
  });

  // Example 50: Spaces between characters are allowed
  it("should allow spaces between characters", () => {
    const doc = parse("- - -");
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].type).toBe("thematic_break");
  });

  it("should allow spaces between stars", () => {
    const doc = parse(" * * *");
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].type).toBe("thematic_break");
  });

  it("should allow spaces between underscores", () => {
    const doc = parse(" _ _ _");
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].type).toBe("thematic_break");
  });

  // Example 51: More than 3 spaces indent is not a thematic break
  it("should not parse with 4 spaces indent", () => {
    const doc = parse("    ---");
    expect(doc.children[0].type).not.toBe("thematic_break");
  });

  // Example 53: 1-3 spaces indent is OK
  it("should allow 1-3 spaces indent", () => {
    const doc1 = parse(" ---");
    expect(doc1.children[0].type).toBe("thematic_break");

    const doc2 = parse("  ---");
    expect(doc2.children[0].type).toBe("thematic_break");

    const doc3 = parse("   ---");
    expect(doc3.children[0].type).toBe("thematic_break");
  });

  // Example 55: Cannot mix different characters
  it("should not allow mixing different characters", () => {
    const doc = parse("-*-");
    expect(doc.children[0].type).not.toBe("thematic_break");
  });

  // Example 56: Thematic breaks can interrupt a paragraph
  it("should interrupt a paragraph", () => {
    const doc = parse("foo\n---");
    // According to CommonMark, --- after text is a setext heading,
    // but since we don't support setext headings, it should be paragraph + thematic break
    expect(doc.children.length).toBeGreaterThanOrEqual(2);
  });

  // HTML rendering
  it("should render as <hr />", () => {
    const doc = parse("---");
    expect(renderToHtml(doc)).toBe("<hr />\n");
  });

  // Source location
  it("should track source location", () => {
    const doc = parse("---");
    expect(doc.children[0].sourceLocation.start).toEqual({ line: 1, column: 1, offset: 0 });
  });
});
