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
  /** Called for a blank_line element (empty). Return true to stop. */
  onBlankLine(el: HTMLElement): boolean;
}

function walkDom(container: HTMLElement, callbacks: WalkCallbacks): void {
  function walk(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      return callbacks.onText(node as Text, node.textContent ?? "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return false;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === "br") {
      if (isPlaceholderBr(el)) return false;
      // Non-placeholder <br> counts as \n — but for cursor purposes we skip
      // (the \n is counted by the text extraction but has no cursor target)
      return false;
    }

    if (el.dataset.block === "blank_line") {
      const hasContent = (el.textContent ?? "").length > 0;
      if (hasContent) {
        // Blank line with user-typed content:
        // Count the \n separator (same as extractText's "\n" push)
        if (callbacks.onBlankLine(el)) return true;
        // Walk into children (the typed text)
        for (const child of el.childNodes) {
          if (walk(child)) return true;
        }
        // Count the leaf block end \n
        return callbacks.onLeafBlockEnd(el);
      }
      return callbacks.onBlankLine(el);
    }

    // Container blocks — recurse
    if (tag === "ul" || tag === "ol" || tag === "blockquote" || (tag === "li" && !el.dataset.block)) {
      for (const child of el.childNodes) {
        if (walk(child)) return true;
      }
      return false;
    }

    // Leaf blocks
    if (isLeafBlock(tag, el)) {
      for (const child of el.childNodes) {
        if (walk(child)) return true;
      }
      return callbacks.onLeafBlockEnd(el);
    }

    // Browser-generated div (e.g., from Enter key)
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

  for (const child of container.childNodes) {
    if (walk(child)) break;
  }
}

function isLeafBlock(tag: string, el: HTMLElement): boolean {
  return (
    /^h[1-6]$/.test(tag) ||
    tag === "p" ||
    tag === "pre" ||
    (tag === "div" && el.dataset.block !== undefined) ||
    (tag === "li" && el.dataset.block !== undefined)
  );
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
    const children = targetNode.childNodes;
    if (targetOffset < children.length) {
      // Before the child at targetOffset — position at start of that child
      resolvedNode = children[targetOffset];
      resolvedOffset = 0;
    } else if (children.length > 0) {
      // After all children — position at end of last child
      const last = children[children.length - 1];
      resolvedNode = last;
      resolvedOffset =
        last.nodeType === Node.TEXT_NODE
          ? (last.textContent ?? "").length
          : last.childNodes.length;
    }
  }

  // If resolved to a placeholder <br>, the walk will skip it and fail to find
  // the cursor. Treat as cursor being at the boundary of the parent block.
  if (
    resolvedNode.nodeType === Node.ELEMENT_NODE &&
    (resolvedNode as HTMLElement).tagName.toLowerCase() === "br" &&
    isPlaceholderBr(resolvedNode as HTMLElement)
  ) {
    const brParent = resolvedNode.parentElement;
    if (brParent) {
      resolvedNode = brParent;
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
    onBlankLine(el) {
      if (el === resolvedNode || el === targetNode) {
        found = true;
        return true;
      }
      offset += 1; // \n for blank line
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
  // Track last valid position for clamping when offset exceeds document length
  let lastPos: DomPosition | null = null;

  walkDom(container, {
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
        // Position at end of this block
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

  // If offset exceeds document length, clamp to end
  return result ?? lastPos;
}
