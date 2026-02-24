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

/**
 * Simulate typing a character at the current cursor position.
 * After useLayoutEffect restores the cursor, we find the selection,
 * modify the DOM at that position (as the browser would), and fire input.
 */
function typeCharAtCursor(editable: HTMLElement, char: string): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    throw new Error("No selection to type at");
  }

  const range = sel.getRangeAt(0);
  let targetNode = range.startContainer;
  let targetOffset = range.startOffset;

  if (targetNode.nodeType === Node.ELEMENT_NODE) {
    const el = targetNode as HTMLElement;
    // Cursor is on an element (e.g., blank_line div or paragraph)
    if (el.dataset?.block === "blank_line" || el.childNodes.length === 0 ||
        (el.childNodes.length === 1 && el.firstChild?.nodeName === "BR")) {
      // Replace <br> placeholder with text
      el.textContent = char;
      setCursor(el.firstChild!, 1);
    } else if (targetOffset < el.childNodes.length) {
      const child = el.childNodes[targetOffset];
      if (child.nodeType === Node.TEXT_NODE) {
        // Insert at beginning of text node
        child.textContent = char + (child.textContent ?? "");
        setCursor(child, 1);
      } else {
        // Insert new text node before the child
        const textNode = document.createTextNode(char);
        el.insertBefore(textNode, child);
        setCursor(textNode, 1);
      }
    } else {
      // Cursor at end of element — append text
      const lastChild = el.lastChild;
      if (lastChild && lastChild.nodeType === Node.TEXT_NODE) {
        lastChild.textContent = (lastChild.textContent ?? "") + char;
        setCursor(lastChild, lastChild.textContent!.length);
      } else {
        const textNode = document.createTextNode(char);
        el.appendChild(textNode);
        setCursor(textNode, 1);
      }
    }
  } else if (targetNode.nodeType === Node.TEXT_NODE) {
    // Insert character into text node at offset
    const text = targetNode.textContent ?? "";
    targetNode.textContent =
      text.slice(0, targetOffset) + char + text.slice(targetOffset);
    setCursor(targetNode, targetOffset + 1);
  }

  fireEvent.input(editable);
}

describe("typing bug: extra text inserted after Enter + type", () => {
  it("typing 'hoge' after inserting blank line produces no extra text", () => {
    let currentValue = INITIAL_MARKDOWN;
    const onChange = vi.fn((v: string) => {
      currentValue = v;
    });

    const { container, rerender } = render(
      <Editor value={currentValue} onChange={onChange} />,
    );
    const editable = container.querySelector("[contenteditable]")! as HTMLElement;

    // Step 1: Place cursor at end of "This is a markdown editor with CST-based rendering."
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

    // Step 2: Press Enter twice to create a blank line
    onChange.mockClear();
    fireEvent.keyDown(editable, { key: "Enter" });
    currentValue = onChange.mock.calls[0][0];
    onChange.mockClear();
    rerender(<Editor value={currentValue} onChange={onChange} />);

    // Find cursor position after first Enter (should be at end of paragraph
    // since "Hello\n" renders as "Hello" with cursor clamped to end)
    const sel1 = window.getSelection();
    if (sel1 && sel1.rangeCount > 0) {
      const r = sel1.getRangeAt(0);
      const cursorNode = r.startContainer;
      setCursor(cursorNode, cursorNode.nodeType === Node.TEXT_NODE
        ? cursorNode.textContent!.length
        : (cursorNode as HTMLElement).childNodes.length);
    }

    onChange.mockClear();
    fireEvent.keyDown(editable, { key: "Enter" });
    currentValue = onChange.mock.calls[0][0];
    console.log("After 2 Enters:", JSON.stringify(currentValue.slice(0, 80)));
    onChange.mockClear();
    rerender(<Editor value={currentValue} onChange={onChange} />);

    // Step 3: Type 'h', 'o', 'g', 'e' — each time at cursor position restored by useLayoutEffect
    const chars = ["h", "o", "g", "e"];
    for (const char of chars) {
      onChange.mockClear();
      typeCharAtCursor(editable, char);
      expect(onChange).toHaveBeenCalledTimes(1);
      currentValue = onChange.mock.calls[0][0];
      console.log(`After typing '${char}':`, JSON.stringify(currentValue.slice(0, 100)));
      onChange.mockClear();
      rerender(<Editor value={currentValue} onChange={onChange} />);
    }

    // Final check
    console.log("Final value:", JSON.stringify(currentValue));
    expect(currentValue).toContain("hoge");
    expect(currentValue).not.toContain("hog\n");
    expect(currentValue).not.toContain("ho\n");

    const idx = currentValue.indexOf("rendering.");
    const listIdx = currentValue.indexOf("- Item one");
    const between = currentValue.slice(idx + "rendering.".length, listIdx);
    console.log("Between rendering. and list:", JSON.stringify(between));
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
    const editable = container.querySelector("[contenteditable]")! as HTMLElement;

    // Place cursor at end of "Hello"
    const p = editable.querySelector("p")!;
    setCursor(p.firstChild!, 5);

    // Type 'a', 'b', 'c' one at a time
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
