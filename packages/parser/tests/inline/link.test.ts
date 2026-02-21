import { describe, it, expect } from "vitest";
import { parse } from "../../src/index.js";
import type { Paragraph, Link, Text } from "../../src/ast/nodes.js";

function getFirstParagraph(input: string): Paragraph {
  const doc = parse(input);
  return doc.children.find((n) => n.type === "paragraph") as Paragraph;
}

describe("Links", () => {
  describe("Inline links", () => {
    // Example 481
    it("should parse [link](/url)", () => {
      const para = getFirstParagraph("[link](/url)");
      expect(para.children).toHaveLength(1);
      const link = para.children[0] as Link;
      expect(link.type).toBe("link");
      expect(link.destination).toBe("/url");
      expect(link.title).toBeNull();
      expect(link.children).toHaveLength(1);
      expect((link.children[0] as Text).value).toBe("link");
    });

    // Example 482
    it("should parse link with title", () => {
      const para = getFirstParagraph('[link](/url "title")');
      const link = para.children[0] as Link;
      expect(link.destination).toBe("/url");
      expect(link.title).toBe("title");
    });

    // Example 483
    it("should parse link with title in single quotes", () => {
      const para = getFirstParagraph("[link](/url 'title')");
      const link = para.children[0] as Link;
      expect(link.title).toBe("title");
    });

    // Example 484
    it("should parse link with title in parens", () => {
      const para = getFirstParagraph("[link](/url (title))");
      const link = para.children[0] as Link;
      expect(link.title).toBe("title");
    });

    it("should parse link with empty destination", () => {
      const para = getFirstParagraph("[link]()");
      const link = para.children[0] as Link;
      expect(link.destination).toBe("");
      expect(link.title).toBeNull();
    });

    it("should parse link with angle bracket destination", () => {
      const para = getFirstParagraph("[link](<url>)");
      const link = para.children[0] as Link;
      expect(link.destination).toBe("url");
    });

    it("should parse link text with emphasis", () => {
      const para = getFirstParagraph("[*foo*](/url)");
      const link = para.children[0] as Link;
      expect(link.children).toHaveLength(1);
      expect(link.children[0].type).toBe("emphasis");
    });

    it("should handle escaped brackets in text", () => {
      const para = getFirstParagraph("[foo\\]bar](/url)");
      const link = para.children[0] as Link;
      expect(link.children).toHaveLength(1);
      expect((link.children[0] as Text).value).toBe("foo]bar");
    });
  });

  describe("Reference links", () => {
    it("should parse full reference link", () => {
      const doc = parse("[foo][bar]\n\n[bar]: /url");
      const para = doc.children.find((n) => n.type === "paragraph") as Paragraph;
      expect(para.children).toHaveLength(1);
      const link = para.children[0] as Link;
      expect(link.type).toBe("link");
      expect(link.destination).toBe("/url");
    });

    it("should parse collapsed reference link", () => {
      const doc = parse("[foo][]\n\n[foo]: /url");
      const para = doc.children.find((n) => n.type === "paragraph") as Paragraph;
      const link = para.children[0] as Link;
      expect(link.destination).toBe("/url");
    });

    it("should parse shortcut reference link", () => {
      const doc = parse("[foo]\n\n[foo]: /url");
      const para = doc.children.find((n) => n.type === "paragraph") as Paragraph;
      const link = para.children[0] as Link;
      expect(link.destination).toBe("/url");
    });

    it("should parse reference link with title", () => {
      const doc = parse('[foo]\n\n[foo]: /url "title"');
      const para = doc.children.find((n) => n.type === "paragraph") as Paragraph;
      const link = para.children[0] as Link;
      expect(link.destination).toBe("/url");
      expect(link.title).toBe("title");
    });

    it("should be case-insensitive for labels", () => {
      const doc = parse("[FOO]\n\n[foo]: /url");
      const para = doc.children.find((n) => n.type === "paragraph") as Paragraph;
      const link = para.children[0] as Link;
      expect(link.destination).toBe("/url");
    });

    it("should use first definition if duplicate labels", () => {
      const doc = parse("[foo]\n\n[foo]: /url1\n[foo]: /url2");
      const para = doc.children.find((n) => n.type === "paragraph") as Paragraph;
      const link = para.children[0] as Link;
      expect(link.destination).toBe("/url1");
    });

    it("should not match undefined reference", () => {
      const doc = parse("[bar]\n\n[foo]: /url");
      const para = doc.children.find((n) => n.type === "paragraph") as Paragraph;
      // Should not be a link
      const hasLink = para.children.some((n) => n.type === "link");
      expect(hasLink).toBe(false);
    });
  });

  // --- Coverage: inline-parser line 365 (parseBracketedText returning null) ---
  describe("Unclosed brackets", () => {
    it("should treat unclosed bracket as text", () => {
      const para = getFirstParagraph("[unclosed");
      expect(para.children).toHaveLength(1);
      expect((para.children[0] as Text).value).toBe("[unclosed");
    });

    it("should treat unclosed nested bracket as text", () => {
      const para = getFirstParagraph("[open[nested]");
      // The inner [nested] is matched but [open is not a link
      const types = para.children.map((n) => n.type);
      expect(types).not.toContain("link");
    });
  });

  // --- Coverage: inline-parser lines 394-395 (escaped char in angle-bracket link dest) ---
  describe("Angle-bracket destination with escapes", () => {
    it("should handle escaped characters in angle-bracket destination", () => {
      const para = getFirstParagraph("[link](<url\\>stuff>)");
      const link = para.children[0] as Link;
      expect(link.type).toBe("link");
      expect(link.destination).toBe("url>stuff");
    });
  });

  // --- Coverage: inline-parser lines 410, 413 (parentheses in link destination) ---
  describe("Parentheses in link destination", () => {
    it("should handle balanced parentheses in destination", () => {
      const para = getFirstParagraph("[link](url(with)parens)");
      const link = para.children[0] as Link;
      expect(link.type).toBe("link");
      expect(link.destination).toBe("url(with)parens");
    });

    it("should handle nested parentheses in destination", () => {
      const para = getFirstParagraph("[link](url(a(b)c))");
      const link = para.children[0] as Link;
      expect(link.destination).toBe("url(a(b)c)");
    });
  });

  // --- Coverage: inline-parser lines 415-419 (escaped char in link destination) ---
  describe("Escaped characters in link destination", () => {
    it("should handle backslash escapes in destination", () => {
      const para = getFirstParagraph("[link](url\\)end)");
      const link = para.children[0] as Link;
      expect(link.type).toBe("link");
      expect(link.destination).toContain(")");
    });

    it("should handle escaped space character in destination", () => {
      const para = getFirstParagraph("[link](url\\.ext)");
      const link = para.children[0] as Link;
      expect(link.destination).toBe("url.ext");
    });
  });

  // --- Coverage: inline-parser lines 440-441 (escaped char in link title) ---
  describe("Escaped characters in link title", () => {
    it("should handle escaped quote in link title", () => {
      const para = getFirstParagraph('[link](/url "title\\"quote")');
      const link = para.children[0] as Link;
      expect(link.type).toBe("link");
      expect(link.title).toBe('title"quote');
    });

    it("should handle escaped char in single-quoted title", () => {
      const para = getFirstParagraph("[link](/url 'title\\'s')");
      const link = para.children[0] as Link;
      expect(link.title).toBe("title's");
    });
  });

  // --- Coverage: block-parser lines 695-696 (non-blank content after title in link ref) ---
  describe("Link reference definition edge cases", () => {
    it("should not parse ref def with non-blank content after title", () => {
      const doc = parse('[foo]: /url "title" extra\n\n[foo]');
      const para = doc.children.find((n) => n.type === "paragraph") as Paragraph;
      // [foo] should not be a link since the ref def is invalid
      const hasLink = para.children.some((n) => n.type === "link");
      expect(hasLink).toBe(false);
    });

    // --- Coverage: block-parser lines 698-699 (non-blank, non-title after destination) ---
    it("should not parse ref def with non-title content after destination", () => {
      const doc = parse("[foo]: /url garbage\n\n[foo]");
      const para = doc.children.find((n) => n.type === "paragraph") as Paragraph;
      const hasLink = para.children.some((n) => n.type === "link");
      expect(hasLink).toBe(false);
    });

    // --- Coverage: block-parser lines 706-711 (title on next line) ---
    it("should parse ref def with title on next line", () => {
      const doc = parse('[foo]: /url\n"title on next line"\n\n[foo]');
      const para = doc.children.find((n) => n.type === "paragraph") as Paragraph;
      const link = para.children[0] as Link;
      expect(link.type).toBe("link");
      expect(link.destination).toBe("/url");
      expect(link.title).toBe("title on next line");
    });

    // --- Coverage: block-parser lines 724-729 (angle-bracket destination in ref def) ---
    it("should parse ref def with angle-bracket destination", () => {
      const doc = parse("[foo]: <http://example.com/path>\n\n[foo]");
      const para = doc.children.find((n) => n.type === "paragraph") as Paragraph;
      const link = para.children[0] as Link;
      expect(link.type).toBe("link");
      expect(link.destination).toBe("http://example.com/path");
    });

    // --- Coverage: block-parser line 738 (parentheses in link ref destination) ---
    it("should parse ref def with parentheses in destination", () => {
      const doc = parse("[foo]: /url(with)parens\n\n[foo]");
      const para = doc.children.find((n) => n.type === "paragraph") as Paragraph;
      const link = para.children[0] as Link;
      expect(link.destination).toBe("/url(with)parens");
    });

    // --- Coverage: block-parser lines 740-741 (balanced parens break in link ref dest) ---
    it("should handle closing paren at zero depth stopping destination scan", () => {
      // The ) at depth 0 stops the destination at "/url", leaving ")rest" behind.
      // ")rest" is not a valid title, so the ref def is invalid and [foo] is not a link.
      const doc = parse("[foo]: /url)rest\n\n[foo]");
      const para = doc.children.find((n) => n.type === "paragraph") as Paragraph;
      const hasLink = para.children.some((n) => n.type === "link");
      expect(hasLink).toBe(false);
    });

    // --- Coverage: block-parser lines 743-744 (escaped chars in link ref destination) ---
    it("should handle escaped characters in ref destination", () => {
      const doc = parse("[foo]: /url\\.path\n\n[foo]");
      const para = doc.children.find((n) => n.type === "paragraph") as Paragraph;
      const link = para.children[0] as Link;
      expect(link.destination).toContain("\\.");
    });

    // --- Coverage: block-parser lines 766-767 (escaped char in link title) ---
    it("should handle escaped characters in ref title", () => {
      const doc = parse('[foo]: /url "title\\"quoted"\n\n[foo]');
      const para = doc.children.find((n) => n.type === "paragraph") as Paragraph;
      const link = para.children[0] as Link;
      expect(link.title).toBe('title"quoted');
    });

    // --- Coverage: block-parser lines 776-777 (unclosed link title) ---
    it("should not parse ref def with unclosed title", () => {
      const doc = parse('[foo]: /url "unclosed title\n\n[foo]');
      const para = doc.children.find((n) => n.type === "paragraph") as Paragraph;
      const hasLink = para.children.some((n) => n.type === "link");
      expect(hasLink).toBe(false);
    });

    // --- Coverage: block-parser lines 728-729 (unclosed angle-bracket destination) ---
    it("should not parse ref def with unclosed angle-bracket destination", () => {
      const doc = parse("[foo]: <unclosed\n\n[foo]");
      const para = doc.children.find((n) => n.type === "paragraph") as Paragraph;
      const hasLink = para.children.some((n) => n.type === "link");
      expect(hasLink).toBe(false);
    });

    it("should not parse ref def with angle-bracket containing newline", () => {
      const doc = parse("[foo]: <url with\nnewline>\n\n[foo]");
      const para = doc.children.find((n) => n.type === "paragraph") as Paragraph;
      const hasLink = para.children.some((n) => n.type === "link");
      expect(hasLink).toBe(false);
    });
  });
});
