import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { parse } from "parser-cst";
import { cstToReact } from "./cst-to-react.js";

function renderMarkdown(source: string) {
  const doc = parse(source);
  const elements = cstToReact(doc);
  const { container } = render(<div>{elements}</div>);
  return container.firstElementChild as HTMLElement;
}

describe("cstToReact", () => {
  describe("headings", () => {
    it("renders h1 with # prefix", () => {
      const el = renderMarkdown("# Heading 1");
      const h1 = el.querySelector("h1");
      expect(h1).not.toBeNull();
      expect(h1!.textContent).toBe("# Heading 1");
      expect(h1!.dataset.block).toBe("heading");
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
      expect(p!.dataset.block).toBe("paragraph");
    });

    it("renders multiple paragraphs separated by blank line", () => {
      const el = renderMarkdown("First paragraph\n\nSecond paragraph");
      const ps = el.querySelectorAll("p");
      expect(ps.length).toBe(2);
      expect(ps[0].textContent).toBe("First paragraph");
      expect(ps[1].textContent).toBe("Second paragraph");
    });

    it("renders multiline paragraph", () => {
      const el = renderMarkdown("Line one\nLine two");
      const p = el.querySelector("p");
      expect(p).not.toBeNull();
      expect(p!.textContent).toBe("Line one\nLine two");
    });
  });

  describe("thematic break", () => {
    it("renders thematic break with source text visible", () => {
      const el = renderMarkdown("---");
      const hr = el.querySelector("[data-block='thematic_break']");
      expect(hr).not.toBeNull();
      expect(hr!.textContent).toBe("---");
    });

    it("renders thematic break with asterisks", () => {
      const el = renderMarkdown("***");
      const hr = el.querySelector("[data-block='thematic_break']");
      expect(hr).not.toBeNull();
      expect(hr!.textContent).toBe("***");
    });
  });

  describe("unordered lists", () => {
    it("renders an unordered list with - markers", () => {
      const el = renderMarkdown("- item1\n- item2");
      const ul = el.querySelector("ul");
      expect(ul).not.toBeNull();
      const items = ul!.querySelectorAll("[data-block='list_item']");
      expect(items.length).toBe(2);
      expect(items[0].textContent).toBe("- item1");
      expect(items[1].textContent).toBe("- item2");
      // Tight leaf: directly on <li>
      expect(items[0].tagName.toLowerCase()).toBe("li");
      expect(items[1].tagName.toLowerCase()).toBe("li");
    });

    it("renders an unordered list with * markers", () => {
      const el = renderMarkdown("* foo\n* bar");
      const ul = el.querySelector("ul");
      expect(ul).not.toBeNull();
      const items = ul!.querySelectorAll("[data-block='list_item']");
      expect(items[0].textContent).toBe("* foo");
      expect(items[1].textContent).toBe("* bar");
    });
  });

  describe("ordered lists", () => {
    it("renders an ordered list with markers", () => {
      const el = renderMarkdown("1. first\n2. second");
      const ol = el.querySelector("ol");
      expect(ol).not.toBeNull();
      const items = ol!.querySelectorAll("[data-block='list_item']");
      expect(items.length).toBe(2);
      expect(items[0].textContent).toBe("1. first");
      expect(items[1].textContent).toBe("2. second");
    });
  });

  describe("nested lists", () => {
    it("renders nested list items with proper nesting", () => {
      const el = renderMarkdown("- parent\n  - child");
      // Top-level <ul> should have a single direct <li>
      const topUl = el.querySelector("ul")!;
      const topLis = topUl.children;
      expect(topLis.length).toBe(1);
      // All list_item elements
      const items = el.querySelectorAll("[data-block='list_item']");
      expect(items.length).toBe(2);
      expect(items[0].textContent).toBe("- parent");
      expect(items[1].textContent).toBe("  - child");
      // Parent text is in a <div> wrapper (tight + nested)
      expect(items[0].tagName.toLowerCase()).toBe("div");
      // Child is a leaf <li> with data-block
      expect(items[1].tagName.toLowerCase()).toBe("li");
      // child is in a nested <ul> inside the parent <li>
      const nestedUl = topLis[0].querySelector("ul");
      expect(nestedUl).not.toBeNull();
    });
  });

  describe("loose lists", () => {
    it("renders loose list with blank lines between items", () => {
      const el = renderMarkdown("- item1\n\n- item2");
      const items = el.querySelectorAll("[data-block='list_item']");
      expect(items.length).toBe(2);
      // Loose items use <p> wrapper
      expect(items[0].tagName.toLowerCase()).toBe("p");
      expect(items[1].tagName.toLowerCase()).toBe("p");
      // There should be a blank_line block between the items
      const blankLines = el.querySelectorAll("[data-block='blank_line']");
      expect(blankLines.length).toBe(1);
    });

    it("renders loose + nested list correctly", () => {
      const el = renderMarkdown("- parent\n\n  - child");
      const items = el.querySelectorAll("[data-block='list_item']");
      expect(items.length).toBe(2);
      // Parent text is in <p> (loose)
      expect(items[0].tagName.toLowerCase()).toBe("p");
      expect(items[0].textContent).toBe("- parent");
    });
  });

  describe("blank lines", () => {
    it("renders blank line as an empty block", () => {
      const el = renderMarkdown("# Hello\n\nWorld");
      const blankLines = el.querySelectorAll("[data-block='blank_line']");
      expect(blankLines.length).toBe(1);
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

      const items = el.querySelectorAll("[data-block='list_item']");
      expect(items.length).toBe(2);
      expect(items[0].textContent).toBe("- list1");
      expect(items[1].textContent).toBe("- list2");
    });

    it("renders headings, paragraphs, lists, thematic break, and blank lines", () => {
      const source =
        "# Title\n\nSome text.\n\n- item 1\n- item 2\n\n---\n\n1. one\n2. two";
      const el = renderMarkdown(source);

      expect(el.querySelector("h1")).not.toBeNull();
      expect(el.querySelector("p")).not.toBeNull();
      expect(el.querySelector("ul")).not.toBeNull();
      expect(el.querySelector("[data-block='thematic_break']")).not.toBeNull();
      expect(el.querySelector("ol")).not.toBeNull();
    });
  });
});
