import { useRef, useLayoutEffect, useMemo, useCallback } from "react";
import { parse } from "../../../parser/dist/index.js";
import { cstToReact } from "../rendering/cst-to-react.js";
import { extractText } from "../text-extraction/extract-text.js";
import {
  saveCursorAsOffset,
  restoreCursorFromOffset,
} from "../cursor/cursor.js";
import { getListContinuation } from "../editing/list-continuation.js";
import { indentListItem, dedentListItem } from "../editing/list-indent.js";

const BLOCK_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "div", "pre"]);

/**
 * Check if the cursor is at the very start (offset 0) of a block element.
 * When true, browser backspace would merge/remove DOM blocks, which breaks
 * React reconciliation. We must intercept and handle it ourselves.
 */
function isAtBlockStart(range: Range, container: HTMLElement): boolean {
  let node: Node | null = range.startContainer;
  let offset = range.startOffset;

  // Cursor must be at offset 0 within its node
  if (offset !== 0) return false;

  // If the cursor is directly on a block element at offset 0 (e.g., the browser
  // positions the cursor on <p> itself rather than inside a child text node),
  // check that block directly.
  if (
    node.nodeType === Node.ELEMENT_NODE &&
    node !== container &&
    BLOCK_TAGS.has((node as HTMLElement).tagName.toLowerCase())
  ) {
    return getPreviousBlock(node as HTMLElement, container) !== null;
  }

  // Walk up from the cursor node to find the enclosing block element.
  // At each level, the node must be the first child of its parent,
  // otherwise the cursor is not at the very start of the block.
  while (node && node !== container) {
    const parent: Node | null = node.parentNode;
    if (!parent) return false;

    // If this node is not the first child, cursor is not at block start
    if (parent.firstChild !== node) return false;

    // If the parent is a block element, we found it
    if (
      parent.nodeType === Node.ELEMENT_NODE &&
      BLOCK_TAGS.has((parent as HTMLElement).tagName.toLowerCase())
    ) {
      // Only intercept if this block is NOT the first block in the container.
      // (No previous block to merge with.)
      const block = parent as HTMLElement;
      return getPreviousBlock(block, container) !== null;
    }

    node = parent;
  }

  return false;
}

/** Find the previous leaf block sibling, walking up through containers. */
function getPreviousBlock(
  block: HTMLElement,
  container: HTMLElement,
): HTMLElement | null {
  let node: HTMLElement | null = block;
  while (node && node !== container) {
    if (node.previousElementSibling) {
      return node.previousElementSibling as HTMLElement;
    }
    node = node.parentElement;
  }
  return null;
}

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
  const cursorOffsetRef = useRef<number | null>(null);
  const isComposingRef = useRef(false);

  // Parse and render CST to React elements
  const renderedContent = useMemo(() => {
    const doc = parse(value);
    return cstToReact(doc);
  }, [value]);

  // After React reconciles the DOM, clean up browser mutations and restore cursor.
  // React may skip updating blank_line divs if the old and new VDOM are identical
  // (both <div data-block="blank_line"><br/></div>), leaving browser-typed text
  // in the DOM alongside the new React-created elements — causing text duplication.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Reset blank_line divs that were mutated by browser typing
    const blankLines = container.querySelectorAll("[data-block='blank_line']");
    for (const bl of blankLines) {
      if (bl.childNodes.length !== 1 || bl.firstChild?.nodeName !== "BR") {
        bl.innerHTML = "<br>";
      }
    }

    if (cursorOffsetRef.current === null) return;
    restoreCursorFromOffset(container, cursorOffsetRef.current);
    cursorOffsetRef.current = null;
  }, [value]);

  const handleInput = useCallback(() => {
    if (isComposingRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    cursorOffsetRef.current = saveCursorAsOffset(container);
    const newText = extractText(container);
    onChange(newText);
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const container = containerRef.current;
        if (!container) return;

        const offset = saveCursorAsOffset(container);
        if (offset === null) return;

        const clampedOffset = Math.min(offset, value.length);
        const result = e.shiftKey
          ? dedentListItem(value, clampedOffset)
          : indentListItem(value, clampedOffset);

        if (!result) return;

        cursorOffsetRef.current = result.newOffset;
        onChange(result.newValue);
        return;
      }

      if (e.key === "Backspace") {
        const container = containerRef.current;
        if (!container) return;

        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        const range = sel.getRangeAt(0);

        // Check if cursor is inside a blank_line element
        let node: Node | null = range.startContainer;
        let inBlankLine = false;
        while (node && node !== container) {
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            (node as HTMLElement).dataset.block === "blank_line"
          ) {
            inBlankLine = true;
            break;
          }
          node = node.parentNode;
        }

        // Check if cursor is at the start of a block element (offset 0).
        // If so, intercept to prevent the browser from modifying the DOM
        // structure (e.g., merging/removing list items), which causes
        // React reconciliation errors.
        const atBlockStart = isAtBlockStart(range, container);

        if (!inBlankLine && !atBlockStart) return; // let browser handle normal backspace

        e.preventDefault();

        const offset = saveCursorAsOffset(container);
        if (offset === null || offset === 0) return;

        const clampedOffset = Math.min(offset, value.length);
        if (clampedOffset === 0) return;

        const newText =
          value.slice(0, clampedOffset - 1) + value.slice(clampedOffset);
        cursorOffsetRef.current = clampedOffset - 1;
        onChange(newText);
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const container = containerRef.current;
        if (!container) return;

        const offset = saveCursorAsOffset(container);
        if (offset === null) return;

        // Use value directly instead of extractText to preserve trailing newlines
        // that would be stripped by extractText's trailing-\n removal.
        const clampedOffset = Math.min(offset, value.length);
        const { insertion, cursorOffset } = getListContinuation(value, clampedOffset);
        const newText =
          value.slice(0, clampedOffset) + insertion + value.slice(clampedOffset);

        cursorOffsetRef.current = cursorOffset;
        onChange(newText);
      }
    },
    [onChange, value],
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
