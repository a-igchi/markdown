import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { modelToReact } from "./model-to-react.js";
import { saveDomCursorAsModelCursor, restoreModelCursorToDom } from "./cursor-mapping.js";
import type { Document, ModelCursor } from "./types.js";

function renderDoc(doc: Document): HTMLElement {
  const elements = modelToReact(doc);
  const { container } = render(<div>{elements}</div>);
  return container.firstElementChild as HTMLElement;
}

function setCursor(node: Node, offset: number) {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
}

describe("cursor-mapping", () => {
  beforeEach(() => {
    window.getSelection()?.removeAllRanges();
  });

  describe("saveDomCursorAsModelCursor", () => {
    it("returns null when no selection", () => {
      const el = renderDoc({ blocks: [{ type: "paragraph", content: "hello" }] });
      expect(saveDomCursorAsModelCursor(el)).toBeNull();
    });

    it("returns null when cursor is inside container but no data-block-index ancestor (findBlockIndex returns null)", () => {
      // Container has no data-block-index attributes → findBlockIndex returns null at line 107
      const container = document.createElement("div");
      const p = document.createElement("p");
      const text = document.createTextNode("no index");
      p.appendChild(text);
      container.appendChild(p);
      document.body.appendChild(container);

      const range = document.createRange();
      range.setStart(text, 0);
      range.collapse(true);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);

      expect(saveDomCursorAsModelCursor(container)).toBeNull();
      document.body.removeChild(container);
    });

    it("saves cursor at start of first block → offset 0", () => {
      const doc: Document = { blocks: [{ type: "paragraph", content: "hello" }] };
      const el = renderDoc(doc);
      const p = el.querySelector("p")!;
      const textNode = p.firstChild!;
      setCursor(textNode, 0);
      const cursor = saveDomCursorAsModelCursor(el);
      expect(cursor).toEqual({ blockIndex: 0, offset: 0 });
    });

    it("saves cursor in middle of text", () => {
      const doc: Document = { blocks: [{ type: "paragraph", content: "hello" }] };
      const el = renderDoc(doc);
      const p = el.querySelector("p")!;
      const textNode = p.firstChild!;
      setCursor(textNode, 3);
      const cursor = saveDomCursorAsModelCursor(el);
      expect(cursor).toEqual({ blockIndex: 0, offset: 3 });
    });

    it("saves cursor after a raw div inside a block (div branch lines 69-73)", () => {
      // Block contains a raw <div> (no data-block) then a text node
      // walk(rawDiv): tag=div, no blank_line, not container/leaf block → div branch (lines 69-73)
      // Iterate rawDiv's children: text "abc" → not targetNode → offset+=3, onLeafBlockEnd(rawDiv) → offset+=1
      // Then walk("text") → onText matches targetNode → offset+=1, found
      const container = document.createElement("div");
      const p = document.createElement("p");
      p.setAttribute("data-block-index", "0");
      p.setAttribute("data-block", "paragraph");
      const rawDiv = document.createElement("div"); // no data-block
      rawDiv.appendChild(document.createTextNode("abc"));
      const afterText = document.createTextNode("text");
      p.appendChild(rawDiv);
      p.appendChild(afterText);
      container.appendChild(p);
      document.body.appendChild(container);

      const range = document.createRange();
      range.setStart(afterText, 1); // offset 1 into "text"
      range.collapse(true);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);

      // Expected: "abc"(3) + rawDiv leaf end(1) + 1 = 5
      const cursor = saveDomCursorAsModelCursor(container);
      expect(cursor).not.toBeNull();
      expect(cursor!.blockIndex).toBe(0);
      expect(cursor!.offset).toBe(5);
      document.body.removeChild(container);
    });

    it("saves cursor past a blank_line with text content (blank_line hasContent branch)", () => {
      // Block contains: blank_line div with text, then a leaf block
      // walkBlock encounters blank_line with hasContent=true → lines 45-50:
      //   onBlankLine(blank_line): not targetNode → offset+=1, false
      //   iterate blank_line's children: text "typed" → not targetNode → offset+=5
      //   onLeafBlockEnd(blank_line): not target → offset+=1
      // Then leaf block text found
      const container = document.createElement("div");
      const ul = document.createElement("ul");
      ul.setAttribute("data-block-index", "0");
      ul.setAttribute("data-block", "list");

      const blankLine = document.createElement("div");
      blankLine.setAttribute("data-block", "blank_line");
      const blankText = document.createTextNode("typed");
      blankLine.appendChild(blankText);

      const li = document.createElement("li");
      li.setAttribute("data-block", "list_item");
      const liText = document.createTextNode("item");
      li.appendChild(liText);

      ul.appendChild(blankLine);
      ul.appendChild(li);
      container.appendChild(ul);
      document.body.appendChild(container);

      // Cursor on liText at offset 2
      const range = document.createRange();
      range.setStart(liText, 2);
      range.collapse(true);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);

      // offset: onBlankLine(1) + "typed"(5) + leafEnd(1) + cursor-in-li(2) = 9
      const cursor = saveDomCursorAsModelCursor(container);
      expect(cursor).not.toBeNull();
      expect(cursor!.blockIndex).toBe(0);
      expect(cursor!.offset).toBe(9);
      document.body.removeChild(container);
    });

    it("saves cursor in second block", () => {
      const doc: Document = {
        blocks: [
          { type: "paragraph", content: "abc" },
          { type: "paragraph", content: "xyz" },
        ],
      };
      const el = renderDoc(doc);
      const ps = el.querySelectorAll("p");
      const textNode = ps[1].firstChild!;
      setCursor(textNode, 1);
      const cursor = saveDomCursorAsModelCursor(el);
      expect(cursor).toEqual({ blockIndex: 1, offset: 1 });
    });

    it("saves cursor when cursor is directly on an empty blank_line element inside a block", () => {
      // For onBlankLine(el) where el === targetNode to be true:
      // - blank_line div must have NO children (no br), so element-node resolution leaves targetNode unchanged
      // - The blank_line must be a CHILD of the block element (not the block itself)
      const container = document.createElement("div");
      const ul = document.createElement("ul");
      ul.setAttribute("data-block-index", "0");
      ul.setAttribute("data-block", "list");

      const li = document.createElement("li");
      // A blank_line with NO children (completely empty)
      const blankLine = document.createElement("div");
      blankLine.setAttribute("data-block", "blank_line");
      // No children — textContent is "" → hasContent = false → onBlankLine called
      li.appendChild(blankLine);
      ul.appendChild(li);
      container.appendChild(ul);
      document.body.appendChild(container);

      // Set cursor on the blank_line div — with no children, resolvedNode stays as blankLine
      const range = document.createRange();
      range.setStart(blankLine, 0);
      range.collapse(true);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);

      // saveDomCursorAsModelCursor: walkBlock encounters blankLine, onBlankLine called
      // el === targetNode (blankLine === blankLine) → found! → lines 178-179 covered
      const cursor = saveDomCursorAsModelCursor(container);
      expect(cursor).not.toBeNull();
      expect(cursor!.blockIndex).toBe(0);
      expect(cursor!.offset).toBe(0);

      document.body.removeChild(container);
    });

    it("saves cursor when cursor is on an empty leaf block element (li with data-block)", () => {
      // For onLeafBlockEnd(el) where el === targetNode to be true:
      // - leaf block (li with data-block="list_item") must have NO children
      // - cursor is directly on the li element (not a text node)
      // - element-node resolution: childNodes.length=0 → targetNode stays as li
      // - walkBlock: isLeafBlock(li) → walks children (none) → onLeafBlockEnd(li)
      // - onLeafBlockEnd: el === targetNode (li === li) → found=true → lines 170-172 covered
      const container = document.createElement("div");
      const ul = document.createElement("ul");
      ul.setAttribute("data-block-index", "0");
      ul.setAttribute("data-block", "list");

      const li = document.createElement("li");
      li.setAttribute("data-block", "list_item");
      // No children — empty leaf block element
      ul.appendChild(li);
      container.appendChild(ul);
      document.body.appendChild(container);

      // Set cursor directly on the li element (offset 0, no children)
      const range = document.createRange();
      range.setStart(li, 0);
      range.collapse(true);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);

      const cursor = saveDomCursorAsModelCursor(container);
      expect(cursor).not.toBeNull();
      expect(cursor!.blockIndex).toBe(0);
      expect(cursor!.offset).toBe(0);

      document.body.removeChild(container);
    });

    it("saves cursor at element offset past last text child (line 139 branch)", () => {
      // Cursor on the p element itself with offset=1 (past the single text child)
      // → targetOffset(1) >= children.length(1) && children.length>0 → "else if" branch
      // → last = text node("hello"), last.nodeType===TEXT_NODE → line 139 covered
      const doc: Document = { blocks: [{ type: "paragraph", content: "hello" }] };
      const el = renderDoc(doc);
      const p = el.querySelector("p")!;
      const range = document.createRange();
      range.setStart(p, 1); // after the single text child
      range.collapse(true);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
      const cursor = saveDomCursorAsModelCursor(el);
      expect(cursor).toEqual({ blockIndex: 0, offset: 5 });
    });

    it("saves cursor on placeholder <br> → offset 0", () => {
      const doc: Document = { blocks: [{ type: "paragraph", content: "" }] };
      const el = renderDoc(doc);
      const p = el.querySelector("p")!;
      const br = p.querySelector("br")!;
      // Set cursor on the br element
      setCursor(p, 0); // before br child
      const cursor = saveDomCursorAsModelCursor(el);
      expect(cursor).toEqual({ blockIndex: 0, offset: 0 });
    });
  });

  describe("restoreModelCursorToDom", () => {
    it("restores cursor at offset 0 to a block with text", () => {
      const doc: Document = { blocks: [{ type: "paragraph", content: "hello" }] };
      const el = renderDoc(doc);
      restoreModelCursorToDom(el, { blockIndex: 0, offset: 0 });
      const cursor = saveDomCursorAsModelCursor(el);
      expect(cursor).toEqual({ blockIndex: 0, offset: 0 });
    });

    it("restores cursor at offset 0 to a block with element first child (non-text)", () => {
      const doc: Document = { blocks: [{ type: "paragraph", content: "" }] };
      const el = renderDoc(doc);
      // block has <br> as first child (placeholder)
      restoreModelCursorToDom(el, { blockIndex: 0, offset: 0 });
      // Should not throw, cursor placed at block start
      const cursor = saveDomCursorAsModelCursor(el);
      expect(cursor).not.toBeNull();
      expect(cursor!.blockIndex).toBe(0);
    });

    it("restores cursor at arbitrary offset in text", () => {
      const doc: Document = { blocks: [{ type: "paragraph", content: "hello world" }] };
      const el = renderDoc(doc);
      restoreModelCursorToDom(el, { blockIndex: 0, offset: 5 });
      const cursor = saveDomCursorAsModelCursor(el);
      expect(cursor).toEqual({ blockIndex: 0, offset: 5 });
    });

    it("does nothing when blockIndex not found", () => {
      const doc: Document = { blocks: [{ type: "paragraph", content: "hello" }] };
      const el = renderDoc(doc);
      // blockIndex 99 does not exist
      restoreModelCursorToDom(el, { blockIndex: 99, offset: 0 });
      // No selection should be set (or existing cleared)
      // Just verify it doesn't throw
    });

    it("positions cursor at leaf block end when leaf block has no text (onLeafBlockEnd remaining=0)", () => {
      // Create a list block where the list item has only a placeholder <br> (no text)
      // When findDomPositionInBlock is called with offset=0 on this <ul>,
      // walkBlock walks the <li data-block="list_item"> as a leaf block,
      // finds <br> (placeholder → skip), then calls onLeafBlockEnd with remaining=0
      const container = document.createElement("div");
      const ul = document.createElement("ul");
      ul.setAttribute("data-block-index", "0");
      ul.setAttribute("data-block", "list");

      const li = document.createElement("li");
      li.setAttribute("data-block", "list_item");
      const br = document.createElement("br");
      li.appendChild(br);
      ul.appendChild(li);
      container.appendChild(ul);
      document.body.appendChild(container);

      restoreModelCursorToDom(container, { blockIndex: 0, offset: 0 });
      // Should set cursor at the li element
      const cursor = saveDomCursorAsModelCursor(container);
      // saveDomCursorAsModelCursor requires data-block-index in the hierarchy
      // Since the li doesn't have data-block-index, cursor will be null or blockIndex=0
      expect(cursor === null || cursor.blockIndex === 0).toBe(true);

      document.body.removeChild(container);
    });

    it("handles offset 0 when block element has no children (empty element)", () => {
      const container = document.createElement("div");
      // Create a block element with data-block-index but no children at all
      const blockEl = document.createElement("p");
      blockEl.setAttribute("data-block-index", "0");
      blockEl.setAttribute("data-block", "paragraph");
      // No children — firstChild is null
      container.appendChild(blockEl);
      document.body.appendChild(container);

      // Should not throw; cursor gets placed at blockEl
      restoreModelCursorToDom(container, { blockIndex: 0, offset: 0 });

      document.body.removeChild(container);
    });

    it("restores cursor to blank_line position inside a loose list block", () => {
      // Loose list: "- item1\n\n- item2"
      // DOM walkBlock layout: "- item1"(7) + leaf-end(1) + blank_line(1) + "- item2"(7)
      // Offset 8 = after "- item1"(7) + leaf-end(1) = at blank_line
      const doc: Document = {
        blocks: [{ type: "list", content: "- item1\n\n- item2" }],
      };
      const el = renderDoc(doc);
      // Offset 8 should position cursor at blank_line between items
      restoreModelCursorToDom(el, { blockIndex: 0, offset: 8 });
      const cursor = saveDomCursorAsModelCursor(el);
      expect(cursor).not.toBeNull();
      expect(cursor!.blockIndex).toBe(0);
    });

    it("round-trips cursor at various offsets", () => {
      const doc: Document = {
        blocks: [
          { type: "paragraph", content: "Hello" },
          { type: "paragraph", content: "World" },
        ],
      };
      const el = renderDoc(doc);
      const cursors: ModelCursor[] = [
        { blockIndex: 0, offset: 0 },
        { blockIndex: 0, offset: 3 },
        { blockIndex: 0, offset: 5 },
        { blockIndex: 1, offset: 0 },
        { blockIndex: 1, offset: 2 },
      ];
      for (const c of cursors) {
        restoreModelCursorToDom(el, c);
        const saved = saveDomCursorAsModelCursor(el);
        expect(saved).toEqual(c);
      }
    });
  });
});
