import { describe, it, expect } from "vitest";
import { parseBlocks } from "../../src/parser/block/block-parser.js";
import type { List } from "../../src/ast/nodes.js";

describe("Lists", () => {
  describe("Tight vs Loose", () => {
    it("should detect tight list (no blank lines between items)", () => {
      const result = parseBlocks("- foo\n- bar\n- baz");
      const list = result.document.children[0] as List;
      expect(list.tight).toBe(true);
    });

    it("should detect loose list (blank line between items)", () => {
      const result = parseBlocks("- foo\n\n- bar\n\n- baz");
      const list = result.document.children[0] as List;
      expect(list.tight).toBe(false);
    });

    it("should detect loose list (blank line within item)", () => {
      const result = parseBlocks("- a\n\n  b\n- c");
      const list = result.document.children[0] as List;
      expect(list.tight).toBe(false);
    });
  });

  describe("Nested lists", () => {
    it("should parse nested bullet list", () => {
      const result = parseBlocks("- a\n  - b\n  - c");
      const outerList = result.document.children[0] as List;
      expect(outerList.children).toHaveLength(1);
      // The inner list should be nested within the first item
      const innerList = outerList.children[0].children.find((c) => c.type === "list") as List;
      expect(innerList).toBeDefined();
      expect(innerList.children).toHaveLength(2);
    });

    it("should parse nested ordered list inside bullet", () => {
      const result = parseBlocks("- item\n  1. sub1\n  2. sub2");
      const outerList = result.document.children[0] as List;
      expect(outerList.ordered).toBe(false);
      const innerList = outerList.children[0].children.find((c) => c.type === "list") as List;
      expect(innerList).toBeDefined();
      expect(innerList.ordered).toBe(true);
    });
  });

  describe("Ordered list properties", () => {
    it("should track start number", () => {
      const result = parseBlocks("3. foo\n4. bar");
      const list = result.document.children[0] as List;
      expect(list.ordered).toBe(true);
      expect(list.start).toBe(3);
    });

    it("should handle start number 0", () => {
      const result = parseBlocks("0. foo");
      const list = result.document.children[0] as List;
      expect(list.start).toBe(0);
    });
  });

  describe("Source location", () => {
    it("should track list source location", () => {
      const result = parseBlocks("- foo\n- bar");
      const list = result.document.children[0] as List;
      expect(list.sourceLocation.start.line).toBe(1);
      expect(list.sourceLocation.end.line).toBe(2);
    });

    it("should track list item source location", () => {
      const result = parseBlocks("- foo\n- bar");
      const list = result.document.children[0] as List;
      expect(list.children[0].sourceLocation.start.line).toBe(1);
      expect(list.children[1].sourceLocation.start.line).toBe(2);
    });
  });

  // --- Coverage: line 355 (ordered delimiter comparison in lookahead) ---
  describe("Ordered list delimiter matching in lookahead", () => {
    it("should continue ordered list across blank lines with same delimiter", () => {
      // Two ordered items with "." delimiter separated by blank line
      const result = parseBlocks("1. foo\n\n2. bar");
      const list = result.document.children[0] as List;
      expect(list.type).toBe("list");
      expect(list.ordered).toBe(true);
      expect(list.children).toHaveLength(2);
      expect(list.tight).toBe(false); // loose because of blank line
    });

    it("should not continue ordered list across blank lines with different delimiter", () => {
      // "." and ")" delimiters should be separate lists
      const result = parseBlocks("1. foo\n\n2) bar");
      const lists = result.document.children.filter((n) => n.type === "list");
      expect(lists).toHaveLength(2);
    });
  });

  // --- Coverage: lines 363-364 (break when blank line has no next item of same type) ---
  describe("List termination at blank line", () => {
    it("should end list when blank line is followed by non-list content", () => {
      const result = parseBlocks("- foo\n\nparagraph");
      const list = result.document.children.find((n) => n.type === "list") as List;
      expect(list.children).toHaveLength(1);
      const para = result.document.children.find((n) => n.type === "paragraph");
      expect(para).toBeDefined();
    });

    it("should end list when blank line is followed by different list type", () => {
      const result = parseBlocks("- foo\n\n1. bar");
      const lists = result.document.children.filter((n) => n.type === "list");
      expect(lists).toHaveLength(2);
    });

    it("should end list at trailing blank line with nothing after", () => {
      const result = parseBlocks("- foo\n\n");
      const list = result.document.children.find((n) => n.type === "list") as List;
      expect(list.children).toHaveLength(1);
    });
  });
});
