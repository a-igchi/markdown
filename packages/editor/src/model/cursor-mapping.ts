/**
 * Cursor mapping between DOM selection and ModelCursor.
 *
 * DOM elements rendered by modelToReact have `data-block-index` attributes.
 * The cursor is represented as { blockIndex, offset } where offset is the
 * character position within the block's visible content.
 *
 * Reuses the walkDom pattern from cursor.ts, scoped to a single block element.
 */

import { isPlaceholderBr, isLeafBlock, isContainerBlock } from "../dom-utils.js";
import type { ModelCursor } from "./types.js";

// --- Walk a single block element ---

interface WalkCallbacks {
  onText(node: Text, text: string): boolean;
  onLeafBlockEnd(el: HTMLElement): boolean;
  onBlankLine(el: HTMLElement): boolean;
}

/**
 * Walk a block element's DOM subtree, emitting text and structural events.
 * This is the same walkDom logic from cursor.ts but scoped to one block element.
 */
function walkBlock(root: HTMLElement, callbacks: WalkCallbacks): void {
  function walk(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      return callbacks.onText(node as Text, node.textContent ?? "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return false;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === "br") {
      if (isPlaceholderBr(el)) return false;
      return false;
    }

    if (el.dataset.block === "blank_line") {
      const hasContent = (el.textContent ?? "").length > 0;
      if (hasContent) {
        if (callbacks.onBlankLine(el)) return true;
        for (const child of el.childNodes) {
          if (walk(child)) return true;
        }
        return callbacks.onLeafBlockEnd(el);
      }
      return callbacks.onBlankLine(el);
    }

    if (isContainerBlock(tag, el)) {
      for (const child of el.childNodes) {
        if (walk(child)) return true;
      }
      return false;
    }

    if (isLeafBlock(tag, el)) {
      for (const child of el.childNodes) {
        if (walk(child)) return true;
      }
      return callbacks.onLeafBlockEnd(el);
    }

    if (tag === "div") {
      for (const child of el.childNodes) {
        if (walk(child)) return true;
      }
      return callbacks.onLeafBlockEnd(el);
    }

    // Inline elements — recurse
    for (const child of el.childNodes) {
      if (walk(child)) return true;
    }
    return false;
  }

  // Walk the block element's children
  for (const child of root.childNodes) {
    if (walk(child)) break;
  }
}

// --- Find block element by index ---

function findBlockElement(container: HTMLElement, blockIndex: number): HTMLElement | null {
  return container.querySelector(`[data-block-index="${blockIndex}"]`) as HTMLElement | null;
}

// --- Find block index from a DOM node ---

function findBlockIndex(node: Node, container: HTMLElement): number | null {
  let el: Node | null = node;
  while (el && el !== container) {
    if (el.nodeType === Node.ELEMENT_NODE) {
      const blockIndex = (el as HTMLElement).dataset?.blockIndex;
      if (blockIndex !== undefined) {
        return parseInt(blockIndex, 10);
      }
    }
    el = el.parentNode;
  }
  return null;
}

// --- Save DOM cursor as ModelCursor ---

export function saveDomCursorAsModelCursor(container: HTMLElement): ModelCursor | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer)) return null;

  const blockIndex = findBlockIndex(range.startContainer, container);
  if (blockIndex === null) return null;

  const blockEl = findBlockElement(container, blockIndex);
  if (!blockEl) return null;

  // Resolve element-node cursor to an adjacent node
  let targetNode: Node = range.startContainer;
  let targetOffset: number = range.startOffset;

  if (targetNode.nodeType === Node.ELEMENT_NODE) {
    const children = targetNode.childNodes;
    if (targetOffset < children.length) {
      targetNode = children[targetOffset];
      targetOffset = 0;
    } else if (children.length > 0) {
      const last = children[children.length - 1];
      targetNode = last;
      targetOffset =
        last.nodeType === Node.TEXT_NODE
          ? (last.textContent ?? "").length
          : last.childNodes.length;
    }
  }

  // If cursor is on placeholder <br>, treat as offset 0
  if (
    targetNode.nodeType === Node.ELEMENT_NODE &&
    (targetNode as HTMLElement).tagName.toLowerCase() === "br" &&
    isPlaceholderBr(targetNode as HTMLElement)
  ) {
    return { blockIndex, offset: 0 };
  }

  // Walk block element to compute character offset
  let offset = 0;
  let found = false;

  walkBlock(blockEl, {
    onText(node, text) {
      if (node === targetNode) {
        offset += targetOffset;
        found = true;
        return true;
      }
      offset += text.length;
      return false;
    },
    onLeafBlockEnd(el) {
      if (found) return true;
      if (el === targetNode) {
        found = true;
        return true;
      }
      offset += 1; // trailing \n
      return false;
    },
    onBlankLine(el) {
      if (el === targetNode || el === range.startContainer) {
        found = true;
        return true;
      }
      offset += 1;
      return false;
    },
  });

  return found ? { blockIndex, offset } : { blockIndex, offset: 0 };
}

// --- Restore ModelCursor to DOM selection ---

interface DomPosition {
  node: Node;
  offset: number;
}

export function restoreModelCursorToDom(
  container: HTMLElement,
  cursor: ModelCursor,
): void {
  const blockEl = findBlockElement(container, cursor.blockIndex);
  if (!blockEl) return;

  const pos = findDomPositionInBlock(blockEl, cursor.offset);
  if (!pos) return;

  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.setStart(pos.node, pos.offset);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function findDomPositionInBlock(
  blockEl: HTMLElement,
  targetOffset: number,
): DomPosition | null {
  let remaining = targetOffset;
  let result: DomPosition | null = null;
  let lastPos: DomPosition | null = null;

  walkBlock(blockEl, {
    onText(node, text) {
      const len = text.length;
      if (remaining <= len) {
        result = { node, offset: remaining };
        return true;
      }
      remaining -= len;
      lastPos = { node, offset: len };
      return false;
    },
    onLeafBlockEnd(el) {
      if (remaining < 1) {
        result = { node: el, offset: el.childNodes.length };
        return true;
      }
      remaining -= 1;
      lastPos = { node: el, offset: el.childNodes.length };
      return false;
    },
    onBlankLine(el) {
      if (remaining < 1) {
        result = { node: el, offset: 0 };
        return true;
      }
      remaining -= 1;
      lastPos = { node: el, offset: el.childNodes.length };
      return false;
    },
  });

  // For offset 0, position at start of block element
  if (result === null && targetOffset === 0) {
    if (blockEl.firstChild) {
      const first = blockEl.firstChild;
      if (first.nodeType === Node.TEXT_NODE) {
        return { node: first, offset: 0 };
      }
      return { node: blockEl, offset: 0 };
    }
    return { node: blockEl, offset: 0 };
  }

  return result ?? lastPos;
}
