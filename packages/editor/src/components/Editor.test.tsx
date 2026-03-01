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

  it("Enter on paragraph creates new block", () => {
    const onChange = vi.fn();
    const { container } = render(
      <Editor value="Hello" onChange={onChange} />,
    );
    const editable = container.querySelector("[contenteditable]")!;

    const textNode = editable.querySelector("p")!.firstChild!;
    setCursor(textNode, 5);

    fireEvent.keyDown(editable, { key: "Enter" });

    // Single Enter inserts \n\n to create a new block
    expect(onChange).toHaveBeenCalledWith("Hello\n\n");
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

    it("Enter at end of last list item followed by content does not insert blank line", () => {
      const onChange = vi.fn();
      const { container, rerender } = render(
        <Editor
          value={"- item1\n- item2\n\nParagraph"}
          onChange={onChange}
        />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      // Place cursor at end of "item2" inside second <li>
      const lis = editable.querySelectorAll("[data-block='list_item']");
      const lastLi = lis[lis.length - 1];
      const textNode = lastLi.lastChild!;
      setCursor(textNode, textNode.textContent!.length);

      fireEvent.keyDown(editable, { key: "Enter" });
      const afterEnter = onChange.mock.calls[0][0];
      expect(afterEnter).toBe("- item1\n- item2\n- \n\nParagraph");

      // Re-render and verify extractText round-trips correctly
      // (no extra blank line from the new empty list item)
      onChange.mockClear();
      rerender(<Editor value={afterEnter} onChange={onChange} />);

      // The list should remain tight (no loose rendering)
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

      // Press Enter → inserts \n\n between "Hello" and existing blank line
      fireEvent.keyDown(editable, { key: "Enter" });
      expect(onChange).toHaveBeenCalledTimes(1);
      const afterEnter = onChange.mock.calls[0][0];
      expect(afterEnter).toBe("Hello\n\n\n\nWorld");

      // Re-render with new value
      onChange.mockClear();
      rerender(<Editor value={afterEnter} onChange={onChange} />);

      // After re-render, cursor should be on the second blank line.
      // Simulate typing 'a' into that blank_line div:
      const blankLines = editable.querySelectorAll(
        "[data-block='blank_line']",
      );
      // "Hello\n\n\n\nWorld" → p "Hello", blank_line, blank_line, blank_line, p "World"
      // Cursor (offset 7) is at second blank_line (index 1)
      const target = blankLines[1];
      target.innerHTML = "a";
      setCursor(target.firstChild!, 1);

      fireEvent.input(editable);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toBe("Hello\n\n\na\n\nWorld");
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

      // Press Enter → inserts \n\n creating a blank line after "Hello"
      fireEvent.keyDown(editable, { key: "Enter" });
      expect(onChange).toHaveBeenCalledTimes(1);
      const afterEnter = onChange.mock.calls[0][0];
      expect(afterEnter).toBe("Hello\n\n");

      // Re-render with "Hello\n\n"
      // parse("Hello\n\n") → PARAGRAPH + BLANK_LINE, renders as <p>Hello</p><div blank_line><br/></div>
      // Cursor offset 7 clamps to blank_line
      onChange.mockClear();
      rerender(<Editor value={afterEnter} onChange={onChange} />);

      // Simulate typing 'a' into the blank_line (the new block after "Hello")
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

      // Place cursor at end of "Hello"
      const p = editable.querySelector("p")!;
      setCursor(p.firstChild!, 5);

      // One Enter creates \n\n → blank line immediately
      fireEvent.keyDown(editable, { key: "Enter" });
      const afterFirst = onChange.mock.calls[0][0];
      expect(afterFirst).toBe("Hello\n\n");

      // Re-render with "Hello\n\n"
      // parse("Hello\n\n") → PARAGRAPH + BLANK_LINE
      onChange.mockClear();
      rerender(<Editor value={afterFirst} onChange={onChange} />);

      // A blank_line div should exist immediately after one Enter
      const blankLine = editable.querySelector("[data-block='blank_line']");
      expect(blankLine).not.toBeNull();

      // Simulate typing 'a' into the blank line → creates a new paragraph
      blankLine!.innerHTML = "a";
      setCursor(blankLine!.firstChild!, 1);

      fireEvent.input(editable);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toBe("Hello\n\na");
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

      // Helper: simulate browser backspace (delete char before cursor)
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
          // Cursor on element node - find nearest text to delete from
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

      // Helper: step = backspace + re-render
      function step() {
        onChange.mockClear();
        backspaceChar();
        if (onChange.mock.calls.length > 0) {
          currentValue = onChange.mock.calls[0][0];
          onChange.mockClear();
          rerender(<Editor value={currentValue} onChange={onChange} />);
        }
      }

      // Place cursor at end of second list item ("- bbb")
      const lis = editable.querySelectorAll("[data-block='list_item']");
      const lastLi = lis[lis.length - 1];
      setCursor(lastLi.lastChild!, lastLi.lastChild!.textContent!.length);

      // Delete "bbb" + " " + "-" = 5 chars from second item
      for (let i = 0; i < 5; i++) {
        step();
      }

      // At this point, the second list item content is gone.
      // The DOM has changed to LIST + PARAGRAPH or just LIST.
      // Continue deleting into previous item.
      step();
      step();
    });

    it("backspace at start of list item merges with previous item", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"- aaa\n- bbb"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      // Place cursor at offset 0 of the second list item's text
      // (i.e., at the very start of "- bbb")
      const lis = editable.querySelectorAll("[data-block='list_item']");
      const lastLi = lis[lis.length - 1];
      setCursor(lastLi.firstChild!, 0);

      // Press Backspace — should be intercepted, not left to browser
      fireEvent.keyDown(editable, { key: "Backspace" });
      expect(onChange).toHaveBeenCalledTimes(1);
      // Should merge: remove the \n before "- bbb"
      expect(onChange.mock.calls[0][0]).toBe("- aaa- bbb");
    });

    it("backspace at start of list item after marker deletion merges correctly", () => {
      let currentValue = "- aaa\n- ";
      const onChange = vi.fn((v: string) => {
        currentValue = v;
      });

      const { container, rerender } = render(
        <Editor value={currentValue} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      // Place cursor at start of second list item
      const lis = editable.querySelectorAll("[data-block='list_item']");
      const lastLi = lis[lis.length - 1];
      setCursor(lastLi.firstChild!, 0);

      // Press Backspace — should be intercepted
      fireEvent.keyDown(editable, { key: "Backspace" });
      expect(onChange).toHaveBeenCalledTimes(1);
      // Should merge with previous item
      expect(onChange.mock.calls[0][0]).toBe("- aaa- ");
    });

    it("backspace at start of non-first block (cursor on element node) is intercepted", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"- aaa\n\nxyz"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      // DOM: <ul><li>- aaa</li></ul><div data-block="blank_line"><br></div><p>xyz</p>
      const p = editable.querySelector("p")!;

      // Set cursor at {p, 0} — element position before first child text node.
      // Real browsers set cursor this way when focusing a block or after block merge.
      setCursor(p, 0);

      // Backspace should be intercepted (p has a previous sibling block)
      fireEvent.keyDown(editable, { key: "Backspace" });
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("backspace at start of empty block with placeholder br is intercepted", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"- aaa\n- bbb\n-"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      // DOM: <ul><li>- aaa</li><li>- bbb</li></ul><p>-</p>
      const p = editable.querySelector("p[data-block='paragraph']")!;
      expect(p.textContent).toBe("-");

      // Simulate real browser: after deleting last char, block becomes <p><br></p>
      p.innerHTML = "<br>";
      setCursor(p, 0);

      // Backspace should be intercepted to prevent browser from removing <p>,
      // which would cause React reconciliation error
      fireEvent.keyDown(editable, { key: "Backspace" });
      expect(onChange).toHaveBeenCalledTimes(1);
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

      // After rerender: <p> removed, DOM has only <ul> with 2 <li>
      // Cursor should be restored near end of li2

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

    it("Enter mid-paragraph splits into two paragraphs", () => {
      const onChange = vi.fn();
      const { container, rerender } = render(
        <Editor value="HelloWorld" onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      // Place cursor between "Hello" and "World" (offset 5)
      const textNode = editable.querySelector("p")!.firstChild!;
      setCursor(textNode, 5);

      // Press Enter → splits into two paragraphs
      fireEvent.keyDown(editable, { key: "Enter" });
      const afterEnter = onChange.mock.calls[0][0];
      expect(afterEnter).toBe("Hello\n\nWorld");

      // Re-render: "Hello\n\nWorld" → two separate paragraphs
      onChange.mockClear();
      rerender(<Editor value={afterEnter} onChange={onChange} />);

      // Two <p> elements
      const paragraphs = editable.querySelectorAll("p[data-block='paragraph']");
      expect(paragraphs.length).toBe(2);
      expect(paragraphs[0].firstChild!.textContent).toBe("Hello");

      // Cursor is at start of second paragraph (offset 7 → "World" text node offset 0)
      // Simulate typing 'a' before "World"
      const worldText = paragraphs[1].firstChild!;
      worldText.textContent = "aWorld";
      setCursor(worldText, 1);

      fireEvent.input(editable);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toBe("Hello\n\naWorld");
    });
  });
});
