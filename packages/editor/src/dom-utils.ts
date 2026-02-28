/**
 * Shared DOM utilities used by both cursor.ts and extract-text.ts.
 *
 * IMPORTANT: Any change here affects both cursor save/restore and text
 * extraction simultaneously, keeping them in sync by design.
 */

export function isLeafBlock(tag: string, el: HTMLElement): boolean {
  return (
    /^h[1-6]$/.test(tag) ||
    tag === "p" ||
    tag === "pre" ||
    (tag === "div" && el.dataset.block !== undefined) ||
    (tag === "li" && el.dataset.block !== undefined)
  );
}

/** A <br> is a placeholder if it's the sole child of a block-level element. */
export function isPlaceholderBr(br: HTMLElement): boolean {
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

/** Container blocks (ul, ol, blockquote, li without data-block) — just recurse. */
export function isContainerBlock(tag: string, el: HTMLElement): boolean {
  return (
    tag === "ul" ||
    tag === "ol" ||
    tag === "blockquote" ||
    (tag === "li" && !el.dataset.block)
  );
}
