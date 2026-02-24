import { Fragment, useRef, useLayoutEffect, useMemo, useCallback } from "react";
import { parse } from "markdown-parser";
import type { Document, ListItem } from "markdown-parser";
import { astToReact } from "../rendering/ast-to-react.js";
import { extractText } from "../text-extraction/extract-text.js";
import {
  saveCursorAsOffset,
  restoreCursorFromOffset,
} from "../cursor/cursor.js";

/**
 * Find the list item that contains the given character offset, if any.
 * Only checks top-level lists; returns the innermost matching item.
 */
function findListItemAt(doc: Document, offset: number): ListItem | null {
  for (const block of doc.children) {
    if (block.type === "list") {
      for (const item of block.children) {
        const start = item.sourceLocation.start.offset;
        const end = item.sourceLocation.end.offset;
        if (offset >= start && offset <= end) {
          return item;
        }
      }
    }
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
  const beforeInputOffsetRef = useRef<number | null>(null);
  const renderKeyRef = useRef(0);

  // Parse and render AST to React elements.
  // Increment renderKey on every value change so the keyed Fragment below
  // forces React to unmount/remount all children. This prevents stale DOM
  // caused by Chrome contentEditable extending inline elements (strong, em)
  // in ways React's reconciliation cannot detect.
  const renderedContent = useMemo(() => {
    renderKeyRef.current += 1;
    const doc = parse(value);
    return astToReact(doc, value);
  }, [value]);

  // Restore cursor after React re-renders the DOM
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (cursorOffsetRef.current === null) return;
    restoreCursorFromOffset(container, cursorOffsetRef.current);
    cursorOffsetRef.current = null;
  }, [value]);

  // Save cursor offset BEFORE the browser mutates the DOM.  This runs on the
  // clean React-rendered DOM, so the offset corresponds to `value`.
  const handleBeforeInput = useCallback(() => {
    if (isComposingRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    beforeInputOffsetRef.current = saveCursorAsOffset(container);
  }, []);

  const handleInput = useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      if (isComposingRef.current) return;

      const container = containerRef.current;
      if (!container) return;

      const nativeEvent = e.nativeEvent as InputEvent;
      const beforeOffset = beforeInputOffsetRef.current;
      beforeInputOffsetRef.current = null;

      // For simple text insertions and single-character deletions, compute the
      // new text from the previous value and the edit delta.  This avoids
      // reading the browser-mutated DOM which may contain &nbsp; artifacts from
      // contentEditable inline-formatting extension (e.g. typing right after a
      // <strong> element causes Chrome to absorb the character into the styled
      // element and insert a spurious &nbsp;).
      if (beforeOffset !== null) {
        if (
          nativeEvent.inputType === "insertText" &&
          nativeEvent.data != null
        ) {
          const data = nativeEvent.data;
          const newText =
            value.slice(0, beforeOffset) + data + value.slice(beforeOffset);
          cursorOffsetRef.current = beforeOffset + data.length;
          onChange(newText);
          return;
        }

        if (nativeEvent.inputType === "deleteContentBackward") {
          const deleteAt = beforeOffset - 1;
          if (deleteAt >= 0) {
            const newText =
              value.slice(0, deleteAt) + value.slice(beforeOffset);
            cursorOffsetRef.current = deleteAt;
            onChange(newText);
            return;
          }
        }

        if (nativeEvent.inputType === "deleteContentForward") {
          if (beforeOffset < value.length) {
            const newText =
              value.slice(0, beforeOffset) +
              value.slice(beforeOffset + 1);
            cursorOffsetRef.current = beforeOffset;
            onChange(newText);
            return;
          }
        }
      }

      // Fallback: extract text from the DOM (for paste, undo, etc.)
      cursorOffsetRef.current = saveCursorAsOffset(container);
      const newText = extractText(container);
      onChange(newText);
    },
    [onChange, value],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const container = containerRef.current;
        if (!container) return;

        const offset = saveCursorAsOffset(container);
        if (offset === null) return;

        const doc = parse(value);
        const listItem = findListItemAt(doc, offset);

        if (listItem) {
          // Inside a list item: insert a new item with the same marker
          const newMarker = listItem.marker + " ";
          const newText =
            value.slice(0, offset) + "\n" + newMarker + value.slice(offset);
          cursorOffsetRef.current = offset + 1 + newMarker.length;
          onChange(newText);
        } else {
          const newText =
            value.slice(0, offset) + "\n\n" + value.slice(offset);

          // Place cursor after the inserted \n\n (start of the new paragraph)
          cursorOffsetRef.current = offset + 2;
          onChange(newText);
        }
      }
    },
    [onChange, value],
  );

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
    // After IME composition ends, fall back to DOM extraction since the
    // beforeinput offset may not reflect the composed text correctly.
    const container = containerRef.current;
    if (!container) return;
    cursorOffsetRef.current = saveCursorAsOffset(container);
    const newText = extractText(container);
    onChange(newText);
  }, [onChange]);

  return (
    <div
      ref={containerRef}
      contentEditable
      suppressContentEditableWarning
      className={className}
      style={{ whiteSpace: "pre-wrap" }}
      onBeforeInput={handleBeforeInput}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
    >
      <Fragment key={renderKeyRef.current}>{renderedContent}</Fragment>
    </div>
  );
}
