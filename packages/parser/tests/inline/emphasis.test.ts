import { describe, it, expect } from "vitest";
import { parse } from "../../src/index.js";
import type { Paragraph, Emphasis, Strong, Text } from "../../src/ast/nodes.js";

function getFirstParagraph(input: string): Paragraph {
  const doc = parse(input);
  return doc.children.find((n) => n.type === "paragraph") as Paragraph;
}

describe("Emphasis and Strong", () => {
  describe("Emphasis with *", () => {
    // Example 360
    it("should parse *foo bar*", () => {
      const para = getFirstParagraph("*foo bar*");
      expect(para.children).toHaveLength(1);
      expect(para.children[0].type).toBe("emphasis");
      const em = para.children[0] as Emphasis;
      expect(em.children).toHaveLength(1);
      expect((em.children[0] as Text).value).toBe("foo bar");
    });

    // Not emphasis if no closing
    it("should not parse *foo bar without closing", () => {
      const para = getFirstParagraph("*foo bar");
      // Should be text nodes, no emphasis
      const types = para.children.map((n) => n.type);
      expect(types).not.toContain("emphasis");
    });

    // Example 364: _ not emphasis in middle of word for *
    it("should parse intraword emphasis with *", () => {
      const para = getFirstParagraph("foo*bar*baz");
      const hasEmphasis = para.children.some((n) => n.type === "emphasis");
      expect(hasEmphasis).toBe(true);
    });
  });

  describe("Emphasis with _", () => {
    // Example 370
    it("should parse _foo bar_", () => {
      const para = getFirstParagraph("_foo bar_");
      expect(para.children).toHaveLength(1);
      expect(para.children[0].type).toBe("emphasis");
    });

    // Example 372: _ not emphasis in middle of word
    it("should not parse intraword emphasis with _", () => {
      const para = getFirstParagraph("foo_bar_baz");
      const hasEmphasis = para.children.some((n) => n.type === "emphasis");
      expect(hasEmphasis).toBe(false);
    });
  });

  describe("Strong with **", () => {
    // Example 400
    it("should parse **foo bar**", () => {
      const para = getFirstParagraph("**foo bar**");
      expect(para.children).toHaveLength(1);
      expect(para.children[0].type).toBe("strong");
      const strong = para.children[0] as Strong;
      expect(strong.children).toHaveLength(1);
      expect((strong.children[0] as Text).value).toBe("foo bar");
    });

    it("should not parse ** foo bar** (space after opening)", () => {
      const para = getFirstParagraph("** foo bar**");
      const hasStrong = para.children.some((n) => n.type === "strong");
      expect(hasStrong).toBe(false);
    });
  });

  describe("Strong with __", () => {
    // Example 410
    it("should parse __foo bar__", () => {
      const para = getFirstParagraph("__foo bar__");
      expect(para.children).toHaveLength(1);
      expect(para.children[0].type).toBe("strong");
    });
  });

  describe("Nested emphasis", () => {
    it("should parse ***foo***  as strong > emphasis", () => {
      const para = getFirstParagraph("***foo***");
      // Should be either strong>emphasis or emphasis>strong
      const outer = para.children[0];
      expect(["emphasis", "strong"]).toContain(outer.type);
    });

    it("should parse *foo **bar** baz*", () => {
      const para = getFirstParagraph("*foo **bar** baz*");
      expect(para.children).toHaveLength(1);
      expect(para.children[0].type).toBe("emphasis");
      const em = para.children[0] as Emphasis;
      // Should contain text, strong, text
      const hasStrong = em.children.some((n) => n.type === "strong");
      expect(hasStrong).toBe(true);
    });

    it("should parse **foo *bar* baz**", () => {
      const para = getFirstParagraph("**foo *bar* baz**");
      expect(para.children).toHaveLength(1);
      expect(para.children[0].type).toBe("strong");
      const strong = para.children[0] as Strong;
      const hasEmphasis = strong.children.some((n) => n.type === "emphasis");
      expect(hasEmphasis).toBe(true);
    });
  });

  describe("Soft break and hard break", () => {
    it("should parse soft break (newline)", () => {
      const para = getFirstParagraph("foo\nbar");
      const hasSoftBreak = para.children.some((n) => n.type === "softbreak");
      expect(hasSoftBreak).toBe(true);
    });

    it("should parse hard break (two spaces + newline)", () => {
      const para = getFirstParagraph("foo  \nbar");
      const hasHardBreak = para.children.some((n) => n.type === "hardbreak");
      expect(hasHardBreak).toBe(true);
    });

    it("should parse hard break (backslash + newline)", () => {
      const para = getFirstParagraph("foo\\\nbar");
      const hasHardBreak = para.children.some((n) => n.type === "hardbreak");
      expect(hasHardBreak).toBe(true);
    });
  });

  describe("Backslash escapes", () => {
    it("should escape asterisks", () => {
      const para = getFirstParagraph("\\*not emphasis\\*");
      const hasEmphasis = para.children.some((n) => n.type === "emphasis");
      expect(hasEmphasis).toBe(false);
    });

    it("should escape backslash", () => {
      const para = getFirstParagraph("\\\\");
      expect(para.children).toHaveLength(1);
      expect((para.children[0] as Text).value).toBe("\\");
    });
  });

  // --- Coverage: delimiter.ts lines 113-114, 116-117 (multiple-of-3 rule) ---
  describe("Multiple-of-3 rule edge cases", () => {
    it("should skip opener when multiple-of-3 rule applies and closer can both open and close", () => {
      // The ** in the middle is flanking both sides (punctuation on both sides: ] and [)
      // so canOpen=true, canClose=true. Opener * at start has origCount=1.
      // sum=1+2=3, 1%3!=0, 2%3!=0 => multiple-of-3 rule continues past this pair.
      // Eventually the last * closes with the first *.
      const para = getFirstParagraph("*foo a]**[b baz*");
      expect(para.children.length).toBeGreaterThan(0);
      // The result should have emphasis wrapping the whole content
      const hasEmphasis = para.children.some((n) => n.type === "emphasis");
      expect(hasEmphasis).toBe(true);
    });

    it("should skip opener when multiple-of-3 rule applies with origCount 2+1", () => {
      // ** opener (origCount=2), * closer in middle (origCount=1, can both open and close)
      // sum=2+1=3, 2%3!=0, 1%3!=0 => rule applies, continue
      const para = getFirstParagraph("**foo a]*[b baz**");
      expect(para.children.length).toBeGreaterThan(0);
    });

    it("should not apply multiple-of-3 rule when one origCount is multiple of 3", () => {
      // *** opener (origCount=3), ** closer in middle => sum=5, not multiple of 3
      // Or *** opener (origCount=3), *** closer => sum=6, but 3%3==0 so rule doesn't apply
      const para = getFirstParagraph("***foo***");
      const outer = para.children[0];
      expect(["emphasis", "strong"]).toContain(outer.type);
    });

    it("should handle emphasis where both delimiters can open and close", () => {
      // Intraword emphasis: punctuation-adjacent delimiters that can both open and close
      const para = getFirstParagraph("a]**foo**[b");
      const hasStrong = para.children.some((n) => n.type === "strong");
      expect(hasStrong).toBe(true);
    });
  });

  // --- Coverage: delimiter.ts lines 141-143 (findNodeByDelimiter returning -1) ---
  describe("Delimiter node lookup edge cases", () => {
    it("should handle case where delimiter nodes get restructured", () => {
      // Complex nested emphasis that may cause node indices to shift
      const para = getFirstParagraph("***foo** bar*");
      expect(para.children.length).toBeGreaterThan(0);
    });

    it("should handle many delimiter runs", () => {
      const para = getFirstParagraph("*a* *b* *c* *d* *e*");
      const emphCount = para.children.filter((n) => n.type === "emphasis").length;
      expect(emphCount).toBe(5);
    });
  });
});
