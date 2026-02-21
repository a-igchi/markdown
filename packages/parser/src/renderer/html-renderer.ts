import type {
  Document,
  BlockNode,
  InlineNode,
  Heading,
  List,
  ListItem,
  CodeBlock,
  BlockQuote,
  Link,
} from "../ast/nodes.js";

export function renderToHtml(document: Document): string {
  return renderBlocks(document.children);
}

function renderBlocks(nodes: BlockNode[], tight = false): string {
  const parts: string[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case "heading":
        parts.push(renderHeading(node));
        break;
      case "paragraph":
        if (tight) {
          parts.push(renderInlines(node.children) + "\n");
        } else {
          parts.push(`<p>${renderInlines(node.children)}</p>\n`);
        }
        break;
      case "list":
        parts.push(renderList(node));
        break;
      case "list_item":
        parts.push(renderListItem(node, false));
        break;
      case "thematic_break":
        parts.push("<hr />\n");
        break;
      case "code_block":
        parts.push(renderCodeBlock(node));
        break;
      case "block_quote":
        parts.push(renderBlockQuote(node));
        break;
      case "blank_line":
        // Blank lines don't produce HTML output
        break;
    }
  }

  return parts.join("");
}

function renderHeading(node: Heading): string {
  const tag = `h${node.level}`;
  return `<${tag}>${renderInlines(node.children)}</${tag}>\n`;
}

function renderList(node: List): string {
  const tag = node.ordered ? "ol" : "ul";
  const startAttr = node.ordered && node.start !== 1 ? ` start="${node.start}"` : "";
  const items = node.children.map((item) => renderListItem(item, node.tight)).join("");
  return `<${tag}${startAttr}>\n${items}</${tag}>\n`;
}

function renderListItem(item: ListItem, tight: boolean): string {
  const content = renderBlocks(item.children, tight);
  // Trim trailing newline for tight lists
  const trimmed = tight ? content.trimEnd() : content;
  return `<li>${trimmed}</li>\n`;
}

function renderCodeBlock(node: CodeBlock): string {
  const escaped = escapeHtml(node.value);
  if (node.info) {
    const infoWord = escapeHtml(node.info.split(/\s+/)[0]);
    return `<pre><code class="language-${infoWord}">${escaped}</code></pre>\n`;
  }
  return `<pre><code>${escaped}</code></pre>\n`;
}

function renderBlockQuote(node: BlockQuote): string {
  const content = renderBlocks(node.children);
  return `<blockquote>\n${content}</blockquote>\n`;
}

function renderInlines(nodes: InlineNode[]): string {
  return nodes.map(renderInline).join("");
}

function renderInline(node: InlineNode): string {
  switch (node.type) {
    case "text":
      return escapeHtml(node.value);
    case "emphasis":
      return `<em>${renderInlines(node.children)}</em>`;
    case "strong":
      return `<strong>${renderInlines(node.children)}</strong>`;
    case "link":
      return renderLink(node);
    case "softbreak":
      return "\n";
    case "hardbreak":
      return "<br />\n";
    case "code_span":
      return `<code>${escapeHtml(node.value)}</code>`;
  }
}

function renderLink(node: Link): string {
  const href = escapeHtml(node.destination);
  const titleAttr = node.title ? ` title="${escapeHtml(node.title)}"` : "";
  return `<a href="${href}"${titleAttr}>${renderInlines(node.children)}</a>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
