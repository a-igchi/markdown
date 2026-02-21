import { describe, it, expect } from "vitest";
import { parse, renderToHtml } from "../../src/index.js";
import type { Heading, Paragraph, List, Text, Link } from "../../src/ast/nodes.js";

describe("Integration: AST structure", () => {
  it("should parse heading followed by paragraph", () => {
    const doc = parse("# Hello\n\nThis is a paragraph.");
    expect(doc.children.filter((n) => n.type !== "blank_line")).toHaveLength(2);
    expect(doc.children[0].type).toBe("heading");
    const heading = doc.children[0] as Heading;
    expect(heading.level).toBe(1);
    expect((heading.children[0] as Text).value).toBe("Hello");

    const para = doc.children.find((n) => n.type === "paragraph") as Paragraph;
    expect((para.children[0] as Text).value).toBe("This is a paragraph.");
  });

  it("should parse paragraph with emphasis followed by list", () => {
    const doc = parse("A *bold* move.\n\n- one\n- two\n- three");
    const para = doc.children.find((n) => n.type === "paragraph") as Paragraph;
    expect(para.children.some((n) => n.type === "emphasis")).toBe(true);

    const list = doc.children.find((n) => n.type === "list") as List;
    expect(list.children).toHaveLength(3);
    expect(list.tight).toBe(true);
    expect(list.ordered).toBe(false);
  });

  it("should parse nested list with paragraphs", () => {
    const input = "- item 1\n  - sub 1\n  - sub 2\n- item 2";
    const doc = parse(input);
    const outerList = doc.children[0] as List;
    expect(outerList.children).toHaveLength(2);

    const firstItem = outerList.children[0];
    const innerList = firstItem.children.find((c) => c.type === "list") as List;
    expect(innerList).toBeDefined();
    expect(innerList.children).toHaveLength(2);
  });

  it("should parse ordered list with start number", () => {
    const doc = parse("3. first\n4. second\n5. third");
    const list = doc.children[0] as List;
    expect(list.ordered).toBe(true);
    expect(list.start).toBe(3);
    expect(list.children).toHaveLength(3);
  });

  it("should parse document with multiple headings and paragraphs", () => {
    const input = [
      "# Title",
      "",
      "Introduction paragraph.",
      "",
      "## Section 1",
      "",
      "Content of section 1.",
      "",
      "## Section 2",
      "",
      "Content of section 2.",
    ].join("\n");

    const doc = parse(input);
    const headings = doc.children.filter((n) => n.type === "heading") as Heading[];
    const paragraphs = doc.children.filter((n) => n.type === "paragraph") as Paragraph[];

    expect(headings).toHaveLength(3);
    expect(headings[0].level).toBe(1);
    expect(headings[1].level).toBe(2);
    expect(headings[2].level).toBe(2);
    expect(paragraphs).toHaveLength(3);
  });

  it("should parse paragraph with link and emphasis", () => {
    const doc = parse("Visit [*my site*](https://example.com) today.");
    const para = doc.children[0] as Paragraph;
    const link = para.children.find((n) => n.type === "link") as Link;
    expect(link).toBeDefined();
    expect(link.destination).toBe("https://example.com");
    expect(link.children.some((n) => n.type === "emphasis")).toBe(true);
  });

  it("should parse link with reference definition", () => {
    const input = 'See [this article][ref] for details.\n\n[ref]: https://example.com "Title"';
    const doc = parse(input);
    const para = doc.children.find((n) => n.type === "paragraph") as Paragraph;
    const link = para.children.find((n) => n.type === "link") as Link;
    expect(link).toBeDefined();
    expect(link.destination).toBe("https://example.com");
    expect(link.title).toBe("Title");
  });

  it("should preserve source locations", () => {
    const doc = parse("# Hello\n\nWorld");
    const heading = doc.children[0] as Heading;
    expect(heading.sourceLocation.start.line).toBe(1);
    expect(heading.sourceLocation.start.offset).toBe(0);

    const para = doc.children.find((n) => n.type === "paragraph") as Paragraph;
    expect(para.sourceLocation.start.line).toBe(3);
  });
});

describe("Integration: HTML rendering", () => {
  it("should render heading", () => {
    const doc = parse("# Hello");
    expect(renderToHtml(doc)).toBe("<h1>Hello</h1>\n");
  });

  it("should render paragraph", () => {
    const doc = parse("Hello world");
    expect(renderToHtml(doc)).toBe("<p>Hello world</p>\n");
  });

  it("should render emphasis", () => {
    const doc = parse("*hello*");
    expect(renderToHtml(doc)).toBe("<p><em>hello</em></p>\n");
  });

  it("should render strong", () => {
    const doc = parse("**hello**");
    expect(renderToHtml(doc)).toBe("<p><strong>hello</strong></p>\n");
  });

  it("should render inline link", () => {
    const doc = parse("[link](/url)");
    expect(renderToHtml(doc)).toBe('<p><a href="/url">link</a></p>\n');
  });

  it("should render link with title", () => {
    const doc = parse('[link](/url "title")');
    expect(renderToHtml(doc)).toBe('<p><a href="/url" title="title">link</a></p>\n');
  });

  it("should render tight bullet list", () => {
    const doc = parse("- one\n- two\n- three");
    expect(renderToHtml(doc)).toBe("<ul>\n<li>one</li>\n<li>two</li>\n<li>three</li>\n</ul>\n");
  });

  it("should render loose bullet list", () => {
    const doc = parse("- one\n\n- two\n\n- three");
    expect(renderToHtml(doc)).toBe(
      "<ul>\n<li><p>one</p>\n</li>\n<li><p>two</p>\n</li>\n<li><p>three</p>\n</li>\n</ul>\n",
    );
  });

  it("should render ordered list", () => {
    const doc = parse("1. one\n2. two");
    expect(renderToHtml(doc)).toBe("<ol>\n<li>one</li>\n<li>two</li>\n</ol>\n");
  });

  it("should render ordered list with start", () => {
    const doc = parse("3. one\n4. two");
    expect(renderToHtml(doc)).toBe('<ol start="3">\n<li>one</li>\n<li>two</li>\n</ol>\n');
  });

  it("should render hard break", () => {
    const doc = parse("foo  \nbar");
    expect(renderToHtml(doc)).toBe("<p>foo<br />\nbar</p>\n");
  });

  it("should render soft break", () => {
    const doc = parse("foo\nbar");
    expect(renderToHtml(doc)).toBe("<p>foo\nbar</p>\n");
  });

  it("should escape HTML entities in text", () => {
    const doc = parse("a < b & c > d");
    expect(renderToHtml(doc)).toBe("<p>a &lt; b &amp; c &gt; d</p>\n");
  });

  it("should render complex document", () => {
    const input = [
      "# My Document",
      "",
      "A paragraph with **strong** and *emphasis*.",
      "",
      "- Item [one](/1)",
      "- Item two",
    ].join("\n");

    const doc = parse(input);
    const html = renderToHtml(doc);
    expect(html).toContain("<h1>My Document</h1>");
    expect(html).toContain("<strong>strong</strong>");
    expect(html).toContain("<em>emphasis</em>");
    expect(html).toContain('<a href="/1">one</a>');
    expect(html).toContain("<li>");
  });
});
