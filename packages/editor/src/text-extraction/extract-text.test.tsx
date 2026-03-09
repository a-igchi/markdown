import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { parse } from "parser-cst";
import { cstToReact } from "../rendering/cst-to-react.js";
import { extractText } from "./extract-text.js";

function roundTrip(source: string): string {
  const doc = parse(source);
  const elements = cstToReact(doc);
  const { container } = render(<div>{elements}</div>);
  return extractText(container.firstElementChild as HTMLElement);
}

describe("extractText (CST round-trip)", () => {
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

    it("extracts loose list", () => {
      const source = "- item1\n\n- item2";
      expect(roundTrip(source)).toBe(source);
    });

    it("extracts nested list", () => {
      const source = "- parent\n  - child";
      expect(roundTrip(source)).toBe(source);
    });

    it("extracts nested + loose list", () => {
      const source = "- parent\n\n  - child";
      expect(roundTrip(source)).toBe(source);
    });
  });

  describe("other block types", () => {
    it("extracts thematic break", () => {
      expect(roundTrip("---")).toBe("---");
    });
  });

  describe("complete documents", () => {
    it("round-trips the task example", () => {
      const source = "# Heading 1\n\nParagraph text.\n\n- list1\n- list2";
      expect(roundTrip(source)).toBe(source);
    });

    it("round-trips a complex document", () => {
      const source =
        "# Title\n\nSome text.\n\n- item 1\n- item 2\n\n---\n\n1. one\n2. two";
      expect(roundTrip(source)).toBe(source);
    });
  });

  describe("edge cases", () => {
    it("handles empty document", () => {
      expect(roundTrip("")).toBe("");
    });

    it("handles multiline paragraph", () => {
      const source = "Line one\nLine two";
      expect(roundTrip(source)).toBe(source);
    });
  });

  describe("additional edge cases", () => {
    it("handles very long single paragraph", () => {
      const long = "A".repeat(10000);
      expect(roundTrip(long)).toBe(long);
    });
  });

  describe("placeholder br handling", () => {
    it("ignores a placeholder <br> (sole child of a block element)", () => {
      const container = document.createElement("div");
      container.innerHTML = '<p data-block="paragraph"><br></p>';
      expect(extractText(container)).toBe("");
    });
  });

  describe("non-placeholder <br>", () => {
    it("emits \\n for a non-placeholder <br> inside a paragraph with other content", () => {
      const container = document.createElement("div");
      // <br> is NOT sole child of <p>, so it's not a placeholder
      container.innerHTML = '<p data-block="paragraph">text<br>more</p>';
      expect(extractText(container)).toBe("text\nmore");
    });
  });

  describe("blank_line with content", () => {
    it("emits \\n + content + \\n for a blank_line div with text", () => {
      const container = document.createElement("div");
      // blank_line that has user-typed content
      container.innerHTML =
        '<p data-block="paragraph">above</p>' +
        '<div data-block="blank_line">typed</div>' +
        '<p data-block="paragraph">below</p>';
      const text = extractText(container);
      // "above\n" + "\n" + "typed" + "\n" + "below\n" → trim trailing \n → "above\n\ntypedbelow"
      // Actually: above\n + \n(blank_line separator) + typed + \n(leaf_block_end blank_line) + below\n → trim → "above\n\ntyped\nbelow"
      expect(text).toBe("above\n\ntyped\nbelow");
    });
  });

  describe("browser-generated raw div (no data-block)", () => {
    it("emits content + \\n for a raw <div> element", () => {
      const container = document.createElement("div");
      // Raw div without data-block (browser-generated)
      container.innerHTML = "<div>browser div</div>";
      expect(extractText(container)).toBe("browser div");
    });
  });
});
