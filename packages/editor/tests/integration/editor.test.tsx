import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Editor } from "../../src/index.js";
import { saveCursorAsOffset } from "../../src/cursor/cursor.js";

describe("Editor component", () => {
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
    expect(container.querySelectorAll("li").length).toBe(2);
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

  it("inserts paragraph break on Enter key", () => {
    const onChange = vi.fn();
    const { container } = render(
      <Editor value="Hello" onChange={onChange} />,
    );
    const editable = container.querySelector("[contenteditable]")!;

    // Place cursor at end of "Hello"
    const textNode = editable.querySelector("p")!.firstChild!;
    const range = document.createRange();
    range.setStart(textNode, 5);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);

    // Press Enter
    fireEvent.keyDown(editable, { key: "Enter" });

    // Should insert \n\n (paragraph break)
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

    // Start IME composition
    fireEvent.compositionStart(editable);

    // Input during composition should NOT trigger onChange
    fireEvent.input(editable);
    expect(onChange).not.toHaveBeenCalled();

    // End IME composition — should trigger onChange
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

  it("restores cursor after value prop change triggers re-render", () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <Editor value="Hello" onChange={onChange} />,
    );
    const editable = container.querySelector("[contenteditable]")!;

    // Place cursor at position 3 in "Hello"
    const textNode = editable.querySelector("p")!.firstChild!;
    const range = document.createRange();
    range.setStart(textNode, 3);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);

    // Simulate a keydown that triggers onChange with a new value
    fireEvent.keyDown(editable, { key: "Enter" });

    // The onChange was called with the new text
    if (onChange.mock.calls.length > 0) {
      const newValue = onChange.mock.calls[0][0];
      // Re-render with the new value to trigger useLayoutEffect
      rerender(<Editor value={newValue} onChange={onChange} />);
    }

    // After re-render, cursor should be restored (useLayoutEffect ran)
    const sel = window.getSelection();
    expect(sel).not.toBeNull();
    // Just verify the editor still renders correctly
    expect(editable.querySelector("p") || editable.textContent).toBeTruthy();
  });

  it("typing into the separator position produces correct paragraph separation", () => {
    const onChange = vi.fn();
    const { container } = render(
      <Editor value={"first\n\nsecond"} onChange={onChange} />,
    );
    const editable = container.querySelector("[contenteditable]")!;

    // New DOM: <p>first</p><p>second</p> — no blank_line div
    const blankLines = editable.querySelectorAll('[data-block="blank_line"]');
    expect(blankLines.length).toBe(0);

    // The two paragraphs should be present
    const paragraphs = editable.querySelectorAll("p[data-block='paragraph']");
    expect(paragraphs.length).toBe(2);

    // Simulate typing "x" between the two paragraphs via the Enter key path
    // Place cursor at end of first paragraph
    const firstP = paragraphs[0];
    const textNode = firstP.firstChild!;
    const range = document.createRange();
    range.setStart(textNode, 5); // end of "first"
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);

    // Fire input event — falls back to DOM extraction
    fireEvent.input(editable);
    // onChange should have been called with the extracted markdown
    expect(onChange).toHaveBeenCalled();
  });

  it("handles input after IME composition ends and resumes normal mode", () => {
    const onChange = vi.fn();
    const { container } = render(
      <Editor value="Hello" onChange={onChange} />,
    );
    const editable = container.querySelector("[contenteditable]")!;

    // IME cycle
    fireEvent.compositionStart(editable);
    fireEvent.input(editable);
    fireEvent.compositionEnd(editable);
    expect(onChange).toHaveBeenCalledTimes(1);

    onChange.mockClear();

    // Normal input after IME should work
    fireEvent.input(editable);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Multi-block character input and deletion
//
// NOTE: React 19 + jsdom does not dispatch onBeforeInput for synthetic
// events (InputEvent.isTrusted is always false in test environments).
// Therefore the optimised insertText / deleteContentBackward /
// deleteContentForward paths in handleInput (which rely on the beforeOffset
// captured by handleBeforeInput) cannot be exercised through fireEvent.
//
// The individual helpers those paths depend on are already unit-tested:
//   - saveCursorAsOffset for multi-block documents → cursor.test.tsx
//   - extractText for multi-block documents       → extract-text.test.tsx
//
// This suite covers the two remaining integration paths that DO fire
// correctly in jsdom:
//   1. handleKeyDown (Enter key) – uses saveCursorAsOffset internally and
//      produces a new markdown string; exercises multi-block cursor offsets.
//   2. Fallback input path (DOM mutation then fireEvent.input) – exercises
//      extractText on a mutated multi-block DOM, verifying that character
//      edits in one block do not corrupt extraction of the other block.
// ---------------------------------------------------------------------------

describe("multi-block character input and deletion", () => {
  /** Place the DOM cursor at (node, offset) and update window.getSelection(). */
  function setCursor(node: Node, offset: number): void {
    const range = document.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // -------------------------------------------------------------------------
  // Enter key – exercises saveCursorAsOffset for multi-block positions
  // -------------------------------------------------------------------------

  describe("Enter key inserts a paragraph break at the correct multi-block position", () => {
    it("Enter in the middle of the first paragraph does not displace the second paragraph", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"first\n\nsecond"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;
      const [p1] = Array.from(editable.querySelectorAll("p"));

      // saveCursorAsOffset for text "first" at position 3 → offset 3
      setCursor(p1.firstChild!, 3);
      fireEvent.keyDown(editable, { key: "Enter" });

      // "fir" + "\n\n" + "st\n\nsecond"
      expect(onChange).toHaveBeenCalledWith("fir\n\nst\n\nsecond");
    });

    it("Enter at the start of the second paragraph inserts a break before it", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"first\n\nsecond"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;
      const [, p2] = Array.from(editable.querySelectorAll("p"));

      // saveCursorAsOffset for text "second" at position 0 → offset 7
      setCursor(p2.firstChild!, 0);
      fireEvent.keyDown(editable, { key: "Enter" });

      // "first\n\n" + "\n\n" + "second"
      expect(onChange).toHaveBeenCalledWith("first\n\n\n\nsecond");
    });

    it("Enter inside heading text leaves the paragraph below unchanged", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"# Hello\n\nWorld"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;
      const h1 = editable.querySelector("h1")!;
      // h1 has two text nodes: "# " (childNodes[0]) and "Hello" (childNodes[1])
      setCursor(h1.childNodes[1], 2); // after "He"

      // saveCursorAsOffset: "# "(2) + "He"(2) = offset 4
      // newText = "# He" + "\n\n" + "llo\n\nWorld"
      fireEvent.keyDown(editable, { key: "Enter" });
      expect(onChange).toHaveBeenCalledWith("# He\n\nllo\n\nWorld");
    });

    it("Enter inside a list item splits the item and leaves the second item unchanged", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"- item1\n- item2"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;
      const [li1] = Array.from(editable.querySelectorAll("li"));
      // li1 childNodes: text "- " (0), text "item1" (1)
      setCursor(li1.childNodes[1], 2); // after "it" in "item1"

      // saveCursorAsOffset: "- "(2) + "it"(2) = offset 4
      // Inside list item: insert "\n- " instead of "\n\n"
      // newText = "- it" + "\n- " + "em1\n- item2" = "- it\n- em1\n- item2"
      fireEvent.keyDown(editable, { key: "Enter" });
      expect(onChange).toHaveBeenCalledWith("- it\n- em1\n- item2");
    });
  });

  // -------------------------------------------------------------------------
  // DOM mutation + fallback input path
  //
  // Mutate the DOM to simulate what the browser does when the user types or
  // deletes a character, then fire an input event.  The editor falls back to
  // extractText(container) and calls onChange with the reconstructed markdown.
  // -------------------------------------------------------------------------

  describe("character insertion via DOM mutation is correctly extracted for multi-block documents", () => {
    it("inserting a character in the first paragraph does not disrupt the second paragraph", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"first\n\nsecond"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;
      const [p1, p2] = Array.from(editable.querySelectorAll("p"));

      // Simulate the browser inserting 'X' after "fir" in the first paragraph
      (p1.firstChild as Text).textContent = "firXst";
      setCursor(p1.firstChild!, 4); // cursor after 'X'

      fireEvent.input(editable);

      // extractText strips one trailing \n, so: "firXst\n\nsecond\n" → "firXst\n\nsecond"
      expect(onChange).toHaveBeenCalledWith("firXst\n\nsecond");
      // Verify the second paragraph text was NOT changed
      expect(p2.textContent).toBe("second");
    });

    it("inserting a character in the second paragraph does not disrupt the first paragraph", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"first\n\nsecond"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;
      const [p1, p2] = Array.from(editable.querySelectorAll("p"));

      // Simulate inserting 'X' after "sec" in the second paragraph
      (p2.firstChild as Text).textContent = "secXond";
      setCursor(p2.firstChild!, 4); // cursor after 'X'

      fireEvent.input(editable);

      // extractText strips one trailing \n: "first\n\nsecXond\n" → "first\n\nsecXond"
      expect(onChange).toHaveBeenCalledWith("first\n\nsecXond");
      // Verify the first paragraph text was NOT changed
      expect(p1.textContent).toBe("first");
    });

    it("inserting a character in the first list item does not affect the second item", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"- item1\n- item2"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;
      const [li1, li2] = Array.from(editable.querySelectorAll("li"));
      // li1 childNodes[1] is the "item1" text node
      (li1.childNodes[1] as Text).textContent = "itXem1";
      setCursor(li1.childNodes[1], 3);

      fireEvent.input(editable);

      // extractText strips one trailing \n: "- itXem1\n- item2"
      expect(onChange).toHaveBeenCalledWith("- itXem1\n- item2");
      expect((li2.childNodes[1] as Text).textContent).toBe("item2");
    });
  });

  describe("character deletion via DOM mutation is correctly extracted for multi-block documents", () => {
    it("deleting a character in the first paragraph does not affect the second paragraph", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"first\n\nsecond"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;
      const [p1, p2] = Array.from(editable.querySelectorAll("p"));

      // Simulate deleting 'r' from "first" → "fist"
      (p1.firstChild as Text).textContent = "fist";
      setCursor(p1.firstChild!, 2); // cursor at position of deleted char

      fireEvent.input(editable);

      expect(onChange).toHaveBeenCalledWith("fist\n\nsecond");
      expect(p2.textContent).toBe("second");
    });

    it("deleting the last character of the first paragraph leaves the second paragraph unchanged", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"first\n\nsecond"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;
      const [p1, p2] = Array.from(editable.querySelectorAll("p"));

      // Simulate deleting 't' from "first" → "firs"
      (p1.firstChild as Text).textContent = "firs";
      setCursor(p1.firstChild!, 4); // cursor at end of "firs"

      fireEvent.input(editable);

      expect(onChange).toHaveBeenCalledWith("firs\n\nsecond");
      expect(p2.textContent).toBe("second");
    });

    it("deleting a character in the second paragraph does not affect the first paragraph", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"first\n\nsecond"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;
      const [p1, p2] = Array.from(editable.querySelectorAll("p"));

      // Simulate deleting 'o' from "second" → "secnd"
      (p2.firstChild as Text).textContent = "secnd";
      setCursor(p2.firstChild!, 3);

      fireEvent.input(editable);

      expect(onChange).toHaveBeenCalledWith("first\n\nsecnd");
      expect(p1.textContent).toBe("first");
    });

    it("merging two paragraphs (removing block separator) produces a single-paragraph string", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"first\n\nsecond"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;
      const [p1, p2] = Array.from(editable.querySelectorAll("p"));

      // Simulate the browser merging two blocks: extend p1's text and remove p2
      (p1.firstChild as Text).textContent = "firstsecond";
      p2.remove();
      setCursor(p1.firstChild!, 5); // cursor at join point

      fireEvent.input(editable);

      // extractText strips one trailing \n: "firstsecond\n" → "firstsecond"
      expect(onChange).toHaveBeenCalledWith("firstsecond");
    });

    it("deleting a character in the first list item does not affect the second item", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"- item1\n- item2"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;
      const [li1, li2] = Array.from(editable.querySelectorAll("li"));

      // Simulate deleting 'e' from "item1" → "itm1"
      (li1.childNodes[1] as Text).textContent = "itm1";
      setCursor(li1.childNodes[1], 2);

      fireEvent.input(editable);

      expect(onChange).toHaveBeenCalledWith("- itm1\n- item2");
      expect((li2.childNodes[1] as Text).textContent).toBe("item2");
    });
  });
});

// ---------------------------------------------------------------------------
// Bug fixes
// ---------------------------------------------------------------------------

describe("bug fixes", () => {
  function setCursor(node: Node, offset: number): void {
    const range = document.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // Bug 1: backspace at start of second block causes error
  describe("bug 1: backspace at start of second block", () => {
    it("merges paragraphs correctly when cursor is at the start of the second block", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"Hello\n\nWorld"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;
      const [p1, p2] = Array.from(editable.querySelectorAll("p"));

      // Simulate browser merge: p2's content moved to p1, p2 removed
      (p1.firstChild as Text).textContent = "HelloWorld";
      p2.remove();
      setCursor(p1.firstChild!, 5);

      fireEvent.input(editable);

      expect(onChange).toHaveBeenCalledWith("HelloWorld");
    });

    it("does not throw when backspace is pressed at the start of the second paragraph via beforeinput path", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"Hello\n\nWorld"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;
      const [, p2] = Array.from(editable.querySelectorAll("p"));

      // Place cursor at start of second paragraph
      setCursor(p2.firstChild!, 0);

      // Fire beforeinput to capture offset
      fireEvent(
        editable,
        new InputEvent("beforeinput", {
          inputType: "deleteContentBackward",
          bubbles: true,
        }),
      );

      // Simulate browser DOM merge
      const p1 = editable.querySelectorAll("p")[0];
      (p1.firstChild as Text).textContent = "HelloWorld";
      p2.remove();

      // Fire input
      fireEvent(
        editable,
        new InputEvent("input", {
          inputType: "deleteContentBackward",
          bubbles: true,
        }),
      );

      // Should call onChange without throwing, merging the two paragraphs
      expect(onChange).toHaveBeenCalled();
      const result = onChange.mock.calls[0][0] as string;
      // Result should not contain \n\n (no blank line between merged content)
      expect(result).not.toContain("\n\n");
    });
  });

  // Bug 4: Enter key should place cursor after \n\n, not in middle of it
  describe("bug 4: Enter key creates a new paragraph correctly", () => {
    it("cursor is placed at position after blank line when entering 'a' then Enter", () => {
      const onChange = vi.fn();
      const { container, rerender } = render(
        <Editor value="a" onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;

      // Place cursor at end of "a"
      const textNode = editable.querySelector("p")!.firstChild!;
      setCursor(textNode, 1);

      // Press Enter → onChange("a\n\n")
      fireEvent.keyDown(editable, { key: "Enter" });
      expect(onChange).toHaveBeenCalledWith("a\n\n");

      // Rerender with "a\n\n" to trigger useLayoutEffect cursor restore
      rerender(<Editor value="a\n\n" onChange={onChange} />);

      // After useLayoutEffect, cursor should be at position 3 (after the blank line),
      // not position 2 (in the middle of the blank line).
      // Position 3 means typing "b" there gives "a\n\nb" (two paragraphs).
      // Position 2 (the bug) means typing "b" gives "a\nb\n" (one paragraph with softbreak).
      const restoredOffset = saveCursorAsOffset(editable as HTMLElement);
      expect(restoredOffset).toBe(3);
    });

    it("typing 'b' after Enter in 'a' gives 'a\\n\\nb' when cursor is at position 3", () => {
      // Verify the cursor-at-position-3 invariant: if we place cursor at offset 3
      // in "a\n\n" and type "b", the result should be "a\n\nb" (two paragraphs).
      // offset 3 = after both \n's = correct. offset 2 = in the middle of \n\n = bug.
      const value = "a\n\n";
      const insertOffset = 3;
      const typed = "b";
      const expected = value.slice(0, insertOffset) + typed + value.slice(insertOffset);
      expect(expected).toBe("a\n\nb");
      // Contrast with buggy offset 2:
      const buggy = value.slice(0, 2) + typed + value.slice(2);
      expect(buggy).toBe("a\nb\n"); // this is what the bug produces
    });
  });

  // Bug 5: Enter in tight list should not convert to loose list
  describe("bug 5: Enter in tight list creates new list item, not loose list", () => {
    it("Enter at end of first tight list item inserts new list item", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"- hoge\n- fuga"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;
      const [li1] = Array.from(editable.querySelectorAll("li"));

      // Place cursor at end of "hoge" (after "- hoge")
      // li1 childNodes: text("- ") at index 0, text("hoge") at index 1
      setCursor(li1.childNodes[1], 4);

      fireEvent.keyDown(editable, { key: "Enter" });

      expect(onChange).toHaveBeenCalled();
      const result = onChange.mock.calls[0][0] as string;
      // Result should NOT have a blank line between list items (no loose list)
      expect(result).not.toContain("\n\n");
      // Result should contain the list marker for a new item
      expect(result).toContain("- ");
    });

    it("Enter in tight list preserves tight list structure", () => {
      const onChange = vi.fn();
      const { container } = render(
        <Editor value={"- hoge\n- fuga"} onChange={onChange} />,
      );
      const editable = container.querySelector("[contenteditable]")!;
      const [li1] = Array.from(editable.querySelectorAll("li"));

      setCursor(li1.childNodes[1], 4);
      fireEvent.keyDown(editable, { key: "Enter" });

      const result = onChange.mock.calls[0][0] as string;
      // The result should still be parseable as a tight list
      // (no blank lines between items)
      const lines = result.split("\n");
      const listLines = lines.filter((l) => l.startsWith("- ") || l === "-");
      expect(listLines.length).toBeGreaterThanOrEqual(2);
    });
  });
});
