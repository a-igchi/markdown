import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { parse } from "markdown-parser";
import { astToReact } from "../../src/rendering/ast-to-react.js";
import {
  saveCursorAsOffset,
  restoreCursorFromOffset,
} from "../../src/cursor/cursor.js";

function renderIntoContainer(source: string): HTMLElement {
  const doc = parse(source);
  const elements = astToReact(doc, source);
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

describe("cursor save/restore", () => {
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
      // Cursor at start of the text node inside <p>
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

    it("returns correct offset at end of text", () => {
      const el = renderIntoContainer("Hello");
      const textNode = el.querySelector("p")!.firstChild!;
      setCursorAt(textNode, 5);
      expect(saveCursorAsOffset(el)).toBe(5);
    });

    it("returns correct offset for heading with prefix", () => {
      const el = renderIntoContainer("# Title");
      // h1 has two child nodes: "# " (text) and "Title" (text from inline)
      const h1 = el.querySelector("h1")!;
      // Find the text node containing "Title"
      const titleTextNode = h1.childNodes[1]; // "Title" text node
      setCursorAt(titleTextNode, 3); // cursor after "Tit"
      // Offset = "# " (2 chars) + "Tit" (3 chars) = 5
      expect(saveCursorAsOffset(el)).toBe(5);
    });

    it("returns correct offset across blocks with blank line", () => {
      const el = renderIntoContainer("# Hi\n\nWorld");
      // Structure: <h1># Hi</h1><div blank_line /><p>World</p>
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
      const offset = saveCursorAsOffset(el);
      expect(offset).toBe(0);
    });

    it("restores cursor in middle of text", () => {
      const el = renderIntoContainer("Hello");
      restoreCursorFromOffset(el, 3);
      const offset = saveCursorAsOffset(el);
      expect(offset).toBe(3);
    });

    it("restores cursor at end of text", () => {
      const el = renderIntoContainer("Hello");
      restoreCursorFromOffset(el, 5);
      const offset = saveCursorAsOffset(el);
      expect(offset).toBe(5);
    });

    it("restores cursor in second block", () => {
      const el = renderIntoContainer("# Hi\n\nWorld");
      restoreCursorFromOffset(el, 8); // 2 chars into "World"
      const offset = saveCursorAsOffset(el);
      expect(offset).toBe(8);
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
  });

  describe("blank_line with user-typed content", () => {
    it("saves cursor offset in a blank_line block that has user content", () => {
      const el = document.createElement("div");
      el.innerHTML =
        '<p data-block="paragraph">Hello</p><div data-block="blank_line">typed</div>';
      document.body.appendChild(el);

      // Place cursor inside the text node of the blank_line block
      const blankLine = el.querySelector('[data-block="blank_line"]')!;
      const textNode = blankLine.firstChild!;
      setCursorAt(textNode, 3); // "typ|ed"

      // Offset = "Hello" (5) + "\n" (leaf end) + "\n" (blank_line sep) + "typ" (3) = 10
      expect(saveCursorAsOffset(el)).toBe(10);

      document.body.removeChild(el);
    });

    it("restores cursor in a blank_line block that has user content", () => {
      const el = document.createElement("div");
      el.innerHTML =
        '<p data-block="paragraph">Hello</p><div data-block="blank_line">typed</div>';
      document.body.appendChild(el);

      // Restore to offset 10 => 3 chars into "typed"
      restoreCursorFromOffset(el, 10);
      const offset = saveCursorAsOffset(el);
      expect(offset).toBe(10);

      document.body.removeChild(el);
    });
  });

  describe("browser-generated div handling", () => {
    it("saves cursor offset in a browser-generated div (no data-block)", () => {
      const el = document.createElement("div");
      el.innerHTML = '<p data-block="paragraph">Hello</p><div>World</div>';
      document.body.appendChild(el);

      const divBlock = el.querySelector("div:not([data-block])")!;
      const textNode = divBlock.firstChild!;
      setCursorAt(textNode, 3); // "Wor|ld"

      // Offset = "Hello" (5) + "\n" (leaf end) + "Wor" (3) = 9
      expect(saveCursorAsOffset(el)).toBe(9);

      document.body.removeChild(el);
    });

    it("restores cursor in a browser-generated div", () => {
      const el = document.createElement("div");
      el.innerHTML = '<p data-block="paragraph">Hello</p><div>World</div>';
      document.body.appendChild(el);

      restoreCursorFromOffset(el, 9);
      const offset = saveCursorAsOffset(el);
      expect(offset).toBe(9);

      document.body.removeChild(el);
    });
  });

  describe("isPlaceholderBr edge cases in cursor", () => {
    it("handles br with no parent (returns false)", () => {
      // A <br> inside a <span> (inline, not a block) with sole child
      // isPlaceholderBr returns false since span is not block-level
      const el = document.createElement("div");
      el.innerHTML = '<p data-block="paragraph">Hi<span><br></span>End</p>';
      document.body.appendChild(el);

      const endText = el.querySelector("p")!.lastChild!;
      setCursorAt(endText, 3); // "End|"

      // "Hi" (2) + (br not placeholder, but cursor.ts skips br) + "End" (3) = 5
      const offset = saveCursorAsOffset(el);
      expect(offset).toBe(5);

      document.body.removeChild(el);
    });

    it("handles br when parent has multiple children", () => {
      const el = document.createElement("div");
      el.innerHTML = '<p data-block="paragraph">Line1<br>Line2</p>';
      document.body.appendChild(el);

      const textNode = el.querySelector("p")!.lastChild!;
      setCursorAt(textNode, 5); // "Line2|"

      // "Line1" (5) + (br not placeholder, skipped in cursor) + "Line2" (5) = 10
      expect(saveCursorAsOffset(el)).toBe(10);

      document.body.removeChild(el);
    });
  });

  describe("element node resolution (cursor on element)", () => {
    it("resolves cursor before a child when targetOffset < children.length", () => {
      const el = document.createElement("div");
      // Create a paragraph with two text nodes. Setting cursor on the <p>
      // at offset 1 means "before the second child".
      // resolvedNode = children[1] (second text node), resolvedOffset = 0
      el.innerHTML = '<p data-block="paragraph">AB</p>';
      document.body.appendChild(el);

      const p = el.querySelector("p")!;
      // Split the text node so <p> has 2 child text nodes
      const textNode = p.firstChild as Text;
      textNode.splitText(1); // now p has "A" and "B" as two text nodes

      // Set cursor on <p> element at offset 1 (before second child)
      // resolvedNode = children[1] = text "B", resolvedOffset = 0
      // walkDom: "A" (1), not matched. "B": node === resolvedNode =>
      // offset = 1 + 0 = 1
      setCursorAt(p, 1);
      expect(saveCursorAsOffset(el)).toBe(1);

      document.body.removeChild(el);
    });

    it("resolves cursor after all children (targetOffset === children.length)", () => {
      const el = document.createElement("div");
      el.innerHTML = '<p data-block="paragraph">Hello</p>';
      document.body.appendChild(el);

      // Set cursor on <p> element, offset 1 (after the one text child)
      const p = el.querySelector("p")!;
      setCursorAt(p, p.childNodes.length);

      // Should resolve to end of last child => "Hello".length = 5
      expect(saveCursorAsOffset(el)).toBe(5);

      document.body.removeChild(el);
    });

    it("resolves cursor after all children when last child is an element node", () => {
      const el = document.createElement("div");
      // When last child is an element (not text), resolvedOffset = last.childNodes.length
      el.innerHTML =
        '<p data-block="paragraph">Hello</p><p data-block="paragraph">World</p>';
      document.body.appendChild(el);

      // Set cursor on container at offset = childNodes.length (2, after all children)
      // resolvedNode = last child = second <p>, resolvedOffset = p2.childNodes.length = 1
      // walkDom: "Hello" (5) + leafEnd(p1) = 6, "World" (5) + leafEnd(p2)
      // In onLeafBlockEnd(p2): el === resolvedNode (second <p>) => found, offset = 11
      setCursorAt(el, el.childNodes.length);
      expect(saveCursorAsOffset(el)).toBe(11);

      document.body.removeChild(el);
    });
  });

  describe("onLeafBlockEnd when el === resolvedNode", () => {
    it("saves cursor offset when cursor is at an empty leaf block (el === resolvedNode)", () => {
      const el = document.createElement("div");
      el.innerHTML =
        '<p data-block="paragraph">Hello</p><p data-block="paragraph"></p>';
      document.body.appendChild(el);

      // Set cursor on the second (empty) <p> element, offset 0
      // Since <p> has no children, resolvedNode stays as secondP,
      // resolvedOffset stays as 0.
      // walkDom: "Hello" (5) + leafEnd(p1) offset = 6
      // p2: no children. onLeafBlockEnd(p2): el === resolvedNode => found, offset = 6
      const secondP = el.querySelectorAll("p")[1];
      setCursorAt(secondP, 0);
      expect(saveCursorAsOffset(el)).toBe(6);

      document.body.removeChild(el);
    });

    it("saves cursor when cursor on a leaf block after walking its children", () => {
      const el = document.createElement("div");
      el.innerHTML =
        '<p data-block="paragraph">A</p><div data-block="custom">B</div>';
      document.body.appendChild(el);

      // Set cursor on the div[data-block="custom"] at offset = childNodes.length
      // resolvedNode = last child = text node "B", resolvedOffset = 1
      // walkDom: "A" (1) + leafEnd(p) = 2. "B" (1): node === resolvedNode,
      // offset += 1 = 3, found.
      const customBlock = el.querySelector('[data-block="custom"]')!;
      setCursorAt(customBlock, customBlock.childNodes.length);
      expect(saveCursorAsOffset(el)).toBe(3);

      document.body.removeChild(el);
    });

    it("handles cursor positioned on a leaf block element node directly via container", () => {
      const el = document.createElement("div");
      el.innerHTML =
        '<h1 data-block="heading">Title</h1><p data-block="paragraph"></p><p data-block="paragraph">End</p>';
      document.body.appendChild(el);

      // Set cursor on the container at offset 1, which resolves to second child
      // (empty <p>), resolvedOffset = 0. Since <p> has no children,
      // resolvedNode = empty <p>, resolvedOffset = 0.
      // walkDom: "Title" (5) + leafEnd(h1) = 6, p (empty):
      // onLeafBlockEnd(p): el === resolvedNode => found = true, offset = 6
      setCursorAt(el, 1);
      expect(saveCursorAsOffset(el)).toBe(6);

      document.body.removeChild(el);
    });
  });

  describe("findDomPosition onLeafBlockEnd with remaining < 1", () => {
    it("positions cursor at end of a block when remaining is 0", () => {
      const el = document.createElement("div");
      el.innerHTML =
        '<p data-block="paragraph">Hello</p><p data-block="paragraph">World</p>';
      document.body.appendChild(el);

      // Restore to offset 5 => end of "Hello". That's inside text node.
      // Restore to offset 6 => the \n after "Hello" block.
      // remaining starts at 6, text "Hello" is 5, remaining becomes 1.
      // onLeafBlockEnd: remaining = 1, 1 < 1 is false, remaining becomes 0.
      // Next, text "World", remaining = 0, 0 <= 5, so result = {node: textNode, offset: 0}
      // Let's try offset that triggers remaining < 1 in onLeafBlockEnd
      // We need remaining to be 0 when onLeafBlockEnd fires.
      // That happens when cursor is at the very end of a block's text content
      // but we want the onLeafBlockEnd branch specifically.
      // Actually, onLeafBlockEnd fires after walking children.
      // If remaining is 0 after walking children, then remaining < 1 fires.

      // Let's create scenario: empty paragraph
      const el2 = document.createElement("div");
      el2.innerHTML =
        '<p data-block="paragraph">Hi</p><p data-block="paragraph"></p><p data-block="paragraph">End</p>';
      document.body.appendChild(el2);

      // Restore to offset 3 (after "Hi\n") = start of empty p
      // remaining = 3, text "Hi" len 2, remaining = 1
      // onLeafBlockEnd(p1): remaining = 1, not < 1, remaining = 0
      // onLeafBlockEnd(p2): remaining = 0, which IS < 1 => result = {node: p2, offset: 0}
      restoreCursorFromOffset(el2, 3);
      const offset = saveCursorAsOffset(el2);
      expect(offset).toBe(3);

      document.body.removeChild(el);
      document.body.removeChild(el2);
    });
  });

  describe("blank_line onLeafBlockEnd after walking children", () => {
    it("restores cursor to the leaf block end position of a blank_line with content", () => {
      const el = document.createElement("div");
      // "Hello" (5) + "\n" (p end) + "\n" (blank_line sep) + "ab" (2) + "\n" (blank_line leafEnd) + "End" (3) + "\n" (p end)
      el.innerHTML =
        '<p data-block="paragraph">Hello</p><div data-block="blank_line">ab</div><p data-block="paragraph">End</p>';
      document.body.appendChild(el);

      // Offset 9 = after "Hello\n" (6) + "\n" (blank_line sep) (7) + "ab" (9)
      // onLeafBlockEnd of blank_line fires at offset 9, remaining should be 0
      // => result = {node: blankLine, offset: blankLine.childNodes.length}
      restoreCursorFromOffset(el, 9);
      const offset = saveCursorAsOffset(el);
      expect(offset).toBe(9);

      document.body.removeChild(el);
    });

    it("walks through blank_line with content when cursor is in a later block", () => {
      const el = document.createElement("div");
      el.innerHTML =
        '<p data-block="paragraph">Hi</p><div data-block="blank_line">XY</div><p data-block="paragraph">End</p>';
      document.body.appendChild(el);

      // Set cursor in "End" text (last paragraph)
      const ps = el.querySelectorAll("p");
      const lastP = ps[ps.length - 1];
      const textNode = lastP.firstChild!;
      setCursorAt(textNode, 1); // "E|nd"

      // Walk: "Hi" (2) + leafEnd(p1) = 3
      // blank_line with content: onBlankLine (not matched) offset += 1 = 4
      // Walk children: "XY" (2) offset = 6, not matched
      // onLeafBlockEnd(blankLine) on line 52: not found, offset += 1 = 7
      // "End" text: "E" at textNode matches resolvedNode => offset = 7 + 1 = 8
      expect(saveCursorAsOffset(el)).toBe(8);

      document.body.removeChild(el);
    });
  });

  describe("browser-generated div onLeafBlockEnd", () => {
    it("restores cursor to the leaf block end of a browser-generated div", () => {
      const el = document.createElement("div");
      el.innerHTML =
        '<p data-block="paragraph">AB</p><div>CD</div><p data-block="paragraph">EF</p>';
      document.body.appendChild(el);

      restoreCursorFromOffset(el, 5);
      const offset = saveCursorAsOffset(el);
      expect(offset).toBe(5);

      document.body.removeChild(el);
    });

    it("walks through browser-generated div when cursor is in a later block", () => {
      const el = document.createElement("div");
      el.innerHTML =
        '<p data-block="paragraph">AB</p><div>CD</div><p data-block="paragraph">EF</p>';
      document.body.appendChild(el);

      // Set cursor in "EF" text (last paragraph)
      const ps = el.querySelectorAll("p");
      const lastP = ps[ps.length - 1];
      const textNode = lastP.firstChild!;
      setCursorAt(textNode, 1); // "E|F"

      // Walk: "AB" (2) + leafEnd(p1) = 3
      // div: "CD" (2), not matched, offset = 5
      // onLeafBlockEnd(div) on line 78: not found, offset += 1 = 6
      // "EF": "E" at textNode matches => offset = 6 + 1 = 7
      expect(saveCursorAsOffset(el)).toBe(7);

      document.body.removeChild(el);
    });
  });

  describe("container block walk-through", () => {
    it("cursor past a container block (ul) walks through correctly", () => {
      const el = document.createElement("div");
      el.innerHTML =
        '<ul><li data-block="list_item">item</li></ul><p data-block="paragraph">After</p>';
      document.body.appendChild(el);

      // Set cursor in "After" text
      const p = el.querySelector("p")!;
      const textNode = p.firstChild!;
      setCursorAt(textNode, 2);

      // "item" (4) + "\n" (li end) + "Af" (2) = 7
      expect(saveCursorAsOffset(el)).toBe(7);

      document.body.removeChild(el);
    });

    it("restores cursor past a container block (blockquote)", () => {
      const el = document.createElement("div");
      el.innerHTML =
        '<blockquote><p data-block="paragraph">quoted</p></blockquote><p data-block="paragraph">After</p>';
      document.body.appendChild(el);

      // "quoted" (6) + "\n" (p end) + "Af" (2) = 9
      restoreCursorFromOffset(el, 9);
      const offset = saveCursorAsOffset(el);
      expect(offset).toBe(9);

      document.body.removeChild(el);
    });
  });

  describe("saveCursorAsOffset returns null for cursor outside container", () => {
    it("returns null when cursor is in a different container", () => {
      const el = renderIntoContainer("Hello");
      const other = document.createElement("div");
      other.textContent = "Other";
      document.body.appendChild(other);

      setCursorAt(other.firstChild!, 2);
      expect(saveCursorAsOffset(el)).toBeNull();

      document.body.removeChild(other);
    });
  });
});
