import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { parse } from "markdown-parser";
import { astToReact } from "../../src/rendering/ast-to-react.js";
import { extractText } from "../../src/text-extraction/extract-text.js";

function roundTrip(source: string): string {
  const doc = parse(source);
  const elements = astToReact(doc, source);
  const { container } = render(<div>{elements}</div>);
  return extractText(container.firstElementChild as HTMLElement);
}

describe("extractText", () => {
  describe("block elements", () => {
    it("extracts heading text", () => {
      expect(roundTrip("# Heading 1")).toBe("# Heading 1");
    });

    it("extracts paragraph text", () => {
      expect(roundTrip("Hello world")).toBe("Hello world");
    });

    it("extracts heading and paragraph separated by blank line", () => {
      const source = "# Title\n\nSome text";
      expect(roundTrip(source)).toBe(source);
    });

    it("extracts multiple paragraphs", () => {
      const source = "First\n\nSecond";
      expect(roundTrip(source)).toBe(source);
    });
  });

  describe("lists", () => {
    it("extracts unordered list", () => {
      const source = "- item1\n- item2";
      expect(roundTrip(source)).toBe(source);
    });

    it("extracts ordered list", () => {
      const source = "1. first\n2. second";
      expect(roundTrip(source)).toBe(source);
    });

    it("round-trips a loose unordered list (blank lines between items)", () => {
      const source = "- first\n\n- second";
      expect(roundTrip(source)).toBe(source);
    });

    it("round-trips a loose ordered list", () => {
      const source = "1. alpha\n\n2. beta";
      expect(roundTrip(source)).toBe(source);
    });

    it("round-trips a loose list with three items", () => {
      const source = "- a\n\n- b\n\n- c";
      expect(roundTrip(source)).toBe(source);
    });
  });

  describe("inline formatting", () => {
    it("extracts emphasis", () => {
      const source = "This is *italic* text";
      expect(roundTrip(source)).toBe(source);
    });

    it("extracts strong", () => {
      const source = "This is **bold** text";
      expect(roundTrip(source)).toBe(source);
    });

    it("extracts code span", () => {
      const source = "Use `code` here";
      expect(roundTrip(source)).toBe(source);
    });

    it("extracts link", () => {
      const source = "Click [here](http://example.com)";
      expect(roundTrip(source)).toBe(source);
    });
  });

  describe("other block types", () => {
    it("extracts thematic break", () => {
      expect(roundTrip("---")).toBe("---");
    });

    it("extracts fenced code block", () => {
      const source = "```js\nconsole.log('hi')\n```";
      expect(roundTrip(source)).toBe(source);
    });

    it("extracts blockquote with > prefix preserved", () => {
      expect(roundTrip("> quoted text")).toBe("> quoted text");
    });

    it("extracts blockquote with inline formatting", () => {
      expect(roundTrip("> **bold** text")).toBe("> **bold** text");
    });
  });

  describe("complete documents", () => {
    it("round-trips the task example", () => {
      const source = "# Heading 1\n\nParagraph text.\n\n- list1\n- list2";
      expect(roundTrip(source)).toBe(source);
    });

    it("round-trips a complex document with blockquote", () => {
      const source =
        "# Title\n\nSome *emphasized* and **strong** text.\n\n- item 1\n- item 2\n\n---\n\n> a quote";
      expect(roundTrip(source)).toBe(source);
    });
  });

  describe("non-placeholder <br>", () => {
    it("counts a <br> as newline when it is not a placeholder (not the sole child)", () => {
      const container = document.createElement("div");
      // A <p> with text + <br> + text: the <br> is NOT a placeholder because
      // the parent has multiple children.
      container.innerHTML = '<p data-block="paragraph">Hello<br>World</p>';
      expect(extractText(container)).toBe("Hello\nWorld");
    });

    it("ignores a placeholder <br> (sole child of a block element)", () => {
      const container = document.createElement("div");
      container.innerHTML = '<p data-block="paragraph"><br></p>';
      // The <br> is the sole child of <p>, so it is a placeholder
      expect(extractText(container)).toBe("");
    });
  });

  describe("block separator model", () => {
    it("inserts a separator \\n between adjacent block siblings", () => {
      const container = document.createElement("div");
      container.innerHTML =
        '<p data-block="paragraph">Hello</p><p data-block="paragraph">World</p>';
      // "Hello\n" (p end) + "\n" (separator) + "World\n" (p end)
      // strip trailing \n → "Hello\n\nWorld"
      expect(extractText(container)).toBe("Hello\n\nWorld");
    });

    it("does not insert separator between li siblings (ul has withSeparator=false)", () => {
      const container = document.createElement("div");
      container.innerHTML =
        '<ul><li data-block="list_item">- a</li><li data-block="list_item">- b</li></ul>';
      // "- a\n" + "- b\n" strip → "- a\n- b"
      expect(extractText(container)).toBe("- a\n- b");
    });

    it("inserts separator between paragraphs inside blockquote", () => {
      const container = document.createElement("div");
      container.innerHTML =
        '<blockquote data-block="block_quote">&gt; <p data-block="paragraph">A</p><p data-block="paragraph">B</p></blockquote>';
      // "> " (text) + "A\n" + "\n" (sep) + "B\n" strip → "> A\n\nB"
      expect(extractText(container)).toBe("> A\n\nB");
    });
  });

  describe("browser-generated div (no data-block)", () => {
    it("treats a plain <div> as a block element with trailing newline", () => {
      const container = document.createElement("div");
      container.innerHTML = "<p>Hello</p><div>New line</div>";
      // "Hello" + "\n" (p leaf end) + "New line" + "\n" (div leaf end)
      // trailing \n removed
      expect(extractText(container)).toBe("Hello\nNew line");
    });

    it("handles browser-generated div with only a <br> inside", () => {
      const container = document.createElement("div");
      container.innerHTML = "<p>Hello</p><div><br></div>";
      // No separator before div (plain div not block-level for separator purposes).
      // "Hello\n" (p end) + (br=placeholder, nothing) + "\n" (div end)
      // strip one trailing \n → "Hello\n"
      expect(extractText(container)).toBe("Hello\n");
    });
  });

  describe("isPlaceholderBr edge cases", () => {
    it("returns false for <br> inside a non-block parent (sole child)", () => {
      const container = document.createElement("div");
      // A <br> inside <span> (not a block element) — isPlaceholderBr returns
      // false since span is not a block-level tag. The <br> counts as \n.
      // Add text after the span so the trailing \n from <br> is not stripped.
      container.innerHTML =
        '<p data-block="paragraph"><span><br></span>after</p>';
      // The <br> in <span> is sole child but span is not block-level => not placeholder
      // So it counts as \n. Result: "\n" + "after" + "\n" (leaf end, stripped)
      expect(extractText(container)).toBe("\nafter");
    });

    it("treats trailing cursor-target <p><br></p> as empty block", () => {
      const container = document.createElement("div");
      container.innerHTML =
        '<p data-block="paragraph">Hello</p><p><br></p>';
      // "Hello\n" (p end) + "\n" (sep) + (br=placeholder, no content) + "\n" (p end)
      // join → "Hello\n\n\n", strip one trailing \n → "Hello\n\n"
      expect(extractText(container)).toBe("Hello\n\n");
    });

    it("returns false for <br> when parent has multiple children", () => {
      const container = document.createElement("div");
      container.innerHTML = '<p data-block="paragraph">text<br></p>';
      // <br> in <p> has 2 children (text + br), so not a placeholder → \n from br
      // "text" + "\n" (from br) + "\n" (p end) → "text\n\n" → strip one → "text\n"
      expect(extractText(container)).toBe("text\n");
    });

    it("treats <br> as placeholder when it is sole child of a <div>", () => {
      const container = document.createElement("div");
      // <div> with a sole <br> child => placeholder => ignored for content
      container.innerHTML =
        '<p data-block="paragraph">Hello</p><div><br></div>';
      // No separator before div (plain div not block-level for separators).
      // "Hello\n" (p end) + (br=placeholder) + "\n" (div end) → strip one → "Hello\n"
      expect(extractText(container)).toBe("Hello\n");
    });
  });
});
