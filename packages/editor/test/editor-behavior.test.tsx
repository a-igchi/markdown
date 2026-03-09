import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { parse } from "parser-cst";
import { Editor } from "../src/components/Editor.js";
import { cstToReact } from "../src/rendering/cst-to-react.js";
import {
  saveCursorAsOffset,
  restoreCursorFromOffset,
} from "../src/cursor/cursor.js";

describe("Editor behavior", () => {
  it("calls onChange on input events", () => {
    const onChange = vi.fn();
    const { container } = render(
      <Editor value="Hello" onChange={onChange} />,
    );
    const editable = container.querySelector("[contenteditable]")!;
    fireEvent.input(editable);
    expect(onChange).toHaveBeenCalled();
  });

  describe("IME composition", () => {
    it("suppresses onChange during IME composition", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value="Hello" onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      fireEvent.compositionStart(editable);
      fireEvent.input(editable);
      expect(onChange).not.toHaveBeenCalled();

      fireEvent.compositionEnd(editable);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("calls onChange after compositionEnd even if multiple inputs during composition", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value="Test" onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      fireEvent.compositionStart(editable);
      fireEvent.input(editable);
      fireEvent.input(editable);
      fireEvent.input(editable);
      expect(onChange).not.toHaveBeenCalled();

      fireEvent.compositionEnd(editable);
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("cursor edge cases", () => {
    it("cursor restore clamps to end when offset exceeds document", () => {
      const doc = parse("Hello\n");
      const elements = cstToReact(doc);
      const { container } = render(<div>{elements}</div>);
      const root = container.firstElementChild as HTMLElement;

      restoreCursorFromOffset(root, 6);
      const restored = saveCursorAsOffset(root);
      expect(restored).toBe(5);
    });
  });
});
