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
});
