import { useRef, useLayoutEffect, useMemo, useCallback } from "react";
import { parse } from "parser-cst";
import { cstToReact } from "../rendering/cst-to-react.js";
import { extractText } from "../text-extraction/extract-text.js";
import {
  saveCursorAsOffset,
  restoreCursorFromOffset,
} from "../cursor/cursor.js";
import { getListContinuation } from "../editing/list-continuation.js";
import { indentListItem, dedentListItem } from "../editing/list-indent.js";

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

        // Check if cursor is inside a blank_line element
        let node: Node | null = sel.getRangeAt(0).startContainer;
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

        if (!inBlankLine) return; // let browser handle normal backspace

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
