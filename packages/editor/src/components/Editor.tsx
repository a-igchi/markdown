import { useRef, useLayoutEffect, useMemo, useCallback } from "react";
import { parse } from "markdown-parser";
import { astToReact } from "../rendering/ast-to-react.js";
import { extractText } from "../text-extraction/extract-text.js";
import {
  saveCursorAsOffset,
  restoreCursorFromOffset,
} from "../cursor/cursor.js";

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

  // Parse and render AST to React elements
  const renderedContent = useMemo(() => {
    const doc = parse(value);
    return astToReact(doc, value);
  }, [value]);

  // Restore cursor after React re-renders the DOM
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || cursorOffsetRef.current === null) return;

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
      if (e.key === "Enter") {
        e.preventDefault();
        const container = containerRef.current;
        if (!container) return;

        const offset = saveCursorAsOffset(container);
        if (offset === null) return;

        const currentText = extractText(container);
        const newText =
          currentText.slice(0, offset) + "\n\n" + currentText.slice(offset);

        // Place cursor at the blank line (after the first \n)
        cursorOffsetRef.current = offset + 1;
        onChange(newText);
      }
    },
    [onChange],
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
