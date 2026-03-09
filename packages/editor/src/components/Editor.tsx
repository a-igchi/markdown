import { useRef, useLayoutEffect, useCallback } from "react";
import { parse } from "parser-cst";
import { cstToModel } from "../model/cst-to-model.js";
import { modelToMarkdown } from "../model/model-to-markdown.js";
import { modelToReact } from "../model/model-to-react.js";
import {
  splitBlock,
  mergeWithPreviousBlock,
  updateBlockContent,
} from "../model/operations.js";
import {
  saveDomCursorAsModelCursor,
  restoreModelCursorToDom,
} from "../model/cursor-mapping.js";
import { indentListItem, dedentListItem } from "../editing/list-indent.js";
import type { Block, Document, ModelCursor } from "../model/types.js";

export interface EditorProps {
  /** The markdown source text (controlled component) */
  value: string;
  /** Called when the markdown text changes */
  onChange: (value: string) => void;
  /** Optional className for the root contentEditable div */
  className?: string;
}

export function Editor({ value, onChange, className }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<Document>(cstToModel(parse(value)));
  const lastOwnValueRef = useRef<string>(value);
  const modelCursorRef = useRef<ModelCursor | null>(null);
  const isComposingRef = useRef(false);

  // Rebuild model from CST when value changes externally
  if (value !== lastOwnValueRef.current) {
    docRef.current = cstToModel(parse(value));
    lastOwnValueRef.current = value;
  }

  const renderedContent = modelToReact(docRef.current);

  // After React reconciles the DOM, restore cursor from ModelCursor
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || modelCursorRef.current === null) return;
    restoreModelCursorToDom(container, modelCursorRef.current);
    modelCursorRef.current = null;
  });

  /**
   * Apply a new document model: update refs, emit onChange.
   * The DOM update happens when the parent rerenders the Editor with the new
   * value prop (which matches lastOwnValueRef, so the model is not rebuilt).
   */
  const applyModel = useCallback(
    (newDoc: Document, newCursor?: ModelCursor) => {
      const markdown = modelToMarkdown(newDoc);
      // Normalize to canonical form so DOM always matches the parsed structure
      // (e.g. splitBlock produces para("") but parse gives blank_line)
      const canonicalDoc = cstToModel(parse(markdown));
      docRef.current = canonicalDoc;
      if (newCursor !== undefined) {
        const flatOffset = modelCursorToFlatOffset(newDoc, newCursor, markdown);
        modelCursorRef.current = flatOffsetToModelCursor(canonicalDoc, flatOffset, markdown);
      }
      lastOwnValueRef.current = markdown;
      onChange(markdown);
    },
    [onChange],
  );

  const handleInput = useCallback(() => {
    if (isComposingRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    const cursor = saveDomCursorAsModelCursor(container);
    if (cursor === null) {
      // No cursor available: emit onChange with current model state
      onChange(modelToMarkdown(docRef.current));
      return;
    }

    const blockEl = container.querySelector(
      `[data-block-index="${cursor.blockIndex}"]`,
    ) as HTMLElement | null;
    if (!blockEl) return;

    const newContent = extractBlockText(blockEl);

    // React's vdom for blank_line is always <div><br/> — identical before and
    // after the user types into it — so React won't update the real DOM.
    // The typed text stays in the blank_line div while a new <p> for the typed
    // content is also inserted, producing a duplicate (e.g. "a\nb\nb").
    // Fix: reset the blank_line div to its expected state now so that React's
    // reconciliation finds the real DOM already matching the vdom.
    const prevBlock = docRef.current.blocks[cursor.blockIndex];
    if (prevBlock?.type === "blank_line" && newContent !== "") {
      while (blockEl.firstChild) blockEl.removeChild(blockEl.firstChild);
      blockEl.appendChild(document.createElement("br"));
    }

    let newDoc: Document;
    if (cursor.blockIndex >= docRef.current.blocks.length) {
      // Empty editor: placeholder has data-block-index=0 but doc has no blocks.
      // Treat as inserting a new paragraph.
      newDoc = { blocks: newContent ? [{ type: "paragraph", content: newContent }] : [] };
    } else {
      newDoc = updateBlockContent(docRef.current, cursor.blockIndex, newContent);
    }

    // Ensure blank_line separators exist between adjacent content blocks so
    // the DOM always reflects canonical markdown structure. Without this,
    // two adjacent paragraphs would show no blank_line between them, and the
    // blank_line would suddenly appear on the next Enter (visual glitch).
    //
    // We insert missing blank_lines without re-parsing block content (which
    // would change the markdown value for edge-case content like "- aaa\n-").
    // Exception: when the block was emptied (newContent === ""), use the
    // canonical form to avoid phantom empty blocks in docRef. A trailing
    // para("") is invisible in markdown but causes incorrect merges on the
    // next Backspace if left in docRef.
    const normalizedDoc = insertMissingBlankLines(newDoc);
    const markdown = modelToMarkdown(newDoc); // same markdown for both
    const docForCursor = newContent === "" ? cstToModel(parse(markdown)) : normalizedDoc;
    docRef.current = docForCursor;
    if (docForCursor.blocks.length > 0) {
      const flatOffset = modelCursorToFlatOffset(newDoc, cursor, markdown);
      modelCursorRef.current = flatOffsetToModelCursor(docForCursor, flatOffset, markdown);
    }
    lastOwnValueRef.current = markdown;
    onChange(markdown);
  }, [onChange]);

  const handleTabKey = useCallback(
    (e: React.KeyboardEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      // Tab still works on the flat markdown string for list indent/dedent
      const cursor = saveDomCursorAsModelCursor(container);
      if (cursor === null) return;

      // Compute flat offset to use existing list-indent logic
      const markdown = modelToMarkdown(docRef.current);
      const flatOffset = modelCursorToFlatOffset(docRef.current, cursor, markdown);

      const result = e.shiftKey
        ? dedentListItem(markdown, flatOffset)
        : indentListItem(markdown, flatOffset);
      if (!result) return;

      const newDoc = cstToModel(parse(result.newValue));
      const newCursor = flatOffsetToModelCursor(newDoc, result.newOffset, result.newValue);
      applyModel(newDoc, newCursor);
    },
    [applyModel],
  );

  const handleBackspaceKey = useCallback(
    (e: React.KeyboardEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const cursor = saveDomCursorAsModelCursor(container);
      if (cursor === null) return;

      const block = docRef.current.blocks[cursor.blockIndex];
      const isAtBlockStart = cursor.offset === 0;
      const isInBlankLine = block?.type === "blank_line";
      // Cursor at start of a sub-line within a multi-line block (e.g. second list item)
      const isAtLineStart =
        !isInBlankLine &&
        cursor.offset > 0 &&
        block?.content[cursor.offset - 1] === "\n";

      if (!isAtBlockStart && !isInBlankLine && !isAtLineStart) return; // let browser handle

      e.preventDefault();

      if (isAtLineStart) {
        // Delete the '\n' separator within the block (merge two sub-lines)
        const newContent =
          block.content.slice(0, cursor.offset - 1) + block.content.slice(cursor.offset);
        const newDoc = updateBlockContent(docRef.current, cursor.blockIndex, newContent);
        applyModel(newDoc, { blockIndex: cursor.blockIndex, offset: cursor.offset - 1 });
        return;
      }

      if (cursor.blockIndex === 0 && cursor.offset === 0) return; // nothing to merge

      const { newDoc, newCursor } = mergeWithPreviousBlock(docRef.current, cursor);
      applyModel(newDoc, newCursor);
    },
    [applyModel],
  );

  const handleEnterKey = useCallback(
    (e: React.KeyboardEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const cursor = saveDomCursorAsModelCursor(container);
      if (cursor === null) return;

      // Detect split at a soft line break (\n within block content).
      // In that case Enter creates a blank_line separator, and the cursor
      // should land on the blank_line (the new empty line), not on the
      // right-hand content that was already below.
      const block = docRef.current.blocks[cursor.blockIndex];
      const isAtSoftLineBreak = block?.content[cursor.offset] === "\n";

      const { newDoc, newCursor } = splitBlock(docRef.current, cursor);
      applyModel(newDoc, newCursor);

      if (isAtSoftLineBreak) {
        const cur = modelCursorRef.current;
        const doc = docRef.current;
        if (
          cur !== null &&
          cur.blockIndex > 0 &&
          cur.offset === 0 &&
          doc.blocks[cur.blockIndex]?.type !== "blank_line" &&
          doc.blocks[cur.blockIndex - 1]?.type === "blank_line"
        ) {
          modelCursorRef.current = { blockIndex: cur.blockIndex - 1, offset: 0 };
        }
      }
    },
    [applyModel],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Tab") handleTabKey(e);
      else if (e.key === "Backspace") handleBackspaceKey(e);
      else if (e.key === "Enter") handleEnterKey(e);
    },
    [handleTabKey, handleBackspaceKey, handleEnterKey],
  );

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
    handleInput();
  }, [handleInput]);

  return (
    <div
      ref={containerRef}
      contentEditable
      suppressContentEditableWarning
      className={className}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
    >
      {renderedContent}
    </div>
  );
}

// --- Helpers ---

/**
 * Insert blank_line blocks between any two adjacent content blocks.
 * This ensures the document model always reflects canonical markdown
 * structure (paragraphs separated by blank lines) without re-parsing
 * individual block content.
 */
function insertMissingBlankLines(doc: Document): Document {
  const blocks = doc.blocks;
  if (blocks.length < 2) return doc;
  const newBlocks: Block[] = [];
  for (let i = 0; i < blocks.length; i++) {
    newBlocks.push(blocks[i]);
    if (i < blocks.length - 1) {
      const curr = blocks[i];
      const next = blocks[i + 1];
      if (curr.type !== "blank_line" && next.type !== "blank_line") {
        newBlocks.push({ type: "blank_line", content: "" });
      }
    }
  }
  return newBlocks.length === blocks.length ? doc : { blocks: newBlocks };
}

/**
 * Extract the visible text content from a single block element.
 * Placeholder <br> elements (sole child) are ignored (→ empty string).
 */
function extractBlockText(el: HTMLElement): string {
  const parts: string[] = [];
  extractNodeText(el, parts);
  // Strip the structural trailing newline added by leaf-block walking
  let text = parts.join("");
  // Strip all structural trailing newlines (loose lists add \n\n per item)
  while (text.endsWith("\n")) {
    text = text.slice(0, -1);
  }
  return text;
}

function extractNodeText(node: Node, parts: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    parts.push(node.textContent ?? "");
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === "br") {
    // Placeholder <br> (sole child of block) → skip
    const parent = el.parentElement;
    if (parent && parent.childNodes.length === 1) return;
    parts.push("\n");
    return;
  }

  // Recurse into children
  for (const child of el.childNodes) {
    extractNodeText(child, parts);
  }

  // Leaf-block elements contribute a trailing newline (for multi-line blocks).
  // Must stay in sync with isLeafBlock/walkBlock in dom-utils.ts/cursor-mapping.ts:
  // - <li data-block> (tight list items) are leaf blocks; <li> without data-block are containers.
  // - <div data-block="blank_line"> (inside loose list items) contributes \n just like
  //   walkBlock's onBlankLine does, so extraction and cursor offsets stay consistent.
  if (
    /^h[1-6]$/.test(tag) ||
    tag === "p" ||
    tag === "pre" ||
    (tag === "li" && el.dataset.block !== undefined) ||
    (tag === "div" && el.dataset.block !== undefined)
  ) {
    parts.push("\n");
  }
}

/**
 * Convert a ModelCursor to a flat character offset in the markdown string.
 * Used for Tab (list indent/dedent) which still operates on the flat string.
 */
export function modelCursorToFlatOffset(
  doc: Document,
  cursor: ModelCursor,
  markdown: string,
): number {
  // Rebuild a character-offset map: for each block, its start offset in the markdown string
  const blocks = doc.blocks;
  let flatOffset = 0;
  let remaining = markdown;

  for (let i = 0; i < cursor.blockIndex; i++) {
    const block = blocks[i];
    if (block.type === "blank_line") {
      // blank_line contributes "\n" separator
      flatOffset += 1;
      remaining = remaining.slice(1);
    } else {
      // Content block: content + separator
      const contentLen = block.content.length;
      flatOffset += contentLen;
      remaining = remaining.slice(contentLen);
      // Skip the separator after this block
      if (i < blocks.length - 1) {
        const next = blocks[i + 1];
        const sep = next.type === "blank_line" ? 1 : 2;
        flatOffset += sep;
        remaining = remaining.slice(sep);
      }
    }
  }

  return flatOffset + cursor.offset;
}

/**
 * Convert a flat markdown offset back to a ModelCursor.
 */
export function flatOffsetToModelCursor(
  doc: Document,
  flatOffset: number,
  markdown: string,
): ModelCursor {
  const blocks = doc.blocks;
  let pos = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === "blank_line") {
      if (flatOffset <= pos) {
        return { blockIndex: i, offset: 0 };
      }
      pos += 1;
      if (i < blocks.length - 1) {
        // The separator \n is already accounted for
      }
    } else {
      const contentEnd = pos + block.content.length;
      if (flatOffset <= contentEnd) {
        return { blockIndex: i, offset: flatOffset - pos };
      }
      pos = contentEnd;
      // Skip separator
      if (i < blocks.length - 1) {
        const next = blocks[i + 1];
        const sep = next.type === "blank_line" ? 1 : 2;
        pos += sep;
      }
    }
  }

  // Clamp to end of last block
  const lastIndex = blocks.length - 1;
  const lastBlock = blocks[lastIndex];
  return {
    blockIndex: lastIndex,
    offset: lastBlock.type === "blank_line" ? 0 : lastBlock.content.length,
  };
}

