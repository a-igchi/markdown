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

    it("extracts blockquote (recursive rendering strips > markers)", () => {
      // blockquote children are rendered recursively; the "> " prefix is not
      // preserved in the DOM, so extractText cannot reconstruct it.
      expect(roundTrip("> quoted text")).toBe("quoted text");
    });

    it("extracts blockquote with inline formatting", () => {
      // inline elements inside blockquote are correctly rendered and extracted
      expect(roundTrip("> **bold** text")).toBe("**bold** text");
    });
  });

  describe("complete documents", () => {
    it("round-trips the task example", () => {
      const source = "# Heading 1\n\nParagraph text.\n\n- list1\n- list2";
      expect(roundTrip(source)).toBe(source);
    });

    it("round-trips a complex document (blockquote > prefix not preserved)", () => {
      const source =
        "# Title\n\nSome *emphasized* and **strong** text.\n\n- item 1\n- item 2\n\n---\n\n> a quote";
      // The "> " blockquote marker is stripped by recursive rendering
      const expected =
        "# Title\n\nSome *emphasized* and **strong** text.\n\n- item 1\n- item 2\n\n---\n\na quote";
      expect(roundTrip(source)).toBe(expected);
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

  describe("blank_line with user-typed content", () => {
    it("extracts content from a blank_line block with user text", () => {
      const container = document.createElement("div");
      container.innerHTML =
        '<p data-block="paragraph">Hello</p><div data-block="blank_line">typed text</div>';
      // "Hello" + "\n" (leaf block end) + "\n" (blank_line separator) + "typed text" + "\n" (leaf block end)
      // Final trailing \n is removed by extractText
      expect(extractText(container)).toBe("Hello\n\ntyped text");
    });

    it("handles blank_line with nested child nodes", () => {
      const container = document.createElement("div");
      container.innerHTML =
        '<div data-block="blank_line"><span>some</span> text</div>';
      // "\n" (blank_line separator) + "some text" + "\n" (leaf block end)
      // trailing \n is removed
      expect(extractText(container)).toBe("\nsome text");
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
      // "Hello" + "\n" (p) + (br is placeholder, ignored) + "\n" (div)
      // trailing \n removed
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

    it("returns false for <br> when parent has multiple children", () => {
      const container = document.createElement("div");
      container.innerHTML = '<p data-block="paragraph">text<br></p>';
      // <br> in <p> but <p> has 2 children (text + br), so not a placeholder
      expect(extractText(container)).toBe("text\n");
    });

    it("treats <br> as placeholder when it is sole child of a <div>", () => {
      const container = document.createElement("div");
      // <div> with a sole <br> child => placeholder => ignored
      container.innerHTML =
        '<p data-block="paragraph">Hello</p><div><br></div>';
      // "Hello" + "\n" (p end) + (br placeholder, ignored) + "\n" (div end)
      // trailing \n stripped
      expect(extractText(container)).toBe("Hello\n");
    });
  });
});
