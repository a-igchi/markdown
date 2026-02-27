import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { Editor } from "../src/index.js";
import { restoreCursorFromOffset } from "../src/cursor/cursor.js";
import { getListContinuation } from "../src/editing/list-continuation.js";
import {
  paragraphBlock,
  bulletListBlock,
  orderedListBlock,
  headingBlock,
} from "./arbitraries.js";

// --- Types ---

type Model = { text: string; cursor: number };
type Real = {
  editable: HTMLElement;
  rerender: ReturnType<typeof render>["rerender"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: ReturnType<typeof vi.fn<any[], any>>;
};

// --- Simple document arbitrary (no inline syntax for cleaner model) ---

const simpleDoc = fc
  .array(fc.oneof(paragraphBlock, bulletListBlock, orderedListBlock, headingBlock), {
    minLength: 1,
    maxLength: 3,
  })
  .map((blocks) => blocks.join("\n\n"));

// --- Helpers ---

/**
 * Sync the real DOM to the model state: re-render with model.text and restore cursor.
 */
function syncReal(model: Model, real: Real): void {
  real.onChange.mockClear();
  real.rerender(<Editor value={model.text} onChange={real.onChange as (v: string) => void} />);
  restoreCursorFromOffset(real.editable, Math.min(model.cursor, model.text.length));
}

/**
 * Insert `char` at the current DOM cursor position and fire input.
 * If the selection is on an element node, resolves to an adjacent text node.
 */
function simulateTypeChar(char: string, editable: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);
  let node: Node = range.startContainer;
  let offset: number = range.startOffset;

  // Resolve element-node cursor to a text node
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const children = el.childNodes;
    if (offset < children.length && children[offset].nodeType === Node.TEXT_NODE) {
      node = children[offset];
      offset = 0;
    } else if (offset > 0 && children[offset - 1]?.nodeType === Node.TEXT_NODE) {
      node = children[offset - 1];
      offset = (node.textContent ?? "").length;
    } else {
      return; // can't find text node
    }
  }

  if (node.nodeType !== Node.TEXT_NODE) return;

  const text = node.textContent!;
  node.textContent = text.slice(0, offset) + char + text.slice(offset);

  const newRange = document.createRange();
  newRange.setStart(node, offset + 1);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);

  fireEvent.input(editable);
}

// --- Commands ---

class TypeCharCommand implements fc.Command<Model, Real> {
  constructor(private readonly char: string) {}

  check(m: Readonly<Model>): boolean {
    // Don't type adjacent to newlines (cursor would be on element/blank_line nodes)
    return (
      m.text.length < 500 &&
      (m.cursor === 0 || m.text[m.cursor - 1] !== "\n") &&
      (m.cursor >= m.text.length || m.text[m.cursor] !== "\n")
    );
  }

  run(m: Model, r: Real): void {
    syncReal(m, r);
    simulateTypeChar(this.char, r.editable);

    expect(r.onChange).toHaveBeenCalledTimes(1);
    const newText = r.onChange.mock.calls[0][0] as string;

    const expected = m.text.slice(0, m.cursor) + this.char + m.text.slice(m.cursor);
    expect(newText).toBe(expected);

    m.text = newText;
    m.cursor = m.cursor + 1;
  }

  toString(): string {
    return `TypeChar(${JSON.stringify(this.char)})`;
  }
}

class EnterCommand implements fc.Command<Model, Real> {
  check(m: Readonly<Model>): boolean {
    // Don't press Enter after a space: would leave trailing spaces on the split
    // line. Two or more trailing spaces in markdown = hard line break, which can
    // change how the parser structures the surrounding content.
    if (m.cursor > 0 && m.text[m.cursor - 1] === " ") return false;

    // Don't press Enter at the very start of a list item line.
    // That would insert "\n- " before an existing "- item", creating "- - item"
    // which the parser treats as TWO list items, making the model prediction wrong.
    const lineStart =
      m.cursor > 0 ? m.text.lastIndexOf("\n", m.cursor - 1) + 1 : 0;
    if (m.cursor === lineStart) {
      const restOfLine = m.text.slice(lineStart);
      if (/^( {0,3})([-+*] +|\d{1,9}[.)] +)/.test(restOfLine)) return false;
    }
    return true;
  }

  run(m: Model, r: Real): void {
    syncReal(m, r);
    fireEvent.keyDown(r.editable, { key: "Enter" });

    expect(r.onChange).toHaveBeenCalledTimes(1);
    const newText = r.onChange.mock.calls[0][0] as string;

    const clampedCursor = Math.min(m.cursor, m.text.length);
    const { insertion, cursorOffset } = getListContinuation(m.text, clampedCursor);
    const expected =
      m.text.slice(0, clampedCursor) + insertion + m.text.slice(clampedCursor);
    expect(newText).toBe(expected);

    m.text = newText;
    m.cursor = cursorOffset;
  }

  toString(): string {
    return `Enter`;
  }
}

class BackspaceCommand implements fc.Command<Model, Real> {
  check(m: Readonly<Model>): boolean {
    // Only backspace within a text run — not at block boundaries (\n before cursor)
    // This guarantees the cursor is on a text node and the Editor won't intercept.
    if (!(m.cursor > 0 && m.text[m.cursor - 1] !== "\n")) return false;

    // Don't backspace at the very end of a line (text[cursor] === '\n').
    // Deleting the last char of a line can expose trailing spaces (e.g. "foo  \n"),
    // which markdown interprets as hard line breaks, changing document structure.
    if (m.cursor < m.text.length && m.text[m.cursor] === "\n") return false;

    return true;
  }

  run(m: Model, r: Real): void {
    syncReal(m, r);

    fireEvent.keyDown(r.editable, { key: "Backspace" });
    // text[cursor-1] !== "\n" → not at block start, not in blank_line
    // → Editor returns early, browser handles it → onChange NOT called via keyDown
    expect(r.onChange).not.toHaveBeenCalled();

    // Simulate the browser's backspace on the DOM text node
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      const offset = range.startOffset;
      if (node.nodeType === Node.TEXT_NODE && offset > 0) {
        const text = node.textContent!;
        node.textContent = text.slice(0, offset - 1) + text.slice(offset);
        const newRange = document.createRange();
        newRange.setStart(node, offset - 1);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
    }

    fireEvent.input(r.editable);

    expect(r.onChange).toHaveBeenCalledTimes(1);
    const newText = r.onChange.mock.calls[0][0] as string;

    const clampedCursor = Math.min(m.cursor, m.text.length);
    const expected =
      m.text.slice(0, clampedCursor - 1) + m.text.slice(clampedCursor);
    expect(newText).toBe(expected);

    m.text = newText;
    m.cursor = clampedCursor - 1;
  }

  toString(): string {
    return `Backspace`;
  }
}

// --- Test ---

describe("model-based: Editor operations", () => {
  it("random command sequences maintain text consistency", () => {
    const typeCharArb = fc
      .stringMatching(/^[a-zA-Z0-9]$/)
      .map((char) => new TypeCharCommand(char));
    const enterArb = fc.constant(new EnterCommand());
    const backspaceArb = fc.constant(new BackspaceCommand());

    fc.assert(
      fc.property(
        simpleDoc.chain((doc) =>
          fc.tuple(fc.constant(doc), fc.integer({ min: 0, max: doc.length })),
        ),
        fc.commands([typeCharArb, enterArb, backspaceArb], { maxCommands: 15 }),
        ([initialDoc, initialCursor], cmds) => {
          const onChange = vi.fn();
          const { container, rerender } = render(
            <Editor value={initialDoc} onChange={onChange} />,
          );
          const editable = container.querySelector("[contenteditable]")! as HTMLElement;

          const model: Model = {
            text: initialDoc,
            cursor: Math.min(initialCursor, initialDoc.length),
          };
          const real: Real = { editable, rerender, onChange };

          // Set initial cursor in DOM
          restoreCursorFromOffset(editable, model.cursor);

          try {
            fc.modelRun(() => ({ model, real }), cmds);
          } finally {
            cleanup();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
