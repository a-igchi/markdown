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
 * - Container blocks (ul, ol) recurse into children without separators.
 * - blockquote recurses with inter-block separators.
 * - Adjacent block-level siblings at the root level and inside blockquotes
 *   get a \n separator inserted between them.
 * - <br> elements are ignored when they are the sole child of a block
 *   (placeholder). Otherwise they produce \n.
 */
export function extractText(container: HTMLElement): string {
  const parts: string[] = [];
  walkChildren(container, parts, true);
  let text = parts.join("");
  text = text.replace(/\n$/, ""); // remove exactly one trailing newline
  return text;
}

function walkChildren(parent: HTMLElement, parts: string[], withSeparator: boolean): void {
  let prevWasBlock = false;
  for (const child of parent.childNodes) {
    if (
      withSeparator &&
      prevWasBlock &&
      child.nodeType === Node.ELEMENT_NODE &&
      isBlockLevel((child as HTMLElement).tagName.toLowerCase(), child as HTMLElement)
    ) {
      parts.push("\n");
    }
    extractNode(child, parts);
    if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = (child as HTMLElement).tagName.toLowerCase();
      prevWasBlock = isBlockLevel(tag, child as HTMLElement);
    } else {
      prevWasBlock = false;
    }
  }
}

function extractNode(node: Node, parts: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    // Replace browser-inserted U+00A0 (non-breaking space) with regular
    // space so the extracted markdown never contains literal &nbsp;.
    parts.push((node.textContent ?? "").replace(/\u00A0/g, " "));
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

  // Container blocks — recurse with or without inter-block separators
  if (tag === "blockquote") {
    walkChildren(el, parts, true);
    return;
  }
  if (tag === "ul" || tag === "ol") {
    walkChildren(el, parts, false);
    return;
  }

  // Leaf block elements — extract text content + trailing newline
  if (isLeafBlock(tag, el)) {
    for (const child of el.childNodes) {
      extractNode(child, parts);
    }
    if (!shouldSuppressTrailingNewline(tag, el)) {
      parts.push("\n");
    }
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

function isBlockLevel(tag: string, el: HTMLElement): boolean {
  // Plain divs (no data-block) are browser-generated blocks; they should NOT
  // get a separator inserted before them since they represent a single line
  // break, not a blank-line paragraph break.
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
 * Suppress the trailing \n for a leaf block in specific nesting scenarios
 * to avoid producing extra newlines in the extracted text:
 *
 * A <p> that is the last element child of the last <li>: the <li>'s own
 * trailing \n already provides the line break. Only suppress for the
 * terminal list item (no nextElementSibling on the <li>).
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

/**
 * A <br> is a placeholder (and should not contribute a \n) when:
 * - It is the sole child of a block-level element.
 */
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
