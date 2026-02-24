/**
 * Cursor save/restore for contentEditable.
 *
 * Converts cursor position to/from a text offset (number of characters
 * of extracted markdown text before the cursor). This offset survives
 * React re-renders because it's independent of DOM node identity.
 *
 * IMPORTANT: The DOM walking logic here MUST match extract-text.ts exactly
 * so that offsets are consistent.
 */

// --- Shared DOM walker ---

interface WalkCallbacks {
  /** Called for each text node. Return true to stop walking. */
  onText(node: Text, text: string): boolean;
  /** Called after a leaf block element's children have been walked. Return true to stop. */
  onLeafBlockEnd(el: HTMLElement): boolean;
  /** Called for the virtual \n separator inserted between adjacent block siblings. Return true to stop. */
  onBlockSeparator(nextEl: HTMLElement): boolean;
}

function walkDom(container: HTMLElement, callbacks: WalkCallbacks): void {
  walkContainerChildren(container, callbacks, true);
}

function walkContainerChildren(
  parent: HTMLElement,
  callbacks: WalkCallbacks,
  withSep: boolean,
): boolean {
  let prevWasBlock = false;
  for (const child of parent.childNodes) {
    if (
      withSep &&
      prevWasBlock &&
      child.nodeType === Node.ELEMENT_NODE &&
      isBlockLevel((child as HTMLElement).tagName.toLowerCase(), child as HTMLElement)
    ) {
      if (callbacks.onBlockSeparator(child as HTMLElement)) return true;
    }
    if (walkNode(child, callbacks)) return true;
    if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = (child as HTMLElement).tagName.toLowerCase();
      prevWasBlock = isBlockLevel(tag, child as HTMLElement);
    } else {
      prevWasBlock = false;
    }
  }
  return false;
}

function walkNode(node: Node, callbacks: WalkCallbacks): boolean {
  if (node.nodeType === Node.TEXT_NODE) {
    return callbacks.onText(node as Text, node.textContent ?? "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return false;

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === "br") {
    if (isPlaceholderBr(el)) return false;
    // Non-placeholder <br> counts as \n in extractText but has no cursor
    // target — skip for cursor purposes
    return false;
  }

  // Container blocks — recurse with or without separators
  if (tag === "blockquote") {
    return walkContainerChildren(el, callbacks, true);
  }
  if (tag === "ul" || tag === "ol") {
    return walkContainerChildren(el, callbacks, false);
  }

  // Leaf blocks
  if (isLeafBlock(tag, el)) {
    for (const child of el.childNodes) {
      if (walkNode(child, callbacks)) return true;
    }
    if (shouldSuppressTrailingNewline(tag, el)) {
      return false;
    }
    return callbacks.onLeafBlockEnd(el);
  }

  // Browser-generated div (e.g., from Enter key)
  if (tag === "div") {
    for (const child of el.childNodes) {
      if (walkNode(child, callbacks)) return true;
    }
    return callbacks.onLeafBlockEnd(el);
  }

  // Inline elements — recurse
  for (const child of el.childNodes) {
    if (walkNode(child, callbacks)) return true;
  }
  return false;
}

function isLeafBlock(tag: string, el: HTMLElement): boolean {
  return (
    /^h[1-6]$/.test(tag) ||
    tag === "p" ||
    tag === "li" ||
    tag === "pre" ||
    (tag === "div" && el.dataset.block !== undefined)
  );
}

function isBlockLevel(tag: string, el: HTMLElement): boolean {
  if (tag === "div") return el.dataset.block !== undefined;
  return (
    /^h[1-6]$/.test(tag) ||
    tag === "p" ||
    tag === "li" ||
    tag === "pre" ||
    tag === "ul" ||
    tag === "ol" ||
    tag === "blockquote"
  );
}

/**
 * Suppress the trailing \n for a leaf block in specific nesting scenarios.
 * Must match the same logic in extract-text.ts.
 */
function shouldSuppressTrailingNewline(tag: string, el: HTMLElement): boolean {
  if (tag === "p") {
    const parent = el.parentElement;
    if (
      parent &&
      parent.tagName.toLowerCase() === "li" &&
      !el.nextElementSibling
    ) {
      return !parent.nextElementSibling; // suppress only for last li
    }
  }
  return false;
}

function isPlaceholderBr(br: HTMLElement): boolean {
  const parent = br.parentElement;
  if (!parent) return false;
  if (parent.childNodes.length !== 1) return false;
  const parentTag = parent.tagName.toLowerCase();
  return (
    parentTag === "div" ||
    parentTag === "p" ||
    parentTag === "li" ||
    /^h[1-6]$/.test(parentTag)
  );
}

// --- Save cursor as text offset ---

export function saveCursorAsOffset(container: HTMLElement): number | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer)) return null;

  const targetNode = range.startContainer;
  const targetOffset = range.startOffset;

  // If the target is an element node, resolve to the equivalent text position.
  // targetOffset is the child index where the cursor sits.
  let resolvedNode: Node = targetNode;
  let resolvedOffset: number = targetOffset;
  if (targetNode.nodeType === Node.ELEMENT_NODE) {
    const targetEl = targetNode as HTMLElement;
    const targetTag = targetEl.tagName.toLowerCase();
    const children = targetNode.childNodes;
    if (targetOffset < children.length) {
      // Before the child at targetOffset — position at start of that child
      resolvedNode = children[targetOffset];
      resolvedOffset = 0;
    } else if (children.length > 0 && !isLeafBlock(targetTag, targetEl)) {
      // After all children of a CONTAINER (not a leaf block).
      // For leaf blocks (li, p, h1, pre, div[data-block]), keep resolvedNode as
      // the element itself so that onLeafBlockEnd can match it correctly and
      // account for the element's own trailing \n.
      const last = children[children.length - 1];
      resolvedNode = last;
      resolvedOffset =
        last.nodeType === Node.TEXT_NODE
          ? (last.textContent ?? "").length
          : last.childNodes.length;
    }
    // else: leaf block at end → resolvedNode = targetEl, resolvedOffset = targetOffset
  }

  // If resolvedNode is a placeholder <br>, treat cursor as at the parent element
  if (
    resolvedNode.nodeType === Node.ELEMENT_NODE &&
    (resolvedNode as HTMLElement).tagName.toLowerCase() === "br" &&
    isPlaceholderBr(resolvedNode as HTMLElement)
  ) {
    resolvedNode = resolvedNode.parentElement ?? resolvedNode;
    resolvedOffset = 0;
  }

  // Drill into container blocks: the walker recurses into them without
  // ever comparing against the container element, so we must resolve to
  // a descendant that the walker will match (text node or leaf block).
  while (resolvedNode.nodeType === Node.ELEMENT_NODE) {
    const tag = (resolvedNode as HTMLElement).tagName.toLowerCase();
    if (tag !== "ul" && tag !== "ol" && tag !== "blockquote") break;
    const children = resolvedNode.childNodes;
    if (children.length === 0) break;
    if (resolvedOffset < children.length) {
      resolvedNode = children[resolvedOffset];
      resolvedOffset = 0;
    } else {
      const last = children[children.length - 1];
      resolvedNode = last;
      resolvedOffset =
        last.nodeType === Node.TEXT_NODE
          ? (last.textContent ?? "").length
          : last.childNodes.length;
    }
  }

  let offset = 0;
  let found = false;

  walkDom(container, {
    onText(node, text) {
      if (node === resolvedNode) {
        offset += resolvedOffset;
        found = true;
        return true;
      }
      offset += text.length;
      return false;
    },
    onLeafBlockEnd(el) {
      if (found) return true;
      if (el === resolvedNode) {
        found = true;
        return true;
      }
      offset += 1; // trailing \n
      return false;
    },
    onBlockSeparator(nextEl) {
      // Match as cursor target only when cursor is at the START of nextEl
      // (resolvedOffset=0 means "before any content of the next block").
      // If resolvedOffset>0, the cursor is inside/after nextEl and will be
      // matched by onText or onLeafBlockEnd instead.
      // Note: targetNode is not checked here because in the separator model
      // there are no real DOM nodes that represent separators.
      if (nextEl === resolvedNode && resolvedOffset === 0) {
        found = true;
        return true;
      }
      offset += 1;
      return false;
    },
  });

  return found ? offset : null;
}

// --- Restore cursor from text offset ---

export function restoreCursorFromOffset(
  container: HTMLElement,
  targetOffset: number,
): void {
  const pos = findDomPosition(container, targetOffset);
  if (!pos) return;

  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.setStart(pos.node, pos.offset);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

interface DomPosition {
  node: Node;
  offset: number;
}

function findDomPosition(
  container: HTMLElement,
  targetOffset: number,
): DomPosition | null {
  let remaining = targetOffset;
  let result: DomPosition | null = null;

  walkDom(container, {
    onText(node, text) {
      const len = text.length;
      if (remaining <= len) {
        result = { node, offset: remaining };
        return true;
      }
      remaining -= len;
      return false;
    },
    onLeafBlockEnd(el) {
      if (remaining < 1) {
        // Position at end of this block
        result = { node: el, offset: el.childNodes.length };
        return true;
      }
      remaining -= 1;
      return false;
    },
    onBlockSeparator(nextEl) {
      if (remaining < 1) {
        result = { node: nextEl, offset: 0 };
        return true;
      }
      remaining -= 1;
      return false;
    },
  });

  return result;
}
