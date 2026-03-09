import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Editor } from "../src/components/Editor.js";
import { setCursor, typeCharAtCursor, assertBlankLinesClean, assertCursorAt } from "./test-helpers.js";

const INITIAL_MARKDOWN = `# Hello World

This is a markdown editor with CST-based rendering.

- Item one
- Item two
- Item three

1. First
2. Second
3. Third

---

Another paragraph here.`;

describe("Typing behavior", () => {
  describe("canonical model after input", () => {
    it("typing into blank_line keeps canonical structure (no extra blank line on next Enter)", () => {
      const onChange = vi.fn();
      let currentValue = "a";

      const { container, rerender } = render(
        <Editor value="a" onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      // 1) Press Enter at end of "a" → "a\n\n"
      setCursor(editable.querySelector("p")!.firstChild!, 1);
      fireEvent.keyDown(editable, { key: "Enter" });
      currentValue = onChange.mock.calls[0][0];
      expect(currentValue).toBe("a\n\n");
      onChange.mockClear();
      rerender(<Editor value={currentValue} onChange={onChange} />);

      // 2) Type 'b' into the blank_line → "a\n\nb"
      const blankLine = editable.querySelector("[data-block='blank_line']")!;
      blankLine.innerHTML = "b";
      setCursor(blankLine.firstChild!, 1);
      fireEvent.input(editable);
      currentValue = onChange.mock.calls[0][0];
      expect(currentValue).toBe("a\n\nb");
      onChange.mockClear();
      rerender(<Editor value={currentValue} onChange={onChange} />);

      const blankLineAfter = editable.querySelector("[data-block='blank_line']");
      expect(blankLineAfter).not.toBeNull();

      // BUG CHECK: blank_line div must only contain <br>, not the typed "b".
      // If React didn't update the DOM (because vdom looked identical),
      // blankLineAfter.textContent would be "b" and a duplicate "b" would appear.
      expect(blankLineAfter!.textContent).toBe("");
      const bPara = editable.querySelector("[data-block-index='2']");
      expect(bPara?.textContent).toBe("b");
    });

    it("Enter after a<Enter>b inserts new block after b, not before b", () => {
      const onChange = vi.fn();
      let currentValue = "a";

      const { container, rerender } = render(
        <Editor value="a" onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      // 1) Press Enter at end of "a"
      setCursor(editable.querySelector("p")!.firstChild!, 1);
      fireEvent.keyDown(editable, { key: "Enter" });
      currentValue = onChange.mock.calls[0][0];
      onChange.mockClear();
      rerender(<Editor value={currentValue} onChange={onChange} />);

      // 2) Type 'b' into the blank_line
      const blankLine = editable.querySelector("[data-block='blank_line']")!;
      blankLine.innerHTML = "b";
      setCursor(blankLine.firstChild!, 1);
      fireEvent.input(editable);
      currentValue = onChange.mock.calls[0][0];
      onChange.mockClear();
      rerender(<Editor value={currentValue} onChange={onChange} />);

      // 3) Press Enter at end of "b"
      fireEvent.keyDown(editable, { key: "Enter" });
      const result = onChange.mock.calls[0][0];
      expect(result).toBe("a\n\nb\n\n");

      onChange.mockClear();
      rerender(<Editor value={result} onChange={onChange} />);
      assertBlankLinesClean(editable as HTMLElement);

      const allBlankLines = editable.querySelectorAll("[data-block='blank_line']");
      expect(allBlankLines.length).toBe(2);
      assertCursorAt(editable as HTMLElement, 3, 0);
    });
  });

  describe("Enter then type", () => {
    it("Enter between blocks, then type a character", () => {
      const onChange = vi.fn();
      const { container, rerender } = render(
        <Editor value={"Hello\n\nWorld"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const p = editable.querySelector("p")!;
      setCursor(p.firstChild!, 5);

      fireEvent.keyDown(editable, { key: "Enter" });
      expect(onChange).toHaveBeenCalledTimes(1);
      const afterEnter = onChange.mock.calls[0][0];
      expect(afterEnter).toBe("Hello\n\n\n\nWorld");

      onChange.mockClear();
      rerender(<Editor value={afterEnter} onChange={onChange} />);
      assertBlankLinesClean(editable as HTMLElement);

      const blankLines = editable.querySelectorAll("[data-block='blank_line']");
      const target = blankLines[1];
      target.innerHTML = "a";
      setCursor(target.firstChild!, 1);

      fireEvent.input(editable);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toBe("Hello\n\na\n\nWorld");
    });

    it("Enter at end of document, then type a character", () => {
      const onChange = vi.fn();
      const { container, rerender } = render(
        <Editor value="Hello" onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const p = editable.querySelector("p")!;
      setCursor(p.firstChild!, 5);

      fireEvent.keyDown(editable, { key: "Enter" });
      expect(onChange).toHaveBeenCalledTimes(1);
      const afterEnter = onChange.mock.calls[0][0];
      expect(afterEnter).toBe("Hello\n\n");

      onChange.mockClear();
      rerender(<Editor value={afterEnter} onChange={onChange} />);
      assertBlankLinesClean(editable as HTMLElement);

      const blankLine = editable.querySelector("[data-block='blank_line']")!;
      blankLine.innerHTML = "a";
      setCursor(blankLine.firstChild!, 1);

      fireEvent.input(editable);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toBe("Hello\n\na");
    });

    it("one Enter creates a blank line, then typing creates a new paragraph", () => {
      const onChange = vi.fn();
      const { container, rerender } = render(
        <Editor value="Hello" onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const p = editable.querySelector("p")!;
      setCursor(p.firstChild!, 5);

      fireEvent.keyDown(editable, { key: "Enter" });
      const afterFirst = onChange.mock.calls[0][0];
      expect(afterFirst).toBe("Hello\n\n");

      onChange.mockClear();
      rerender(<Editor value={afterFirst} onChange={onChange} />);

      const blankLine = editable.querySelector("[data-block='blank_line']");
      expect(blankLine).not.toBeNull();

      blankLine!.innerHTML = "a";
      setCursor(blankLine!.firstChild!, 1);

      fireEvent.input(editable);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toBe("Hello\n\na");
    });
  });

  it("sequential backspace from last list item through marker into previous item", () => {
    let currentValue = "- aaa\n- bbb";
    const onChange = vi.fn((v: string) => {
      currentValue = v;
    });

    const { container, rerender } = render(
      <Editor value={currentValue} onChange={onChange} />,
    );
    const editable = container.querySelector("[contenteditable]")!;

    function backspaceChar() {
      const sel = window.getSelection()!;
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      const offset = range.startOffset;

      if (node.nodeType === Node.TEXT_NODE && offset > 0) {
        const text = node.textContent!;
        node.textContent = text.slice(0, offset - 1) + text.slice(offset);
        setCursor(node, offset - 1);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (offset > 0) {
          const prev = el.childNodes[offset - 1];
          if (prev && prev.nodeType === Node.TEXT_NODE) {
            const text = prev.textContent!;
            prev.textContent = text.slice(0, -1);
            setCursor(prev, prev.textContent!.length);
          }
        }
      }
      fireEvent.input(editable);
    }

    function step() {
      onChange.mockClear();
      backspaceChar();
      if (onChange.mock.calls.length > 0) {
        currentValue = onChange.mock.calls[0][0];
        onChange.mockClear();
        rerender(<Editor value={currentValue} onChange={onChange} />);
      }
    }

    const lis = editable.querySelectorAll("[data-block='list_item']");
    const lastLi = lis[lis.length - 1];
    setCursor(lastLi.lastChild!, lastLi.lastChild!.textContent!.length);

    for (let i = 0; i < 5; i++) {
      step();
    }

    step();
    step();
  });

  it("extracts \\n for a non-placeholder <br> in a block during input", () => {
    const onChange = vi.fn();
    const { container } = render(<Editor value="Hello" onChange={onChange} />);
    const editable = container.querySelector("[contenteditable]")!;

    const p = editable.querySelector("p[data-block-index]")!;
    p.innerHTML = "before<br>after";

    const afterText = p.lastChild!;
    setCursor(afterText, 0);

    fireEvent.input(editable);
    expect(onChange).toHaveBeenCalledWith("before\nafter");
  });

  describe("typing bug regressions", () => {
    it("typing abcd into empty editor produces 'abcd' without duplication", () => {
      let currentValue = "";
      const onChange = vi.fn((v: string) => {
        currentValue = v;
      });

      const { container, rerender } = render(
        <Editor value={currentValue} onChange={onChange} />,
      );
      const editable = container.querySelector(
        "[contenteditable]",
      )! as HTMLElement;

      const placeholder = editable.querySelector(
        '[data-block="paragraph"]',
      ) as HTMLElement | null;
      if (placeholder) {
        setCursor(placeholder, 0);
      } else {
        setCursor(editable, 0);
      }

      const chars = ["a", "b", "c", "d"];
      for (let i = 0; i < chars.length; i++) {
        onChange.mockClear();
        typeCharAtCursor(editable, chars[i]);
        expect(onChange).toHaveBeenCalledTimes(1);
        currentValue = onChange.mock.calls[0][0];
        onChange.mockClear();
        rerender(<Editor value={currentValue} onChange={onChange} />);
        assertBlankLinesClean(editable);
        assertCursorAt(editable, 0, i + 1);
      }

      expect(currentValue).toBe("abcd");
    });

    it("typing 'hoge' after inserting blank line produces no extra text", () => {
      let currentValue = INITIAL_MARKDOWN;
      const onChange = vi.fn((v: string) => {
        currentValue = v;
      });

      const { container, rerender } = render(
        <Editor value={currentValue} onChange={onChange} />,
      );
      const editable = container.querySelector(
        "[contenteditable]",
      )! as HTMLElement;

      const paragraphs = editable.querySelectorAll("p");
      let targetP: HTMLElement | null = null;
      for (const p of paragraphs) {
        if (p.textContent?.includes("This is a markdown editor")) {
          targetP = p as HTMLElement;
          break;
        }
      }
      expect(targetP).not.toBeNull();
      const textNode = targetP!.firstChild!;
      setCursor(textNode, textNode.textContent!.length);

      onChange.mockClear();
      fireEvent.keyDown(editable, { key: "Enter" });
      currentValue = onChange.mock.calls[0][0];
      onChange.mockClear();
      rerender(<Editor value={currentValue} onChange={onChange} />);

      const sel1 = window.getSelection();
      if (sel1 && sel1.rangeCount > 0) {
        const r = sel1.getRangeAt(0);
        const cursorNode = r.startContainer;
        setCursor(
          cursorNode,
          cursorNode.nodeType === Node.TEXT_NODE
            ? cursorNode.textContent!.length
            : (cursorNode as HTMLElement).childNodes.length,
        );
      }

      onChange.mockClear();
      fireEvent.keyDown(editable, { key: "Enter" });
      currentValue = onChange.mock.calls[0][0];
      onChange.mockClear();
      rerender(<Editor value={currentValue} onChange={onChange} />);

      const chars = ["h", "o", "g", "e"];
      for (const char of chars) {
        onChange.mockClear();
        typeCharAtCursor(editable, char);
        expect(onChange).toHaveBeenCalledTimes(1);
        currentValue = onChange.mock.calls[0][0];
        onChange.mockClear();
        rerender(<Editor value={currentValue} onChange={onChange} />);
      }

      expect(currentValue).toContain("hoge");
      expect(currentValue).not.toContain("hog\n");
      expect(currentValue).not.toContain("ho\n");

      const idx = currentValue.indexOf("rendering.");
      const listIdx = currentValue.indexOf("- Item one");
      const between = currentValue.slice(idx + "rendering.".length, listIdx);
      expect(between.replace(/\n/g, "")).toBe("hoge");
    });

    it("typing at end of paragraph doesn't produce extra text", () => {
      let currentValue = "Hello\n\nWorld";
      const onChange = vi.fn((v: string) => {
        currentValue = v;
      });

      const { container, rerender } = render(
        <Editor value={currentValue} onChange={onChange} />,
      );
      const editable = container.querySelector(
        "[contenteditable]",
      )! as HTMLElement;

      const p = editable.querySelector("p")!;
      setCursor(p.firstChild!, 5);

      const chars = ["a", "b", "c"];
      for (const char of chars) {
        onChange.mockClear();
        typeCharAtCursor(editable, char);
        expect(onChange).toHaveBeenCalledTimes(1);
        currentValue = onChange.mock.calls[0][0];
        onChange.mockClear();
        rerender(<Editor value={currentValue} onChange={onChange} />);
      }

      expect(currentValue).toBe("Helloabc\n\nWorld");
    });
  });
});
