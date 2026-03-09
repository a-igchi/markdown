import { expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { parse } from "parser-cst";
import { cstToReact } from "../src/rendering/cst-to-react.js";
import { extractText } from "../src/text-extraction/extract-text.js";
import { saveDomCursorAsModelCursor } from "../src/model/cursor-mapping.js";

export function roundTrip(source: string): string {
  const doc = parse(source);
  const elements = cstToReact(doc);
  const { container } = render(<div>{elements}</div>);
  return extractText(container.firstElementChild as HTMLElement);
}

export function renderIntoContainer(source: string): HTMLElement {
  const doc = parse(source);
  const elements = cstToReact(doc);
  const { container } = render(<div>{elements}</div>);
  return container.firstElementChild as HTMLElement;
}

export function setCursor(node: Node, offset: number): void {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  window.getSelection()!.removeAllRanges();
  window.getSelection()!.addRange(range);
}

/**
 * Simulate typing a character at the current cursor position.
 * After useLayoutEffect restores the cursor, we find the selection,
 * modify the DOM at that position (as the browser would), and fire input.
 */
export function typeCharAtCursor(editable: HTMLElement, char: string): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    throw new Error("No selection to type at");
  }

  const range = sel.getRangeAt(0);
  let targetNode = range.startContainer;
  let targetOffset = range.startOffset;

  if (targetNode.nodeType === Node.ELEMENT_NODE) {
    const el = targetNode as HTMLElement;
    if (
      el.dataset?.block === "blank_line" ||
      el.childNodes.length === 0 ||
      (el.childNodes.length === 1 && el.firstChild?.nodeName === "BR")
    ) {
      el.textContent = char;
      setCursor(el.firstChild!, 1);
    } else if (targetOffset < el.childNodes.length) {
      const child = el.childNodes[targetOffset];
      if (child.nodeType === Node.TEXT_NODE) {
        child.textContent = char + (child.textContent ?? "");
        setCursor(child, 1);
      } else {
        const textNode = document.createTextNode(char);
        el.insertBefore(textNode, child);
        setCursor(textNode, 1);
      }
    } else {
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
    const text = targetNode.textContent ?? "";
    targetNode.textContent =
      text.slice(0, targetOffset) + char + text.slice(targetOffset);
    setCursor(targetNode, targetOffset + 1);
  }

  fireEvent.input(editable);
}

export function assertCursorAt(
  editable: HTMLElement,
  blockIndex: number,
  offset: number,
): void {
  const cursor = saveDomCursorAsModelCursor(editable);
  expect(cursor).not.toBeNull();
  expect(cursor!.blockIndex).toBe(blockIndex);
  expect(cursor!.offset).toBe(offset);
}

export function assertBlankLinesClean(editable: HTMLElement): void {
  const blankLines = editable.querySelectorAll("[data-block='blank_line']");
  for (const bl of blankLines) {
    expect(bl.textContent).toBe("");
  }
}
