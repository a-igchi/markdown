import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { parse } from "markdown-parser";
import { astToReact } from "../../src/rendering/ast-to-react.js";

function renderMarkdown(source: string) {
  const doc = parse(source);
  const elements = astToReact(doc, source);
  const { container } = render(<div>{elements}</div>);
  return container.firstElementChild as HTMLElement;
}

describe("astToReact", () => {
  describe("headings", () => {
    it("renders h1 with # prefix", () => {
      const el = renderMarkdown("# Heading 1");
      const h1 = el.querySelector("h1");
      expect(h1).not.toBeNull();
      expect(h1!.textContent).toBe("# Heading 1");
    });

    it("renders h2 with ## prefix", () => {
      const el = renderMarkdown("## Heading 2");
      const h2 = el.querySelector("h2");
      expect(h2).not.toBeNull();
      expect(h2!.textContent).toBe("## Heading 2");
    });

    it("renders h3 with ### prefix", () => {
      const el = renderMarkdown("### Heading 3");
      const h3 = el.querySelector("h3");
      expect(h3).not.toBeNull();
      expect(h3!.textContent).toBe("### Heading 3");
    });

    it("renders h6 with ###### prefix", () => {
      const el = renderMarkdown("###### Heading 6");
      const h6 = el.querySelector("h6");
      expect(h6).not.toBeNull();
      expect(h6!.textContent).toBe("###### Heading 6");
    });
  });

  describe("paragraphs", () => {
    it("renders a paragraph", () => {
      const el = renderMarkdown("Hello world");
      const p = el.querySelector("p");
      expect(p).not.toBeNull();
      expect(p!.textContent).toBe("Hello world");
    });

    it("renders multiple paragraphs separated by blank line", () => {
      const el = renderMarkdown("First paragraph\n\nSecond paragraph");
      const ps = el.querySelectorAll("p");
      expect(ps.length).toBe(2);
      expect(ps[0].textContent).toBe("First paragraph");
      expect(ps[1].textContent).toBe("Second paragraph");
    });
  });

  describe("unordered lists", () => {
    it("renders an unordered list with - markers", () => {
      const el = renderMarkdown("- item1\n- item2");
      const ul = el.querySelector("ul");
      expect(ul).not.toBeNull();
      const lis = ul!.querySelectorAll("li");
      expect(lis.length).toBe(2);
      expect(lis[0].textContent).toBe("- item1");
      expect(lis[1].textContent).toBe("- item2");
    });

    it("renders an unordered list with * markers", () => {
      const el = renderMarkdown("* foo\n* bar");
      const ul = el.querySelector("ul");
      expect(ul).not.toBeNull();
      const lis = ul!.querySelectorAll("li");
      expect(lis[0].textContent).toBe("* foo");
      expect(lis[1].textContent).toBe("* bar");
    });
  });

  describe("ordered lists", () => {
    it("renders an ordered list with markers", () => {
      const el = renderMarkdown("1. first\n2. second");
      const ol = el.querySelector("ol");
      expect(ol).not.toBeNull();
      const lis = ol!.querySelectorAll("li");
      expect(lis.length).toBe(2);
      expect(lis[0].textContent).toBe("1. first");
      expect(lis[1].textContent).toBe("2. second");
    });

    it("does not add start attribute when list starts at 1", () => {
      const el = renderMarkdown("1. first\n2. second");
      const ol = el.querySelector("ol");
      expect(ol!.getAttribute("start")).toBeNull();
    });

    it("adds start attribute when list starts at a number other than 1", () => {
      const el = renderMarkdown("3. third\n4. fourth");
      const ol = el.querySelector("ol");
      expect(ol).not.toBeNull();
      expect(ol!.getAttribute("start")).toBe("3");
    });
  });

  describe("inline formatting", () => {
    it("renders emphasis with * delimiters visible in <em>", () => {
      const el = renderMarkdown("This is *italic* text");
      const em = el.querySelector("em");
      expect(em).not.toBeNull();
      expect(em!.textContent).toBe("*italic*");
    });

    it("renders strong with ** delimiters visible in <strong>", () => {
      const el = renderMarkdown("This is **bold** text");
      const strong = el.querySelector("strong");
      expect(strong).not.toBeNull();
      expect(strong!.textContent).toBe("**bold**");
    });

    it("renders code span with backticks visible in <code>", () => {
      const el = renderMarkdown("Use `code` here");
      const code = el.querySelector("code");
      expect(code).not.toBeNull();
      expect(code!.textContent).toBe("`code`");
    });

    it("renders link with full syntax visible in <a>", () => {
      const el = renderMarkdown("Click [here](http://example.com)");
      const a = el.querySelector("a");
      expect(a).not.toBeNull();
      expect(a!.textContent).toBe("[here](http://example.com)");
      expect(a!.getAttribute("href")).toBe("http://example.com");
    });

    it("renders link with title attribute when specified", () => {
      const el = renderMarkdown('Click [here](http://example.com "My Title")');
      const a = el.querySelector("a");
      expect(a).not.toBeNull();
      expect(a!.getAttribute("title")).toBe("My Title");
    });

    it("renders link without title attribute when not specified", () => {
      const el = renderMarkdown("Click [here](http://example.com)");
      const a = el.querySelector("a");
      expect(a).not.toBeNull();
      expect(a!.getAttribute("title")).toBeNull();
    });
  });

  describe("thematic break", () => {
    it("renders thematic break with source text visible", () => {
      const el = renderMarkdown("---");
      const hr = el.querySelector("[data-block='thematic_break']");
      expect(hr).not.toBeNull();
      expect(hr!.textContent).toBe("---");
    });
  });

  describe("code block", () => {
    it("renders fenced code block with fences visible", () => {
      const source = "```js\nconsole.log('hi')\n```";
      const el = renderMarkdown(source);
      const pre = el.querySelector("pre");
      expect(pre).not.toBeNull();
      const code = pre!.querySelector("code");
      expect(code).not.toBeNull();
      expect(code!.textContent).toBe("```js\nconsole.log('hi')\n```");
    });

    it("adds language class to code element when info string is present", () => {
      const source = "```js\nconsole.log('hi')\n```";
      const el = renderMarkdown(source);
      const code = el.querySelector("pre code");
      expect(code).not.toBeNull();
      expect(code!.getAttribute("class")).toBe("language-js");
    });

    it("adds no class to code element when there is no info string", () => {
      const source = "```\nno language\n```";
      const el = renderMarkdown(source);
      const code = el.querySelector("pre code");
      expect(code).not.toBeNull();
      expect(code!.getAttribute("class")).toBeNull();
    });

    it("uses only the first word of the info string as the language", () => {
      const source = "```typescript extra\nlet x = 1\n```";
      const el = renderMarkdown(source);
      const code = el.querySelector("pre code");
      expect(code!.getAttribute("class")).toBe("language-typescript");
    });
  });

  describe("blockquote", () => {
    it("renders blockquote with child paragraph", () => {
      const el = renderMarkdown("> quoted text");
      const bq = el.querySelector("blockquote");
      expect(bq).not.toBeNull();
      // blockquote recursively renders children, so a <p> appears inside
      expect(bq!.querySelector("p")).not.toBeNull();
      expect(bq!.textContent).toBe("quoted text");
    });

    it("renders inline emphasis inside blockquote", () => {
      const el = renderMarkdown("> *italic* text");
      const bq = el.querySelector("blockquote");
      expect(bq).not.toBeNull();
      const em = bq!.querySelector("em");
      expect(em).not.toBeNull();
      expect(em!.textContent).toBe("*italic*");
    });

    it("renders inline strong inside blockquote", () => {
      const el = renderMarkdown("> **bold** text");
      const bq = el.querySelector("blockquote");
      expect(bq).not.toBeNull();
      const strong = bq!.querySelector("strong");
      expect(strong).not.toBeNull();
      expect(strong!.textContent).toBe("**bold**");
    });

    it("renders nested blockquotes", () => {
      const el = renderMarkdown("> > nested");
      const outer = el.querySelector("blockquote");
      expect(outer).not.toBeNull();
      const inner = outer!.querySelector("blockquote");
      expect(inner).not.toBeNull();
    });
  });

  describe("blank lines", () => {
    it("renders blank line as an empty block", () => {
      const el = renderMarkdown("# Hello\n\nWorld");
      const blankLines = el.querySelectorAll("[data-block='blank_line']");
      expect(blankLines.length).toBe(1);
    });
  });

  describe("softbreak", () => {
    it("renders softbreak as a newline character in the output", () => {
      // A softbreak is produced by a newline within a paragraph that doesn't
      // have trailing spaces (not a hardbreak). In commonmark, a single
      // newline inside a paragraph produces a softbreak.
      const source = "Line one\nLine two";
      const el = renderMarkdown(source);
      const p = el.querySelector("p");
      expect(p).not.toBeNull();
      // The softbreak renders as "\n" text, so the full text includes it
      expect(p!.textContent).toBe("Line one\nLine two");
    });
  });

  describe("hardbreak", () => {
    it("renders hardbreak as a <br> element", () => {
      // A hardbreak is produced by two or more trailing spaces before a newline
      // or a backslash before a newline within a paragraph.
      const source = "Line one  \nLine two";
      const el = renderMarkdown(source);
      const p = el.querySelector("p");
      expect(p).not.toBeNull();
      const br = p!.querySelector("br");
      expect(br).not.toBeNull();
    });

    it("renders hardbreak with backslash syntax", () => {
      const source = "Line one\\\nLine two";
      const el = renderMarkdown(source);
      const p = el.querySelector("p");
      expect(p).not.toBeNull();
      const br = p!.querySelector("br");
      expect(br).not.toBeNull();
    });
  });

  describe("list_item direct case", () => {
    it("renders list_item nodes through the list container", () => {
      // list_item is always rendered via list, but the switch case exists
      // at line 48. The list rendering path calls renderListItem directly.
      // We test by confirming list items render correctly.
      const el = renderMarkdown("- alpha\n- beta");
      const lis = el.querySelectorAll("li");
      expect(lis.length).toBe(2);
      expect(lis[0].textContent).toBe("- alpha");
      expect(lis[1].textContent).toBe("- beta");
    });
  });

  describe("complete document", () => {
    it("renders the task example correctly", () => {
      const source = "# Heading 1\n\nParagraph text.\n\n- list1\n- list2";
      const el = renderMarkdown(source);

      const h1 = el.querySelector("h1");
      expect(h1!.textContent).toBe("# Heading 1");

      const p = el.querySelector("p");
      expect(p!.textContent).toBe("Paragraph text.");

      const lis = el.querySelectorAll("li");
      expect(lis.length).toBe(2);
      expect(lis[0].textContent).toBe("- list1");
      expect(lis[1].textContent).toBe("- list2");
    });
  });
});
