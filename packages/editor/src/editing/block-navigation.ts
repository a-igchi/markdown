const BLOCK_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "div", "pre"]);

/**
 * Check if the cursor is at the very start (offset 0) of a block element.
 * When true, browser backspace would merge/remove DOM blocks, which breaks
 * React reconciliation. We must intercept and handle it ourselves.
 */
export function isAtBlockStart(range: Range, container: HTMLElement): boolean {
  let node: Node | null = range.startContainer;
  let offset = range.startOffset;

  // Cursor must be at offset 0 within its node
  if (offset !== 0) return false;

  // If the cursor is directly on a block element at offset 0 (e.g., the browser
  // positions the cursor on <p> itself rather than inside a child text node),
  // check that block directly.
  if (
    node.nodeType === Node.ELEMENT_NODE &&
    node !== container &&
    BLOCK_TAGS.has((node as HTMLElement).tagName.toLowerCase())
  ) {
    return getPreviousBlock(node as HTMLElement, container) !== null;
  }

  // Walk up from the cursor node to find the enclosing block element.
  // At each level, the node must be the first child of its parent,
  // otherwise the cursor is not at the very start of the block.
  while (node && node !== container) {
    const parent: Node | null = node.parentNode;
    if (!parent) return false;

    // If this node is not the first child, cursor is not at block start
    if (parent.firstChild !== node) return false;

    // If the parent is a block element, we found it
    if (
      parent.nodeType === Node.ELEMENT_NODE &&
      BLOCK_TAGS.has((parent as HTMLElement).tagName.toLowerCase())
    ) {
      // Only intercept if this block is NOT the first block in the container.
      // (No previous block to merge with.)
      const block = parent as HTMLElement;
      return getPreviousBlock(block, container) !== null;
    }

    node = parent;
  }

  return false;
}

/** Find the previous leaf block sibling, walking up through containers. */
export function getPreviousBlock(
  block: HTMLElement,
  container: HTMLElement,
): HTMLElement | null {
  let node: HTMLElement | null = block;
  while (node && node !== container) {
    if (node.previousElementSibling) {
      return node.previousElementSibling as HTMLElement;
    }
    node = node.parentElement;
  }
  return null;
}
