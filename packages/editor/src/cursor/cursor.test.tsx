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

  describe("non-placeholder br (line 39)", () => {
    it("saves cursor past a non-placeholder <br> (skipped, no cursor offset added)", () => {
      // <p>before<br>after</p> — br is not placeholder (has siblings) → line 39 covered
      const el = document.createElement("div");
      const p = document.createElement("p");
      p.setAttribute("data-block", "paragraph");
      p.appendChild(document.createTextNode("before"));
      p.appendChild(document.createElement("br"));
      const afterText = document.createTextNode("after");
      p.appendChild(afterText);
      el.appendChild(p);
      document.body.appendChild(el);

      // cursor.ts skips non-placeholder br (no offset added): "before"(6) + 2 = 8
      setCursorAt(afterText, 2);
      const saved = saveCursorAsOffset(el);
      expect(saved).toBe(8);

      restoreCursorFromOffset(el, 8);
      expect(saveCursorAsOffset(el)).toBe(8);

      document.body.removeChild(el);
    });
  });

  describe("blank_line with content (walkDom branch)", () => {
    it("saves cursor AFTER a blank_line with content (covers onLeafBlockEnd at line 53)", () => {
      // blank_line has text → hasContent=true → onBlankLine(+1) + text(+5) + onLeafBlockEnd(+1) = 7
      // cursor is on "after" paragraph text → line 53 (onLeafBlockEnd of blank_line) covered
      const el = document.createElement("div");
      const helloP = document.createElement("p");
      helloP.setAttribute("data-block", "paragraph");
      helloP.appendChild(document.createTextNode("hello"));
      const blankDiv = document.createElement("div");
      blankDiv.setAttribute("data-block", "blank_line");
      blankDiv.appendChild(document.createTextNode("typed"));
      const afterP = document.createElement("p");
      afterP.setAttribute("data-block", "paragraph");
      const afterText = document.createTextNode("after");
      afterP.appendChild(afterText);
      el.appendChild(helloP);
      el.appendChild(blankDiv);
      el.appendChild(afterP);
      document.body.appendChild(el);

      // hello(5) + helloLeafEnd(1) + blankLineOnBlankLine(1) + typed(5) + blankLineLeafEnd(1) + 2 = 15
      setCursorAt(afterText, 2);
      expect(saveCursorAsOffset(el)).toBe(15);

      document.body.removeChild(el);
    });

    it("saves cursor inside a blank_line div that has text content", () => {
      const el = document.createElement("div");
      // Simulate a blank_line div with user-typed content
      el.innerHTML =
        '<p data-block="paragraph">hello</p>' +
        '<div data-block="blank_line">typed</div>';
      document.body.appendChild(el);

      const blankDiv = el.querySelector("[data-block='blank_line']")!;
      const textNode = blankDiv.firstChild!;
      setCursorAt(textNode, 2);
      // Offset: "hello" (5) + \n (trailing p leaf block end) + \n (blank_line separator) + 2 (cursor in text) = 9
      expect(saveCursorAsOffset(el)).toBe(9);

      document.body.removeChild(el);
    });
  });

  describe("raw div walk branch", () => {
    it("saves and restores cursor in a browser-generated raw div", () => {
      const el = document.createElement("div");
      el.innerHTML = "<div>content</div>";
      document.body.appendChild(el);

      const div = el.querySelector("div")!;
      const textNode = div.firstChild!;
      setCursorAt(textNode, 3);
      const saved = saveCursorAsOffset(el);
      expect(saved).toBe(3);

      restoreCursorFromOffset(el, 3);
      expect(saveCursorAsOffset(el)).toBe(3);

      document.body.removeChild(el);
    });
  });

  describe("raw div walk branch — onLeafBlockEnd (line 79)", () => {
    it("saves cursor in element after a raw div (covers onLeafBlockEnd in div branch)", () => {
      // Container: <div>content</div><p data-block="paragraph">after</p>
      // Cursor on "after" text — walkDom processes raw div fully, calls onLeafBlockEnd(div)
      const el = document.createElement("div");
      const rawDiv = document.createElement("div");
      rawDiv.appendChild(document.createTextNode("content"));
      const p = document.createElement("p");
      p.setAttribute("data-block", "paragraph");
      const afterText = document.createTextNode("after");
      p.appendChild(afterText);
      el.appendChild(rawDiv);
      el.appendChild(p);
      document.body.appendChild(el);

      // offset: "content"(7) + rawDiv leaf end(1) + 2 = 10
      setCursorAt(afterText, 2);
      const saved = saveCursorAsOffset(el);
      expect(saved).toBe(10);

      restoreCursorFromOffset(el, 10);
      expect(saveCursorAsOffset(el)).toBe(10);

      document.body.removeChild(el);
    });
  });

  describe("container block walk branch — return false (lines 63-64)", () => {
    it("saves cursor after a container block (ul) in a subsequent paragraph", () => {
      // Container: <ul><li data-block="list_item">item</li></ul><p data-block="paragraph">after</p>
      // Cursor on "after" — walkDom walks ul (container), doesn't find cursor → line 63: return false
      const el = document.createElement("div");
      const ul = document.createElement("ul");
      const li = document.createElement("li");
      li.setAttribute("data-block", "list_item");
      li.appendChild(document.createTextNode("item"));
      ul.appendChild(li);
      const p = document.createElement("p");
      p.setAttribute("data-block", "paragraph");
      const afterText = document.createTextNode("after");
      p.appendChild(afterText);
      el.appendChild(ul);
      el.appendChild(p);
      document.body.appendChild(el);

      // offset: "item"(4) + li leaf end(1) + 2 = 7
      setCursorAt(afterText, 2);
      const saved = saveCursorAsOffset(el);
      expect(saved).toBe(7);

      restoreCursorFromOffset(el, 7);
      expect(saveCursorAsOffset(el)).toBe(7);

      document.body.removeChild(el);
    });
  });

  describe("inline elements (em, strong, code) — walkDom inline recursion", () => {
    it("saves and restores cursor inside an inline element", () => {
      // Render markdown with emphasis so DOM has <em> element
      const el = renderIntoContainer("Hello *world* foo");
      // "Hello " = 6, "*world*" = 7, " foo" = 4 → total 17 chars (plus trailing tokens)
      // Offset 9 should be inside "*world*" (6 + 3 = 9 → "wor|ld")
      restoreCursorFromOffset(el, 9);
      const saved = saveCursorAsOffset(el);
      expect(saved).toBe(9);
    });

    it("saves cursor after inline element", () => {
      const el = renderIntoContainer("Hello **world** end");
      // "Hello " = 6, "**world**" = 9, " end" = 4 → total = 19
      restoreCursorFromOffset(el, 16);
      const saved = saveCursorAsOffset(el);
      expect(saved).toBe(16);
    });
  });

  describe("cursor outside container (line 101)", () => {
    it("saveCursorAsOffset returns null when cursor is outside the container", () => {
      // Cursor is in a DIFFERENT element than the container
      const container = document.createElement("div");
      const outside = document.createElement("div");
      const text = document.createTextNode("outside");
      outside.appendChild(text);
      document.body.appendChild(container);
      document.body.appendChild(outside);

      setCursorAt(text, 2); // cursor in "outside", not in container
      expect(saveCursorAsOffset(container)).toBeNull();

      document.body.removeChild(container);
      document.body.removeChild(outside);
    });
  });

  describe("null return path (lines 172, 182)", () => {
    it("saveCursorAsOffset returns null when resolvedNode is unreachable (empty container, cursor on element itself)", () => {
      // Empty container → no children → resolvedNode=el → walkDom finds nothing → found=false → returns null
      const el = document.createElement("div");
      document.body.appendChild(el);

      const range = document.createRange();
      range.setStart(el, 0); // cursor on el itself, no children → resolvedNode stays as el
      range.collapse(true);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);

      expect(saveCursorAsOffset(el)).toBeNull();
      document.body.removeChild(el);
    });

    it("restoreCursorFromOffset does nothing when findDomPosition returns null (empty container)", () => {
      // Empty container → walkDom fires no callbacks → result=null, lastPos=null → pos=null → early return
      const el = document.createElement("div");
      document.body.appendChild(el);

      // Should not throw; pos is null → line 182: if (!pos) return
      restoreCursorFromOffset(el, 5);

      document.body.removeChild(el);
    });
  });

  describe("non-element non-text node (Comment node)", () => {
    it("skips comment nodes without crashing", () => {
      const el = document.createElement("div");
      const p = document.createElement("p");
      p.setAttribute("data-block", "paragraph");
      const comment = document.createComment("this is a comment");
      const textNode = document.createTextNode("hello");
      p.appendChild(comment);
      p.appendChild(textNode);
      el.appendChild(p);
      document.body.appendChild(el);

      setCursorAt(textNode, 3);
      const saved = saveCursorAsOffset(el);
      expect(saved).toBe(3);

      document.body.removeChild(el);
    });
  });
});
