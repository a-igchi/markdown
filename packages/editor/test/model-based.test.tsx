import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { parse } from "parser-cst";
import { Editor } from "../src/index.js";
import { cstToModel } from "../src/model/cst-to-model.js";
import { modelToMarkdown } from "../src/model/model-to-markdown.js";
import {
  splitBlock,
  mergeWithPreviousBlock,
  updateBlockContent,
} from "../src/model/operations.js";
import { restoreModelCursorToDom } from "../src/model/cursor-mapping.js";
import {
  modelCursorToFlatOffset,
  flatOffsetToModelCursor,
} from "../src/components/Editor.js";
import type { Document, ModelCursor } from "../src/model/types.js";
import {
  paragraphBlock,
  bulletListBlock,
  orderedListBlock,
  headingBlock,
} from "./arbitraries.js";
import { assertBlankLinesClean, typeCharAtCursor, assertCursorAt } from "./test-helpers.js";
import { fcOptions } from "./fc-config.js";

// --- Types ---

type Model = { doc: Document; cursor: ModelCursor };
type Real = {
  editable: HTMLElement;
  rerender: ReturnType<typeof render>["rerender"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: ReturnType<typeof vi.fn>;
};

// --- Simple document arbitrary ---

const simpleDocArb = fc
  .array(fc.oneof(paragraphBlock, bulletListBlock, orderedListBlock, headingBlock), {
    minLength: 1,
    maxLength: 3,
  })
  .map((blocks) => cstToModel(parse(blocks.join("\n\n"))));

// --- Helpers ---

function syncReal(model: Model, real: Real): void {
  real.onChange.mockClear();
  const markdown = modelToMarkdown(model.doc);
  real.rerender(<Editor value={markdown} onChange={real.onChange as (v: string) => void} />);
  restoreModelCursorToDom(real.editable, model.cursor);
}

function simulateTypeChar(char: string, editable: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);
  let node: Node = range.startContainer;
  let offset: number = range.startOffset;

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
      return;
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

/** Check if offset is within (or at start of) a list item marker in the given content. */
function isWithinListMarker(content: string, offset: number): boolean {
  const lineStart = offset > 0 ? content.lastIndexOf("\n", offset - 1) + 1 : 0;
  const restOfLine = content.slice(lineStart);
  const markerMatch = restOfLine.match(/^( {0,3})([-+*] |\d{1,9}[.)] )/);
  if (markerMatch && offset - lineStart < markerMatch[0].length) return true;
  // Cursor at the very start of a list line (before the marker)
  if (offset === lineStart && /^( {0,3})([-+*] +|\d{1,9}[.)] +)/.test(restOfLine)) return true;
  return false;
}

/** Length of the heading marker prefix ("## " → 3). Returns 0 for non-heading content. */
function headingMarkerLen(content: string): number {
  const m = content.match(/^(#{1,6} )/);
  return m ? m[0].length : 0;
}

/** Clamp a cursor to valid bounds in doc (used when normalization may change block count). */
function clampCursor(doc: Document, cursor: ModelCursor): ModelCursor {
  if (doc.blocks.length === 0) return { blockIndex: 0, offset: 0 };
  const bi = Math.min(cursor.blockIndex, doc.blocks.length - 1);
  const block = doc.blocks[bi];
  const maxOff = block.type === "blank_line" ? 0 : block.content.length;
  return { blockIndex: bi, offset: Math.min(cursor.offset, maxOff) };
}

// --- Commands ---

class TypeCharCommand implements fc.Command<Model, Real> {
  constructor(private readonly char: string) {}

  check(m: Readonly<Model>): boolean {
    const { doc, cursor } = m;
    const { blockIndex, offset } = cursor;
    if (blockIndex >= doc.blocks.length) return false;
    const block = doc.blocks[blockIndex];

    // blank_line: only at offset 0 (no content), always allowed
    if (block.type === "blank_line") return true;

    const content = block.content;
    if (content.length >= 500) return false;

    // Don't type adjacent to block-internal '\n' (cursor would be on element boundary)
    if (offset > 0 && content[offset - 1] === "\n") return false;
    if (offset < content.length && content[offset] === "\n") return false;

    // Don't type within list item marker (would corrupt list structure)
    if (block.type === "list" && isWithinListMarker(content, offset)) return false;

    // Don't type within heading marker "## " (would demote heading to paragraph)
    if (block.type === "heading" && offset < headingMarkerLen(content)) return false;

    return true;
  }

  run(m: Model, r: Real): void {
    syncReal(m, r);

    const { blockIndex, offset } = m.cursor;
    const block = m.doc.blocks[blockIndex];

    if (block.type === "blank_line") {
      // blank_line has no text node; use typeCharAtCursor which handles the element case
      typeCharAtCursor(r.editable, this.char);
    } else {
      simulateTypeChar(this.char, r.editable);
    }

    expect(r.onChange).toHaveBeenCalledTimes(1);
    const newMarkdown = r.onChange.mock.calls[0][0] as string;

    const newContent = block.type === "blank_line"
      ? this.char
      : block.content.slice(0, offset) + this.char + block.content.slice(offset);
    const expectedDoc = updateBlockContent(m.doc, blockIndex, newContent);
    const expectedMarkdown = modelToMarkdown(expectedDoc);
    expect(newMarkdown).toBe(expectedMarkdown);

    // Normalize m.doc to canonical form, and compute cursor via flat offset
    // (same as Editor's applyModel / handleInput) so m.cursor matches the DOM.
    const newOffset = block.type === "blank_line" ? 1 : offset + 1;
    const flatOffTc = modelCursorToFlatOffset(expectedDoc, { blockIndex, offset: newOffset }, expectedMarkdown);
    m.doc = cstToModel(parse(expectedMarkdown));
    m.cursor = flatOffsetToModelCursor(m.doc, flatOffTc, expectedMarkdown);

    // DOM 検証: rerender 後に blank_line が汚染されていないか確認
    r.onChange.mockClear();
    r.rerender(<Editor value={newMarkdown} onChange={r.onChange as (v: string) => void} />);
    const domBlocks = r.editable.querySelectorAll("[data-block-index]");
    expect(domBlocks.length).toBe(m.doc.blocks.length);
    assertBlankLinesClean(r.editable);
    assertCursorAt(r.editable, m.cursor.blockIndex, m.cursor.offset);
  }

  toString(): string {
    return `TypeChar(${JSON.stringify(this.char)})`;
  }
}

class EnterCommand implements fc.Command<Model, Real> {
  check(m: Readonly<Model>): boolean {
    const { doc, cursor } = m;
    const { blockIndex, offset } = cursor;
    if (blockIndex >= doc.blocks.length) return false;
    const block = doc.blocks[blockIndex];
    const content = block.type === "blank_line" ? "" : block.content;

    // Don't split adjacent to block-internal '\n': the DOM cursor mapping for
    // multi-line blocks (especially lists with blank line separators) uses a
    // different offset scheme from the content string around '\n' boundaries.
    if (offset > 0 && content[offset - 1] === "\n") return false;
    if (offset < content.length && content[offset] === "\n") return false;

    // Don't split after a space: trailing spaces before the inserted '\n' are
    // interpreted as hard line breaks by the parser, causing canonical
    // normalization to diverge from splitBlock's prediction.
    if (offset > 0 && content[offset - 1] === " ") return false;

    // Don't split at or within heading marker (would produce degenerate "## " heading)
    if (block.type === "heading" && offset <= headingMarkerLen(content)) return false;

    // Don't split at or within list item marker
    if (block.type === "list" && isWithinListMarker(content, offset)) return false;

    return true;
  }

  run(m: Model, r: Real): void {
    syncReal(m, r);
    fireEvent.keyDown(r.editable, { key: "Enter" });

    expect(r.onChange).toHaveBeenCalledTimes(1);
    const newMarkdown = r.onChange.mock.calls[0][0] as string;

    const { newDoc, newCursor } = splitBlock(m.doc, m.cursor);
    expect(newMarkdown).toBe(modelToMarkdown(newDoc));

    // Normalize to canonical form, using the same flat-offset cursor conversion
    // as Editor's applyModel, so m.cursor matches where the Editor places the DOM cursor.
    const canonicalDoc = cstToModel(parse(newMarkdown));
    m.doc = canonicalDoc;
    const flatOff = modelCursorToFlatOffset(newDoc, newCursor, newMarkdown);
    m.cursor = flatOffsetToModelCursor(canonicalDoc, flatOff, newMarkdown);

    // DOM 検証: rerender 後に blank_line が汚染されていないか確認
    r.onChange.mockClear();
    r.rerender(<Editor value={newMarkdown} onChange={r.onChange as (v: string) => void} />);
    const domBlocks = r.editable.querySelectorAll("[data-block-index]");
    expect(domBlocks.length).toBe(m.doc.blocks.length);
    assertBlankLinesClean(r.editable);
    assertCursorAt(r.editable, m.cursor.blockIndex, m.cursor.offset);
  }

  toString(): string {
    return `Enter`;
  }
}

class BackspaceCommand implements fc.Command<Model, Real> {
  check(m: Readonly<Model>): boolean {
    const { doc, cursor } = m;
    const { blockIndex, offset } = cursor;
    if (blockIndex >= doc.blocks.length) return false;
    const block = doc.blocks[blockIndex];

    if (offset > 0 && block.type !== "blank_line") {
      const content = block.content;
      // Skip isAtLineStart case (content[offset-1] === '\n') — Editor intercepts
      // these as intra-block line merges; handle only the browser-backspace case.
      if (content[offset - 1] === "\n") return false;
      // Skip at end of a line: deleting the last char before '\n' can expose
      // trailing spaces that trigger hard line break / loose list in the parser,
      // causing canonical normalization to diverge from the oracle.
      if (offset < content.length && content[offset] === "\n") return false;
      // Skip when deleting the last char of content would expose a trailing '\n':
      // oracle produces content ending with '\n', but extractBlockText strips it,
      // so modelToMarkdown(oracle) ≠ actual onChange output.
      if (offset === content.length && content.length >= 2 && content[offset - 2] === "\n") return false;

      // Don't delete within list item marker
      if (block.type === "list") {
        const deletePos = offset - 1;
        const lineStart = deletePos > 0 ? content.lastIndexOf("\n", deletePos - 1) + 1 : 0;
        const restOfLine = content.slice(lineStart);
        const markerMatch = restOfLine.match(/^( {0,3})([-+*] |\d{1,9}[.)] )/);
        if (markerMatch && deletePos - lineStart < markerMatch[0].length) return false;
      }

      // Don't delete within heading marker "## " (would demote to paragraph)
      if (block.type === "heading" && offset <= headingMarkerLen(content)) return false;

      return true;
    }

    // At block start (offset === 0): Editor handles via mergeWithPreviousBlock.
    // Requires a previous block to merge into.
    if (offset === 0 && blockIndex > 0) return true;

    return false;
  }

  run(m: Model, r: Real): void {
    syncReal(m, r);

    const { doc, cursor } = m;
    const { blockIndex, offset } = cursor;
    const block = doc.blocks[blockIndex];

    if (offset > 0) {
      // Within block — handleBackspaceKey returns early (not at block start,
      // not blank_line, not at line start), so the browser would normally handle it.
      fireEvent.keyDown(r.editable, { key: "Backspace" });
      expect(r.onChange).not.toHaveBeenCalled();

      // Simulate the browser's DOM backspace on the active text node
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        const nodeOffset = range.startOffset;
        if (node.nodeType === Node.TEXT_NODE && nodeOffset > 0) {
          const text = node.textContent!;
          node.textContent = text.slice(0, nodeOffset - 1) + text.slice(nodeOffset);
          const newRange = document.createRange();
          newRange.setStart(node, nodeOffset - 1);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
        }
      }

      fireEvent.input(r.editable);
      expect(r.onChange).toHaveBeenCalledTimes(1);

      const newContent = block.content.slice(0, offset - 1) + block.content.slice(offset);
      const expectedDoc = updateBlockContent(doc, blockIndex, newContent);
      const expectedMarkdown = modelToMarkdown(expectedDoc);
      expect(r.onChange.mock.calls[0][0]).toBe(expectedMarkdown);

      // Normalize m.doc to canonical form so it stays in sync with Editor's
      // internal docRef (which may be rebuilt by parse on the next rerender).
      m.doc = cstToModel(parse(expectedMarkdown));
      m.cursor = clampCursor(m.doc, { blockIndex, offset: offset - 1 });

      // DOM 検証
      r.onChange.mockClear();
      r.rerender(<Editor value={expectedMarkdown} onChange={r.onChange as (v: string) => void} />);
      const domBlocksInner = r.editable.querySelectorAll("[data-block-index]");
      expect(domBlocksInner.length).toBe(m.doc.blocks.length);
      assertBlankLinesClean(r.editable);
      assertCursorAt(r.editable, m.cursor.blockIndex, m.cursor.offset);
    } else {
      // At block start — handleBackspaceKey intercepts and calls mergeWithPreviousBlock.
      fireEvent.keyDown(r.editable, { key: "Backspace" });
      expect(r.onChange).toHaveBeenCalledTimes(1);

      const { newDoc, newCursor } = mergeWithPreviousBlock(doc, cursor);
      const expectedMarkdown = modelToMarkdown(newDoc);
      expect(r.onChange.mock.calls[0][0]).toBe(expectedMarkdown);

      // Normalize to canonical form, using the same flat-offset cursor conversion as Editor.
      const canonicalDoc = cstToModel(parse(expectedMarkdown));
      m.doc = canonicalDoc;
      const flatOffBs = modelCursorToFlatOffset(newDoc, newCursor, expectedMarkdown);
      m.cursor = flatOffsetToModelCursor(canonicalDoc, flatOffBs, expectedMarkdown);

      // DOM 検証
      r.onChange.mockClear();
      r.rerender(<Editor value={expectedMarkdown} onChange={r.onChange as (v: string) => void} />);
      const domBlocksOuter = r.editable.querySelectorAll("[data-block-index]");
      expect(domBlocksOuter.length).toBe(m.doc.blocks.length);
      assertBlankLinesClean(r.editable);
      assertCursorAt(r.editable, m.cursor.blockIndex, m.cursor.offset);
    }
  }

  toString(): string {
    return `Backspace`;
  }
}

// --- Test ---

describe("model-based: Editor operations", () => {
  it("random command sequences maintain document model consistency", () => {
    const typeCharArb = fc
      .stringMatching(/^[a-zA-Z0-9]$/)
      .map((char) => new TypeCharCommand(char));
    const enterArb = fc.constant(new EnterCommand());
    const backspaceArb = fc.constant(new BackspaceCommand());

    fc.assert(
      fc.property(
        simpleDocArb.chain((doc) =>
          fc.integer({ min: 0, max: doc.blocks.length - 1 }).chain((blockIndex) => {
            const block = doc.blocks[blockIndex];
            const maxOffset = block.type === "blank_line" ? 0 : block.content.length;
            return fc
              .integer({ min: 0, max: maxOffset })
              .map((offset) => ({ doc, cursor: { blockIndex, offset } as ModelCursor }));
          }),
        ),
        fc.commands([typeCharArb, enterArb, backspaceArb], { maxCommands: 15 }),
        ({ doc: initialDoc, cursor: initialCursor }, cmds) => {
          const onChange = vi.fn();
          const { container, rerender } = render(
            <Editor value={modelToMarkdown(initialDoc)} onChange={onChange} />,
          );
          const editable = container.querySelector("[contenteditable]")! as HTMLElement;

          const model: Model = { doc: initialDoc, cursor: initialCursor };
          const real: Real = { editable, rerender, onChange };

          restoreModelCursorToDom(editable, initialCursor);

          try {
            fc.modelRun(() => ({ model, real }), cmds);
          } finally {
            cleanup();
          }
        },
      ),
      fcOptions({ numRuns: 100 }),
    );
  });
});
