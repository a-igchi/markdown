import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Editor } from "./Editor.js";

function setCursor(node: Node, offset: number) {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  window.getSelection()!.removeAllRanges();
  window.getSelection()!.addRange(range);
}

describe("Editor component (CST)", () => {
  it("renders initial markdown as styled HTML", () => {
    const { container } = render(
      <Editor value="# Hello" onChange={() => {}} />,
    );
    const h1 = container.querySelector("h1");
    expect(h1).not.toBeNull();
    expect(h1!.textContent).toBe("# Hello");
  });

  it("renders the contentEditable container", () => {
    const { container } = render(
      <Editor value="text" onChange={() => {}} />,
    );
    const editable = container.querySelector("[contenteditable]");
    expect(editable).not.toBeNull();
  });

  it("applies custom className", () => {
    const { container } = render(
      <Editor value="text" onChange={() => {}} className="my-editor" />,
    );
    const editable = container.querySelector("[contenteditable]");
    expect(editable!.classList.contains("my-editor")).toBe(true);
  });

  it("renders paragraphs, lists, and headings", () => {
    const source = "# Title\n\nHello world\n\n- item1\n- item2";
    const { container } = render(
      <Editor value={source} onChange={() => {}} />,
    );

    expect(container.querySelector("h1")).not.toBeNull();
    expect(container.querySelector("p")).not.toBeNull();
    expect(container.querySelector("ul")).not.toBeNull();
    expect(container.querySelectorAll("[data-block='list_item']").length).toBe(2);
  });

  it("calls onChange on input events", () => {
    const onChange = vi.fn();
    const { container } = render(
      <Editor value="Hello" onChange={onChange} />,
    );
    const editable = container.querySelector("[contenteditable]")!;
    fireEvent.input(editable);
    expect(onChange).toHaveBeenCalled();
  });

  it("inserts soft break on Enter key", () => {
    const onChange = vi.fn();
    const { container } = render(
      <Editor value="Hello" onChange={onChange} />,
    );
    const editable = container.querySelector("[contenteditable]")!;

    const textNode = editable.querySelector("p")!.firstChild!;
    setCursor(textNode, 5);

    fireEvent.keyDown(editable, { key: "Enter" });

    // Single Enter inserts \n (soft break), not \n\n
    expect(onChange).toHaveBeenCalledWith("Hello\n");
  });

  it("updates rendering when value prop changes", () => {
    const { container, rerender } = render(
      <Editor value="# Heading" onChange={() => {}} />,
    );
    expect(container.querySelector("h1")).not.toBeNull();
    expect(container.querySelector("h2")).toBeNull();

    rerender(<Editor value="## Heading" onChange={() => {}} />);
    expect(container.querySelector("h2")).not.toBeNull();
  });

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

  describe("Backspace on blank line", () => {
    it("removes blank line between paragraphs", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"Hello\n\nWorld"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      // Place cursor on the blank_line div
      const blankLine = editable.querySelector("[data-block='blank_line']")!;
      setCursor(blankLine, 0);

      fireEvent.keyDown(editable, { key: "Backspace" });
      expect(onChange).toHaveBeenCalledWith("Hello\nWorld");
    });

    it("removes blank line at end of document", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"Hello\n\n"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const blankLine = editable.querySelector("[data-block='blank_line']")!;
      setCursor(blankLine, 0);

      fireEvent.keyDown(editable, { key: "Backspace" });
      expect(onChange).toHaveBeenCalledWith("Hello\n");
    });

    it("does not intercept backspace in normal paragraph", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value="Hello" onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const textNode = editable.querySelector("p")!.firstChild!;
      setCursor(textNode, 5);

      // Should NOT be prevented — browser handles it, then handleInput fires
      fireEvent.keyDown(editable, { key: "Backspace" });
      // onChange is not called via handleKeyDown for normal backspace
      // (browser default + handleInput would handle it)
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("Enter in list items", () => {
    it("Enter at end of unordered list item creates new item", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"- item1\n- item2"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      // Place cursor at end of "item2" inside second <li>
      const lis = editable.querySelectorAll("[data-block='list_item']");
      const lastLi = lis[lis.length - 1];
      const textNode = lastLi.lastChild!;
      setCursor(textNode, textNode.textContent!.length);

      fireEvent.keyDown(editable, { key: "Enter" });
      expect(onChange).toHaveBeenCalledWith("- item1\n- item2\n- ");
    });

    it("Enter at end of ordered list item creates next numbered item", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"1. First\n2. Second"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const lis = editable.querySelectorAll("[data-block='list_item']");
      const lastLi = lis[lis.length - 1];
      const textNode = lastLi.lastChild!;
      setCursor(textNode, textNode.textContent!.length);

      fireEvent.keyDown(editable, { key: "Enter" });
      expect(onChange).toHaveBeenCalledWith("1. First\n2. Second\n3. ");
    });

    it("Enter in middle of list item splits it", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"- item1"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      // Place cursor after "- ite" (offset 5 in "- item1")
      const li = editable.querySelector("[data-block='list_item']")!;
      const textNode = li.lastChild!;
      // textNode content is "- item1", cursor at position 5 means after "- ite"
      // But the text node inside <li> is the rendered text.
      // saveCursorAsOffset counts from the container, so we need to position
      // the cursor such that the total offset = 5
      // In "- item1", "- " is the marker (2 chars), "ite" = 3 chars → offset 5
      // The li text should contain "- item1", so offset 5 in the text node
      setCursor(textNode, 5);

      fireEvent.keyDown(editable, { key: "Enter" });
      expect(onChange).toHaveBeenCalledWith("- ite\n- m1");
    });

    it("Enter in non-list paragraph inserts plain newline", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value="Hello" onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const textNode = editable.querySelector("p")!.firstChild!;
      setCursor(textNode, 5);

      fireEvent.keyDown(editable, { key: "Enter" });
      expect(onChange).toHaveBeenCalledWith("Hello\n");
    });
  });

  describe("Tab/Shift+Tab for list indentation", () => {
    it("Tab indents a list item by 2 spaces", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"- item1\n- item2"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      // Place cursor at end of second list item
      const lis = editable.querySelectorAll("[data-block='list_item']");
      const lastLi = lis[lis.length - 1];
      const textNode = lastLi.lastChild!;
      setCursor(textNode, textNode.textContent!.length);

      fireEvent.keyDown(editable, { key: "Tab" });
      expect(onChange).toHaveBeenCalledWith("- item1\n  - item2");
    });

    it("Shift+Tab dedents an indented list item", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"- parent\n  - child"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      // Place cursor inside the nested list item
      const lis = editable.querySelectorAll("[data-block='list_item']");
      const lastLi = lis[lis.length - 1];
      const textNode = lastLi.lastChild!;
      setCursor(textNode, textNode.textContent!.length);

      fireEvent.keyDown(editable, { key: "Tab", shiftKey: true });
      expect(onChange).toHaveBeenCalledWith("- parent\n- child");
    });

    it("Tab on non-list does nothing", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value="Hello" onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const textNode = editable.querySelector("p")!.firstChild!;
      setCursor(textNode, 5);

      fireEvent.keyDown(editable, { key: "Tab" });
      expect(onChange).not.toHaveBeenCalled();
    });

    it("Shift+Tab on non-indented list item does nothing", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"- item"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const li = editable.querySelector("[data-block='list_item']")!;
      const textNode = li.lastChild!;
      setCursor(textNode, textNode.textContent!.length);

      fireEvent.keyDown(editable, { key: "Tab", shiftKey: true });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("Enter then type", () => {
    it("Enter between blocks, then type a character", () => {
      const onChange = vi.fn();
      const { container, rerender } = render(
        <Editor value={"Hello\n\nWorld"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      // Place cursor at end of "Hello"
      const p = editable.querySelector("p")!;
      setCursor(p.firstChild!, 5);

      // Press Enter → inserts \n between "Hello" and blank line
      fireEvent.keyDown(editable, { key: "Enter" });
      expect(onChange).toHaveBeenCalledTimes(1);
      const afterEnter = onChange.mock.calls[0][0];
      expect(afterEnter).toBe("Hello\n\n\nWorld");

      // Re-render with new value
      onChange.mockClear();
      rerender(<Editor value={afterEnter} onChange={onChange} />);

      // After re-render, cursor should be on the blank line.
      // Simulate typing 'a' into the blank_line div:
      const blankLines = editable.querySelectorAll(
        "[data-block='blank_line']",
      );
      // "Hello\n\n\nWorld" → p "Hello", blank_line, blank_line, p "World"
      // Cursor should be at first blank_line (index 0)
      const target = blankLines[0];
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

      // Place cursor at end of "Hello"
      const p = editable.querySelector("p")!;
      setCursor(p.firstChild!, 5);

      // Press Enter
      fireEvent.keyDown(editable, { key: "Enter" });
      expect(onChange).toHaveBeenCalledTimes(1);
      const afterEnter = onChange.mock.calls[0][0];
      expect(afterEnter).toBe("Hello\n");

      // Re-render with "Hello\n"
      // parse("Hello\n") → single paragraph, renders as <p>Hello</p>
      // extractText → "Hello" (trailing \n stripped)
      // Cursor offset 6 should be clamped to end of document
      onChange.mockClear();
      rerender(<Editor value={afterEnter} onChange={onChange} />);

      // Simulate typing 'a' at end of "Hello"
      // (cursor should have been restored to end of paragraph)
      const textNode = editable.querySelector("p")!.firstChild!;
      textNode.textContent = "Helloa";
      setCursor(textNode, 6);

      fireEvent.input(editable);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toBe("Helloa");
    });

    it("two Enters create a blank line, then typing creates a new paragraph", () => {
      const onChange = vi.fn();
      const { container, rerender } = render(
        <Editor value="Hello" onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      // Place cursor at end of "Hello"
      const p = editable.querySelector("p")!;
      setCursor(p.firstChild!, 5);

      // First Enter
      fireEvent.keyDown(editable, { key: "Enter" });
      const afterFirst = onChange.mock.calls[0][0];
      expect(afterFirst).toBe("Hello\n");

      // Re-render
      onChange.mockClear();
      rerender(<Editor value={afterFirst} onChange={onChange} />);

      // "Hello\n" renders as <p>Hello</p>, cursor at end
      // Second Enter at offset 5 (end of "Hello")
      const textNode2 = editable.querySelector("p")!.firstChild!;
      setCursor(textNode2, 5);

      fireEvent.keyDown(editable, { key: "Enter" });
      const afterSecond = onChange.mock.calls[0][0];
      expect(afterSecond).toBe("Hello\n\n");

      // Re-render with "Hello\n\n"
      // parse("Hello\n\n") → PARAGRAPH + BLANK_LINE
      onChange.mockClear();
      rerender(<Editor value={afterSecond} onChange={onChange} />);

      // Now there should be a blank_line div to type into
      const blankLine = editable.querySelector("[data-block='blank_line']");
      expect(blankLine).not.toBeNull();

      // Simulate typing 'a' into the blank line
      blankLine!.innerHTML = "a";
      setCursor(blankLine!.firstChild!, 1);

      fireEvent.input(editable);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toBe("Hello\n\na");
    });

    it("Enter mid-paragraph creates soft break, typing continues on new line", () => {
      const onChange = vi.fn();
      const { container, rerender } = render(
        <Editor value="HelloWorld" onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      // Place cursor between "Hello" and "World" (offset 5)
      const textNode = editable.querySelector("p")!.firstChild!;
      setCursor(textNode, 5);

      // Press Enter
      fireEvent.keyDown(editable, { key: "Enter" });
      const afterEnter = onChange.mock.calls[0][0];
      expect(afterEnter).toBe("Hello\nWorld");

      // Re-render: "Hello\nWorld" is a single paragraph with soft break
      onChange.mockClear();
      rerender(<Editor value={afterEnter} onChange={onChange} />);

      // The paragraph renders as <p>Hello\nWorld</p> (single text node)
      const pText = editable.querySelector("p")!.firstChild!;
      expect(pText.textContent).toBe("Hello\nWorld");

      // Simulate typing 'a' after "Hello\n" (at offset 6)
      pText.textContent = "Hello\naWorld";
      setCursor(pText, 7); // after the 'a'

      fireEvent.input(editable);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toBe("Hello\naWorld");
    });
  });
});
