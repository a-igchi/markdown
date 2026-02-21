/**
 * Extract plain markdown text from a contentEditable DOM container.
 *
 * Walks the rendered DOM (produced by ast-to-react) and reconstructs
 * the original markdown source. The visible text content in the DOM
 * IS the markdown source since syntax markers are rendered visibly.
 *
 * Convention:
 * - Leaf block elements (h1-h6, p, li, pre, div[data-block]) contribute
 *   their text content followed by a trailing \n.
 * - Container blocks (ul, ol, blockquote) recurse into children.
 * - blank_line blocks contribute a single \n (producing an empty line
 *   when combined with the preceding block's trailing \n).
 * - If a blank_line block has user-typed content (from typing into the
 *   blank line after pressing Enter), it produces \n + content + \n.
 * - <br> elements are ignored when they are the sole child of a block
 *   (placeholder). Otherwise they produce \n.
 */
export function extractText(container: HTMLElement): string {
  const parts: string[] = [];
  for (const child of container.childNodes) {
    extractNode(child, parts);
  }
  let text = parts.join("");
  // Remove trailing newline (structural, from the last leaf block)
  if (text.endsWith("\n")) {
    text = text.slice(0, -1);
  }
  return text;
}

function extractNode(node: Node, parts: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    parts.push(node.textContent ?? "");
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  // <br> handling: skip if it's a placeholder (sole child of a block element)
  if (tag === "br") {
    if (isPlaceholderBr(el)) return;
    parts.push("\n");
    return;
  }

  // Blank line block
  if (el.dataset.block === "blank_line") {
    const textContent = el.textContent ?? "";
    if (textContent.length > 0) {
      // User has typed content into this blank line block.
      // Emit: blank line separator + content + leaf block end
      parts.push("\n");
      for (const child of el.childNodes) {
        extractNode(child, parts);
      }
      parts.push("\n");
    } else {
      parts.push("\n");
    }
    return;
  }

  // Container blocks (ul, ol, blockquote) — just recurse
  if (tag === "ul" || tag === "ol" || tag === "blockquote") {
    for (const child of el.childNodes) {
      extractNode(child, parts);
    }
    return;
  }

  // Leaf block elements — extract text content + trailing newline
  if (isLeafBlock(tag, el)) {
    for (const child of el.childNodes) {
      extractNode(child, parts);
    }
    parts.push("\n");
    return;
  }

  // Browser-generated block elements (e.g., <div> from Enter key)
  if (tag === "div") {
    for (const child of el.childNodes) {
      extractNode(child, parts);
    }
    parts.push("\n");
    return;
  }

  // Inline elements (em, strong, code, a, etc.) — just recurse
  for (const child of el.childNodes) {
    extractNode(child, parts);
  }
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

/** A <br> is a placeholder if it's the sole child of a block-level element. */
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
