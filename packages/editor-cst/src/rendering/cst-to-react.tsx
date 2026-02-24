import {
  type SyntaxNode,
  type SyntaxElement,
  SyntaxKind,
  isToken,
  isNode,
  getText,
} from "parser-cst";
import type { ReactNode } from "react";

/**
 * Convert a CST Document node into React elements for contentEditable rendering.
 *
 * Unlike the AST renderer, no `source` parameter is needed because
 * CST tokens preserve all original text.
 */
export function cstToReact(doc: SyntaxNode): ReactNode[] {
  const result: ReactNode[] = [];
  for (let i = 0; i < doc.children.length; i++) {
    const child = doc.children[i];
    result.push(renderElement(child, `b${i}`));
  }
  return result;
}

function renderElement(element: SyntaxElement, key: string): ReactNode {
  if (isToken(element)) {
    if (element.kind === SyntaxKind.BLANK_LINE) {
      return (
        <div key={key} data-block="blank_line">
          <br />
        </div>
      );
    }
    return null;
  }

  const node = element;
  switch (node.kind) {
    case SyntaxKind.ATX_HEADING:
      return renderHeading(node, key);
    case SyntaxKind.PARAGRAPH:
      return renderParagraph(node, key);
    case SyntaxKind.THEMATIC_BREAK:
      return renderThematicBreak(node, key);
    case SyntaxKind.LIST:
      return renderList(node, key);
    default:
      return null;
  }
}

/**
 * Get visible text for a block: all token text except trailing NEWLINE.
 */
function getVisibleText(node: SyntaxNode): string {
  const children = node.children;
  let parts: string[] = [];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (isToken(child)) {
      // Skip trailing newline (last token)
      if (child.kind === SyntaxKind.NEWLINE && i === children.length - 1) {
        continue;
      }
      parts.push(child.text);
    } else {
      parts.push(getText(child));
    }
  }
  return parts.join("");
}

function getHeadingLevel(node: SyntaxNode): 1 | 2 | 3 | 4 | 5 | 6 {
  for (const child of node.children) {
    if (isToken(child) && child.kind === SyntaxKind.HASH) {
      return Math.min(child.text.length, 6) as 1 | 2 | 3 | 4 | 5 | 6;
    }
  }
  return 1;
}

function renderHeading(node: SyntaxNode, key: string): ReactNode {
  const level = getHeadingLevel(node);
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  const text = getVisibleText(node);
  return (
    <Tag key={key} data-block="heading">
      {text}
    </Tag>
  );
}

function renderParagraph(node: SyntaxNode, key: string): ReactNode {
  const text = getVisibleText(node);
  return (
    <p key={key} data-block="paragraph">
      {text}
    </p>
  );
}

function renderThematicBreak(node: SyntaxNode, key: string): ReactNode {
  const text = getVisibleText(node);
  return (
    <div key={key} data-block="thematic_break">
      {text}
    </div>
  );
}

function isLooseList(node: SyntaxNode): boolean {
  for (const child of node.children) {
    if (isToken(child) && child.kind === SyntaxKind.BLANK_LINE) {
      return true;
    }
    if (isNode(child) && child.kind === SyntaxKind.LIST_ITEM) {
      for (const grandchild of child.children) {
        if (isToken(grandchild) && grandchild.kind === SyntaxKind.BLANK_LINE) {
          return true;
        }
      }
    }
  }
  return false;
}

function renderList(node: SyntaxNode, key: string): ReactNode {
  const isOrdered = isOrderedList(node);
  const loose = isLooseList(node);
  const children: ReactNode[] = [];
  let idx = 0;
  for (const child of node.children) {
    if (isNode(child) && child.kind === SyntaxKind.LIST_ITEM) {
      children.push(renderListItem(child, `${key}-${idx}`, loose));
      idx++;
    }
  }
  const Tag = isOrdered ? "ol" : "ul";
  return <Tag key={key}>{children}</Tag>;
}

function isOrderedList(node: SyntaxNode): boolean {
  for (const child of node.children) {
    if (isNode(child) && child.kind === SyntaxKind.LIST_ITEM) {
      for (const token of child.children) {
        if (isToken(token) && token.kind === SyntaxKind.MARKER) {
          return /^\d+[.)]/.test(token.text);
        }
      }
    }
  }
  return false;
}

function renderListItem(
  item: SyntaxNode,
  key: string,
  loose: boolean,
): ReactNode {
  // Scan for nested lists
  const hasNesting = item.children.some(
    (c) => isNode(c) && c.kind === SyntaxKind.LIST,
  );

  const parts: ReactNode[] = [];
  const textParts: string[] = [];
  let subIndex = 0;

  function flushText() {
    if (textParts.length === 0) return;
    const text = textParts.join("");
    textParts.length = 0;

    if (!loose && !hasNesting) {
      // Tight leaf: text goes directly into <li> (handled below)
      parts.push(text);
    } else if (loose) {
      parts.push(
        <p key={`${key}-text-${subIndex}`} data-block="list_item">
          {text}
        </p>,
      );
    } else {
      // tight + nested
      parts.push(
        <div key={`${key}-text-${subIndex}`} data-block="list_item">
          {text}
        </div>,
      );
    }
    subIndex++;
  }

  for (let i = 0; i < item.children.length; i++) {
    const child = item.children[i];

    if (isToken(child)) {
      if (child.kind === SyntaxKind.BLANK_LINE) {
        flushText();
        parts.push(
          <div key={`${key}-blank-${subIndex}`} data-block="blank_line">
            <br />
          </div>,
        );
        subIndex++;
        continue;
      }
      if (child.kind === SyntaxKind.NEWLINE) {
        continue;
      }
      textParts.push(child.text);
    } else if (isNode(child)) {
      if (child.kind === SyntaxKind.LIST) {
        flushText();
        parts.push(renderList(child, `${key}-nested-${subIndex}`));
        subIndex++;
      } else if (child.kind === SyntaxKind.PARAGRAPH) {
        const paraText = getVisibleText(child);
        textParts.push(paraText);
      } else {
        textParts.push(getText(child));
      }
    }
  }

  flushText();

  // Tight leaf: <li data-block="list_item">text</li>
  if (!loose && !hasNesting) {
    return (
      <li key={key} data-block="list_item">
        {parts}
      </li>
    );
  }

  // All other cases: <li>{parts}</li> where parts contain wrapped text
  return <li key={key}>{parts}</li>;
}
