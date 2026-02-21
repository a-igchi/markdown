import { describe, it, expect } from "vitest";
import { parseBlocks } from "../../src/parser/block/block-parser.js";
import type { List } from "../../src/ast/nodes.js";

describe("List Items", () => {
  it("should parse bullet list items with -", () => {
    const result = parseBlocks("- foo\n- bar");
    expect(result.document.children).toHaveLength(1);
    const list = result.document.children[0] as List;
    expect(list.type).toBe("list");
    expect(list.ordered).toBe(false);
    expect(list.children).toHaveLength(2);
  });

  it("should parse bullet list items with *", () => {
    const result = parseBlocks("* foo\n* bar");
    const list = result.document.children[0] as List;
    expect(list.ordered).toBe(false);
    expect(list.children).toHaveLength(2);
  });

  it("should parse bullet list items with +", () => {
    const result = parseBlocks("+ foo\n+ bar");
    const list = result.document.children[0] as List;
    expect(list.ordered).toBe(false);
    expect(list.children).toHaveLength(2);
  });

  it("should parse ordered list items with .", () => {
    const result = parseBlocks("1. foo\n2. bar");
    const list = result.document.children[0] as List;
    expect(list.type).toBe("list");
    expect(list.ordered).toBe(true);
    expect(list.start).toBe(1);
    expect(list.children).toHaveLength(2);
  });

  it("should parse ordered list items with )", () => {
    const result = parseBlocks("1) foo\n2) bar");
    const list = result.document.children[0] as List;
    expect(list.ordered).toBe(true);
    expect(list.children).toHaveLength(2);
  });

  it("should parse ordered list starting at non-1", () => {
    const result = parseBlocks("3. foo\n4. bar");
    const list = result.document.children[0] as List;
    expect(list.start).toBe(3);
  });

  it("should support list items with 0-3 spaces indent", () => {
    const inputs = ["- foo", " - foo", "  - foo", "   - foo"];
    for (const input of inputs) {
      const result = parseBlocks(input);
      const list = result.document.children[0] as List;
      expect(list.type).toBe("list");
    }
  });

  it("should not treat 4-space indented marker as list", () => {
    const result = parseBlocks("    - foo");
    // Should be a paragraph (code block is not implemented, falls through)
    expect(result.document.children[0].type).toBe("paragraph");
  });

  it("should parse item with continuation lines", () => {
    const result = parseBlocks("- foo\n  bar\n  baz");
    const list = result.document.children[0] as List;
    expect(list.children).toHaveLength(1);
    const item = list.children[0];
    const para = item.children.find((c) => c.type === "paragraph") as any;
    expect(para.rawContent).toBe("foo\nbar\nbaz");
  });

  it("should parse empty list item", () => {
    const result = parseBlocks("- \n- foo");
    const list = result.document.children[0] as List;
    expect(list.children).toHaveLength(2);
  });

  it("should split different bullet chars into separate lists", () => {
    const result = parseBlocks("- foo\n+ bar");
    const lists = result.document.children.filter((n) => n.type === "list");
    expect(lists).toHaveLength(2);
  });

  it("should split different ordered delimiters into separate lists", () => {
    const result = parseBlocks("1. foo\n2) bar");
    const lists = result.document.children.filter((n) => n.type === "list");
    expect(lists).toHaveLength(2);
  });

  it("should store marker info", () => {
    const result = parseBlocks("- foo");
    const list = result.document.children[0] as List;
    expect(list.children[0].marker).toBe("-");
  });

  it("should store ordered marker info", () => {
    const result = parseBlocks("10. foo");
    const list = result.document.children[0] as List;
    expect(list.children[0].marker).toBe("10.");
    expect(list.start).toBe(10);
  });

  // --- Coverage: lines 290-299 (empty bullet list item with no content) ---
  it("should parse empty bullet list item with no trailing space content", () => {
    // "- " followed by nothing — hits the emptyBullet regex branch
    const result = parseBlocks("-\n- foo");
    const list = result.document.children[0] as List;
    expect(list.children).toHaveLength(2);
    expect(list.children[0].marker).toBe("-");
  });

  it("should parse standalone empty bullet item", () => {
    const result = parseBlocks("-");
    const list = result.document.children[0] as List;
    expect(list.type).toBe("list");
    expect(list.children).toHaveLength(1);
    expect(list.ordered).toBe(false);
  });

  // --- Coverage: lines 303-315 (empty ordered list item with no content) ---
  it("should parse empty ordered list item with no trailing content", () => {
    const result = parseBlocks("1.\n2. foo");
    const list = result.document.children[0] as List;
    expect(list.children).toHaveLength(2);
    expect(list.ordered).toBe(true);
    expect(list.children[0].marker).toBe("1.");
  });

  it("should parse standalone empty ordered item", () => {
    const result = parseBlocks("1.");
    const list = result.document.children[0] as List;
    expect(list.type).toBe("list");
    expect(list.ordered).toBe(true);
    expect(list.children).toHaveLength(1);
  });

  it("should parse empty ordered item with ) delimiter", () => {
    const result = parseBlocks("1)");
    const list = result.document.children[0] as List;
    expect(list.ordered).toBe(true);
    expect(list.children[0].marker).toBe("1)");
  });

  // --- Coverage: lines 471-477 (lazy continuation in list items) ---
  it("should support lazy continuation lines in list items", () => {
    // A line not indented enough that continues a paragraph (lazy continuation)
    const result = parseBlocks("- foo\nbar");
    const list = result.document.children[0] as List;
    expect(list.children).toHaveLength(1);
    const item = list.children[0];
    const para = item.children.find((c) => c.type === "paragraph") as any;
    expect(para).toBeDefined();
    expect(para.rawContent).toContain("bar");
  });
});
