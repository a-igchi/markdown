import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { parse } from "parser-cst";
import { cstToReact } from "../rendering/cst-to-react.js";
import {
  saveCursorAsOffset,
  restoreCursorFromOffset,
} from "./cursor.js";

function renderIntoContainer(source: string): HTMLElement {
  const doc = parse(source);
  const elements = cstToReact(doc);
  const { container } = render(<div>{elements}</div>);
  return container.firstElementChild as HTMLElement;
}

function setCursorAt(node: Node, offset: number) {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
}

describe("cursor save/restore (CST)", () => {
  beforeEach(() => {
    window.getSelection()?.removeAllRanges();
  });

  describe("saveCursorAsOffset", () => {
    it("returns null when there is no selection", () => {
      const el = renderIntoContainer("Hello");
      expect(saveCursorAsOffset(el)).toBeNull();
    });

    it("returns 0 when cursor is at start of document", () => {
      const el = renderIntoContainer("Hello");
      const textNode = el.querySelector("p")!.firstChild!;
      setCursorAt(textNode, 0);
      expect(saveCursorAsOffset(el)).toBe(0);
    });

    it("returns correct offset in middle of text", () => {
      const el = renderIntoContainer("Hello");
      const textNode = el.querySelector("p")!.firstChild!;
      setCursorAt(textNode, 3);
      expect(saveCursorAsOffset(el)).toBe(3);
    });

    it("returns correct offset for heading with prefix", () => {
      const el = renderIntoContainer("# Title");
      const h1 = el.querySelector("h1")!;
      const textNode = h1.firstChild!;
      setCursorAt(textNode, 5); // cursor after "# Tit"
      expect(saveCursorAsOffset(el)).toBe(5);
    });

    it("returns correct offset across blocks with blank line", () => {
      const el = renderIntoContainer("# Hi\n\nWorld");
      const p = el.querySelector("p")!;
      const textNode = p.firstChild!;
      setCursorAt(textNode, 2); // cursor after "Wo"
      // Offset = "# Hi" (4) + "\n" (trailing) + "\n" (blank_line) + "Wo" (2) = 8
      expect(saveCursorAsOffset(el)).toBe(8);
    });
  });

  describe("restoreCursorFromOffset", () => {
    it("restores cursor at start of document", () => {
      const el = renderIntoContainer("Hello");
      restoreCursorFromOffset(el, 0);
      expect(saveCursorAsOffset(el)).toBe(0);
    });

    it("restores cursor in middle of text", () => {
      const el = renderIntoContainer("Hello");
      restoreCursorFromOffset(el, 3);
      expect(saveCursorAsOffset(el)).toBe(3);
    });

    it("restores cursor in second block", () => {
      const el = renderIntoContainer("# Hi\n\nWorld");
      restoreCursorFromOffset(el, 8);
      expect(saveCursorAsOffset(el)).toBe(8);
    });

    it("round-trips cursor at various positions", () => {
      const source = "# Title\n\nParagraph\n\n- item1\n- item2";
      const el = renderIntoContainer(source);

      for (const pos of [0, 2, 7, 8, 9, 17, 18, 19, 25, 33]) {
        if (pos > source.length) continue;
        restoreCursorFromOffset(el, pos);
        const restored = saveCursorAsOffset(el);
        expect(restored).toBe(pos);
      }
    });

    it("restores cursor at document end", () => {
      const source = "Hello";
      const el = renderIntoContainer(source);
      restoreCursorFromOffset(el, source.length);
      expect(saveCursorAsOffset(el)).toBe(source.length);
    });

    it("handles empty document", () => {
      const el = renderIntoContainer("");
      restoreCursorFromOffset(el, 0);
      // Cursor should be at 0 or null for empty doc
      const offset = saveCursorAsOffset(el);
      expect(offset === 0 || offset === null).toBe(true);
    });
  });
});
