import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Editor } from "../src/components/Editor.js";
import { setCursor, assertBlankLinesClean, assertCursorAt } from "./test-helpers.js";

describe("Backspace behavior", () => {
  describe("Backspace on blank line", () => {
    it("removes blank line between paragraphs", () => {
      const onChange = vi.fn();
      const { container, rerender } = render(
        <Editor value={"Hello\n\nWorld"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const blankLine = editable.querySelector("[data-block='blank_line']")!;
      setCursor(blankLine, 0);

      fireEvent.keyDown(editable, { key: "Backspace" });
      expect(onChange).toHaveBeenCalledWith("Hello\nWorld");

      rerender(<Editor value="Hello\nWorld" onChange={onChange} />);
      expect(editable.querySelector("[data-block='blank_line']")).toBeNull();
      assertBlankLinesClean(editable as HTMLElement);
      assertCursorAt(editable as HTMLElement, 0, 5);
    });

    it("removes blank line at end of document", () => {
      const onChange = vi.fn();
      const { container, rerender } = render(
        <Editor value={"Hello\n\n"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const blankLine = editable.querySelector("[data-block='blank_line']")!;
      setCursor(blankLine, 0);

      fireEvent.keyDown(editable, { key: "Backspace" });
      expect(onChange).toHaveBeenCalledWith("Hello");

      rerender(<Editor value="Hello" onChange={onChange} />);
      const blocks = editable.querySelectorAll("[data-block-index]");
      expect(blocks.length).toBe(1);
      assertBlankLinesClean(editable as HTMLElement);
      assertCursorAt(editable as HTMLElement, 0, 5);
    });

    it("does not intercept backspace in normal paragraph", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value="Hello" onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const textNode = editable.querySelector("p")!.firstChild!;
      setCursor(textNode, 5);

      fireEvent.keyDown(editable, { key: "Backspace" });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("Backspace at list item boundaries", () => {
    it("backspace at start of list item merges with previous item", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"- aaa\n- bbb"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const lis = editable.querySelectorAll("[data-block='list_item']");
      const lastLi = lis[lis.length - 1];
      setCursor(lastLi.firstChild!, 0);

      fireEvent.keyDown(editable, { key: "Backspace" });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toBe("- aaa- bbb");
    });

    it("backspace at start of list item after marker deletion merges correctly", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"- aaa\n- "} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const lis = editable.querySelectorAll("[data-block='list_item']");
      const lastLi = lis[lis.length - 1];
      setCursor(lastLi.firstChild!, 0);

      fireEvent.keyDown(editable, { key: "Backspace" });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toBe("- aaa- ");
    });

    it("backspace at start of non-first block (cursor on element node) is intercepted", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"- aaa\n\nxyz"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const p = editable.querySelector("p")!;
      setCursor(p, 0);

      fireEvent.keyDown(editable, { key: "Backspace" });
      expect(onChange).toHaveBeenCalledTimes(1);
      // Prev block is blank_line → it gets deleted but canonical form re-adds it,
      // so the emitted value is unchanged (same as input)
      expect(onChange.mock.calls[0][0]).toBe("- aaa\n\nxyz");
    });

    it("backspace at start of empty block with placeholder br is intercepted", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"- aaa\n- bbb\n-"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const p = editable.querySelector("p[data-block='paragraph']")!;
      expect(p.textContent).toBe("-");

      p.innerHTML = "<br>";
      setCursor(p, 0);

      fireEvent.keyDown(editable, { key: "Backspace" });
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  it("backspace at start of first block is a no-op", () => {
    const onChange = vi.fn();
    const { container } = render(
      <Editor value="Hello" onChange={onChange} />,
    );
    const editable = container.querySelector("[contenteditable]")!;

    const textNode = editable.querySelector("p")!.firstChild!;
    setCursor(textNode, 0); // cursor at very start of document

    fireEvent.keyDown(editable, { key: "Backspace" });
    // blockIndex=0, offset=0 → early return in handleBackspaceKey
    expect(onChange).not.toHaveBeenCalled();
  });

  describe("backspace after browser-deletes last char of block", () => {
    it("deleting last char of last paragraph produces correct value", () => {
      // "a\n\nb" → cursor at end of "b" → browser deletes "b" → input fires
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"a\n\nb"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const lastP = editable.querySelector("[data-block-index='2']") as HTMLElement;
      const textNode = lastP.firstChild!;
      setCursor(textNode, 1);

      // keyDown: browser handles (no onChange)
      fireEvent.keyDown(editable, { key: "Backspace" });
      expect(onChange).not.toHaveBeenCalled();

      // Simulate browser deleting "b" then firing input
      textNode.textContent = "";
      setCursor(lastP, 0);
      fireEvent.input(editable);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toBe("a\n\n");
    });

    it("after browser-deletes last char, DOM does NOT contain stale extra block", () => {
      // Bug: docRef kept phantom para("") after browser backspace, causing
      // an extra <p><br></p> to appear after rerender with "a\n\n"
      const onChange = vi.fn();
      const { container, rerender } = render(
        <Editor value={"a\n\nb"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const lastP = editable.querySelector("[data-block-index='2']") as HTMLElement;
      const textNode = lastP.firstChild!;
      setCursor(textNode, 1);
      textNode.textContent = "";
      setCursor(lastP, 0);
      fireEvent.input(editable);
      const v1 = onChange.mock.calls[0][0]; // "a\n\n"

      onChange.mockClear();
      rerender(<Editor value={v1} onChange={onChange} />);

      // DOM should match canonical "a\n\n" = [para("a"), blank_line]
      // i.e. only 2 blocks with data-block-index, not 3
      const blocks = editable.querySelectorAll("[data-block-index]");
      expect(blocks.length).toBe(2);
    });

    it("after browser-deletes last char, subsequent Backspace on blank_line gives 'a' not 'a\\n'", () => {
      // Bug: stale para("") in docRef caused mergeWithPreviousBlock to produce
      // para("a\n") → onChange("a\n") instead of correct onChange("a")
      const onChange = vi.fn();
      const { container, rerender } = render(
        <Editor value={"a\n\nb"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      // Step 1: browser deletes "b" → "a\n\n"
      const lastP = editable.querySelector("[data-block-index='2']") as HTMLElement;
      const textNode = lastP.firstChild!;
      setCursor(textNode, 1);
      textNode.textContent = "";
      setCursor(lastP, 0);
      fireEvent.input(editable);
      const v1 = onChange.mock.calls[0][0];
      expect(v1).toBe("a\n\n");

      onChange.mockClear();
      rerender(<Editor value={v1} onChange={onChange} />);

      // Step 2: cursor on blank_line, Backspace → should give "a"
      const blankLine = editable.querySelector("[data-block='blank_line']")!;
      setCursor(blankLine, 0);
      fireEvent.keyDown(editable, { key: "Backspace" });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toBe("a");
    });
  });

  it("Enter to create list item, backspace to remove it, then continue into previous item", () => {
    let currentValue = "- aaa\n- bbb";
    const onChange = vi.fn((v: string) => {
      currentValue = v;
    });

    const { container, rerender } = render(
      <Editor value={currentValue} onChange={onChange} />,
    );
    const editable = container.querySelector("[contenteditable]")!;

    // Enter at end of second item
    const lis = editable.querySelectorAll("[data-block='list_item']");
    setCursor(lis[1].lastChild!, lis[1].lastChild!.textContent!.length);
    fireEvent.keyDown(editable, { key: "Enter" });
    currentValue = onChange.mock.calls[0][0];
    expect(currentValue).toBe("- aaa\n- bbb\n- ");
    onChange.mockClear();
    rerender(<Editor value={currentValue} onChange={onChange} />);

    // Backspace 1: delete " " from new list item (browser handles)
    {
      const li3 = editable.querySelectorAll("[data-block='list_item']")[2];
      li3.lastChild!.textContent = "-";
      setCursor(li3.lastChild!, 1);
      fireEvent.input(editable);
      currentValue = onChange.mock.calls[0][0];
      expect(currentValue).toBe("- aaa\n- bbb\n-");
      onChange.mockClear();
      rerender(<Editor value={currentValue} onChange={onChange} />);
    }

    // Backspace 2: delete "-" from <p> (browser handles)
    {
      const p = editable.querySelector("p")!;
      expect(p.textContent).toBe("-");
      p.firstChild!.textContent = "";
      setCursor(p.firstChild!, 0);
      fireEvent.input(editable);
      currentValue = onChange.mock.calls[0][0];
      onChange.mockClear();
      rerender(<Editor value={currentValue} onChange={onChange} />);
    }

    // Backspace 3: delete last char of "bbb"
    {
      const li2 = editable.querySelectorAll("[data-block='list_item']")[1];
      const textNode = li2.lastChild!;
      setCursor(textNode, textNode.textContent!.length);
      textNode.textContent = "- bb";
      setCursor(textNode, 4);
      fireEvent.input(editable);
      expect(onChange).toHaveBeenCalled();
      expect(currentValue).toBe("- aaa\n- bb");
    }
  });
});
