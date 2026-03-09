import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Editor } from "../src/components/Editor.js";
import { setCursor, assertBlankLinesClean, assertCursorAt } from "./test-helpers.js";

describe("Enter behavior", () => {
  it("Enter on paragraph creates new block", () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <Editor value="Hello" onChange={onChange} />,
    );
    const editable = container.querySelector("[contenteditable]")!;

    const textNode = editable.querySelector("p")!.firstChild!;
    setCursor(textNode, 5);

    fireEvent.keyDown(editable, { key: "Enter" });
    const afterEnter = onChange.mock.calls[0][0];
    expect(afterEnter).toBe("Hello\n\n");
    onChange.mockClear();

    rerender(<Editor value={afterEnter} onChange={onChange} />);
    expect(editable.querySelector("p[data-block='paragraph']")).not.toBeNull();
    expect(editable.querySelector("[data-block='blank_line']")).not.toBeNull();
    assertBlankLinesClean(editable as HTMLElement);
    assertCursorAt(editable as HTMLElement, 1, 0);
  });

  it("Enter mid-paragraph splits into two paragraphs", () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <Editor value="HelloWorld" onChange={onChange} />,
    );
    const editable = container.querySelector("[contenteditable]")!;

    const textNode = editable.querySelector("p")!.firstChild!;
    setCursor(textNode, 5);

    fireEvent.keyDown(editable, { key: "Enter" });
    const afterEnter = onChange.mock.calls[0][0];
    expect(afterEnter).toBe("Hello\n\nWorld");

    onChange.mockClear();
    rerender(<Editor value={afterEnter} onChange={onChange} />);

    const paragraphs = editable.querySelectorAll("p[data-block='paragraph']");
    expect(paragraphs.length).toBe(2);
    expect(paragraphs[0].firstChild!.textContent).toBe("Hello");
    assertCursorAt(editable as HTMLElement, 2, 0);

    const worldText = paragraphs[1].firstChild!;
    worldText.textContent = "aWorld";
    setCursor(worldText, 1);

    fireEvent.input(editable);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toBe("Hello\n\naWorld");
  });

  describe("Enter in list items", () => {
    it("Enter at end of unordered list item creates new item", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"- item1\n- item2"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const lis = editable.querySelectorAll("[data-block='list_item']");
      const lastLi = lis[lis.length - 1];
      const textNode = lastLi.lastChild!;
      setCursor(textNode, textNode.textContent!.length);

      fireEvent.keyDown(editable, { key: "Enter" });
      expect(onChange).toHaveBeenCalledWith("- item1\n- item2\n- ");
    });

    it("Enter at end of last list item followed by content does not insert blank line", () => {
      const onChange = vi.fn();
      const { container, rerender } = render(
        <Editor
          value={"- item1\n- item2\n\nParagraph"}
          onChange={onChange}
        />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const lis = editable.querySelectorAll("[data-block='list_item']");
      const lastLi = lis[lis.length - 1];
      const textNode = lastLi.lastChild!;
      setCursor(textNode, textNode.textContent!.length);

      fireEvent.keyDown(editable, { key: "Enter" });
      const afterEnter = onChange.mock.calls[0][0];
      expect(afterEnter).toBe("- item1\n- item2\n- \n\nParagraph");

      onChange.mockClear();
      rerender(<Editor value={afterEnter} onChange={onChange} />);

      const looseItems = editable.querySelectorAll("li > p[data-block='list_item']");
      expect(looseItems.length).toBe(0);
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

      const li = editable.querySelector("[data-block='list_item']")!;
      const textNode = li.lastChild!;
      setCursor(textNode, 5);

      fireEvent.keyDown(editable, { key: "Enter" });
      expect(onChange).toHaveBeenCalledWith("- ite\n- m1");
    });

    it("Enter in non-list paragraph creates new block", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value="Hello" onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const textNode = editable.querySelector("p")!.firstChild!;
      setCursor(textNode, 5);

      fireEvent.keyDown(editable, { key: "Enter" });
      expect(onChange).toHaveBeenCalledWith("Hello\n\n");
    });
  });

  describe("Tab/Shift+Tab for list indentation", () => {
    it("Tab indents a list item by 2 spaces", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"- item1\n- item2"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

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

  describe("Enter at soft line break", () => {
    it("puts cursor on blank_line separator, not on right-hand content", () => {
      const onChange = vi.fn();
      const { container, rerender } = render(
        <Editor value={"hoge\npiyo"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const p = editable.querySelector("p[data-block='paragraph']")!;
      setCursor(p.firstChild!, 4);

      fireEvent.keyDown(editable, { key: "Enter" });
      expect(onChange).toHaveBeenCalledWith("hoge\n\npiyo");

      onChange.mockClear();
      rerender(<Editor value={"hoge\n\npiyo"} onChange={onChange} />);

      const blankLine = editable.querySelector("[data-block='blank_line']");
      expect(blankLine).not.toBeNull();
      assertCursorAt(editable as HTMLElement, 1, 0);
    });
  });

  describe("Enter in heading", () => {
    it("Enter at end of heading creates blank_line after it", () => {
      const onChange = vi.fn();
      const { container, rerender } = render(
        <Editor value="# Hello" onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const h1 = editable.querySelector("h1")!;
      setCursor(h1.firstChild!, 7); // end of "# Hello"

      fireEvent.keyDown(editable, { key: "Enter" });
      const afterEnter = onChange.mock.calls[0][0];
      expect(afterEnter).toBe("# Hello\n\n");
      onChange.mockClear();

      rerender(<Editor value={afterEnter} onChange={onChange} />);
      expect(editable.querySelector("h1")).not.toBeNull();
      expect(editable.querySelector("[data-block='blank_line']")).not.toBeNull();
      assertBlankLinesClean(editable as HTMLElement);
      assertCursorAt(editable as HTMLElement, 1, 0);
    });

    it("Enter in middle of heading splits into heading + paragraph", () => {
      const onChange = vi.fn();
      const { container, rerender } = render(
        <Editor value="# Hello" onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const h1 = editable.querySelector("h1")!;
      setCursor(h1.firstChild!, 5); // after "# Hel", before "lo"

      fireEvent.keyDown(editable, { key: "Enter" });
      const afterEnter = onChange.mock.calls[0][0];
      expect(afterEnter).toBe("# Hel\n\nlo");
      onChange.mockClear();

      rerender(<Editor value={afterEnter} onChange={onChange} />);
      expect(editable.querySelector("h1")).not.toBeNull();
      expect(editable.querySelector("[data-block='blank_line']")).not.toBeNull();
      expect(editable.querySelector("p[data-block='paragraph']")).not.toBeNull();
      assertBlankLinesClean(editable as HTMLElement);
      assertCursorAt(editable as HTMLElement, 2, 0);
    });
  });

  describe("Enter in fenced code block", () => {
    it("Enter inside code block inserts newline within block (no block split)", () => {
      // "```\ncode\n```" → fenced_code_block; Enter at end of "code" line
      // inserts \n inside the block → "```\ncode\n\n```"
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"```\ncode\n```"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const pre = editable.querySelector("pre")!;
      // pre.firstChild is the text node "```\ncode\n```"
      // offset 8 = after "```\ncode" (end of "code" line, before "\n```")
      setCursor(pre.firstChild!, 8);

      fireEvent.keyDown(editable, { key: "Enter" });
      expect(onChange).toHaveBeenCalledWith("```\ncode\n\n```");
    });
  });

  describe("Enter in block quote", () => {
    it("Enter at end of first bq_line inserts blank line between quote lines", () => {
      // "> hello\n> world" → single block_quote block
      // Enter at end of "> hello" line (offset 7) → newline inserted at offset 7
      // → "> hello\n\n> world" which parses as two separate block_quotes
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"> hello\n> world"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      const bqLines = editable.querySelectorAll("[data-block='bq_line']");
      const firstLine = bqLines[0];
      setCursor(firstLine.firstChild!, firstLine.firstChild!.textContent!.length);

      fireEvent.keyDown(editable, { key: "Enter" });
      expect(onChange).toHaveBeenCalledWith("> hello\n\n> world");
    });
  });

  it("Enter at end of last paragraph (flatOffsetToModelCursor lastBlock=blank_line)", () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <Editor value={"Hello\n\nWorld"} onChange={onChange} />,
    );
    const editable = container.querySelector("[contenteditable]")!;

    const worldPara = editable.querySelector("[data-block-index='2']") as HTMLElement;
    expect(worldPara).not.toBeNull();
    const worldText = worldPara.firstChild!;
    setCursor(worldText, 5);

    fireEvent.keyDown(editable, { key: "Enter" });
    const result = onChange.mock.calls[0][0];
    expect(result).toBe("Hello\n\nWorld\n\n");

    rerender(<Editor value={result} onChange={onChange} />);
    expect(editable.querySelector("[data-block='blank_line']")).not.toBeNull();
    assertCursorAt(editable as HTMLElement, 3, 0);
  });
});
