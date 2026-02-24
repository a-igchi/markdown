import { SyntaxKind } from "./syntax-kind.js";
import {
  createToken,
  createNode,
  type SyntaxNode,
  type SyntaxElement,
} from "./nodes.js";
import {
  isBlankLine,
  matchATXHeading,
  matchThematicBreak,
  matchListItemStart,
} from "./scanner.js";

/**
 * Split input into lines preserving newline characters.
 * Each line's text does NOT include the trailing \n.
 * We track the newline separately to preserve it as a token.
 */
type Line = {
  text: string; // line content without trailing \n
  hasNewline: boolean;
  offset: number; // offset of this line in the source
};

const splitLines = (input: string): Line[] => {
  if (input === "") return [];

  const lines: Line[] = [];
  let offset = 0;
  let start = 0;

  for (let i = 0; i < input.length; i++) {
    if (input[i] === "\n") {
      lines.push({
        text: input.slice(start, i),
        hasNewline: true,
        offset,
      });
      offset = i + 1;
      start = i + 1;
    }
  }

  // Handle last line without trailing newline
  if (start < input.length) {
    lines.push({
      text: input.slice(start),
      hasNewline: false,
      offset,
    });
  }

  return lines;
};

export const parse = (input: string): SyntaxNode => {
  const lines = splitLines(input);
  const children: SyntaxElement[] = [];
  let pos = 0;
  let offset = 0;

  while (pos < lines.length) {
    const result = parseBlock(lines, pos, offset, 0);
    children.push(...result.elements);
    offset += result.elements.reduce((sum, el) => sum + el.length, 0);
    pos = result.nextPos;
  }

  return createNode(SyntaxKind.DOCUMENT, children, 0);
};

type ParseResult = {
  elements: SyntaxElement[];
  nextPos: number;
};

const parseBlock = (
  lines: Line[],
  pos: number,
  offset: number,
  indentLevel: number,
): ParseResult => {
  const line = lines[pos];
  const content = indentLevel > 0 ? stripIndent(line.text, indentLevel) : line.text;

  // Blank line
  if (isBlankLine(content)) {
    return parseBlankLine(lines, pos, offset, indentLevel);
  }

  // ATX Heading
  if (matchATXHeading(content)) {
    return parseATXHeading(lines, pos, offset, indentLevel);
  }

  // Thematic break (must check before list to handle "- - -" correctly)
  if (matchThematicBreak(content)) {
    return parseThematicBreak(lines, pos, offset, indentLevel);
  }

  // List
  if (matchListItemStart(content)) {
    return parseList(lines, pos, offset, indentLevel);
  }

  // Paragraph (default)
  return parseParagraph(lines, pos, offset, indentLevel);
};

const stripIndent = (text: string, indent: number): string => {
  let stripped = 0;
  let i = 0;
  while (i < text.length && stripped < indent) {
    if (text[i] === " ") {
      stripped++;
      i++;
    } else if (text[i] === "\t") {
      stripped += 4;
      i++;
    } else {
      break;
    }
  }
  return text.slice(i);
};

const parseBlankLine = (
  lines: Line[],
  pos: number,
  offset: number,
  _indentLevel: number,
): ParseResult => {
  const line = lines[pos];
  const fullText = line.text + (line.hasNewline ? "\n" : "");
  const token = createToken(SyntaxKind.BLANK_LINE, fullText, offset);
  return { elements: [token], nextPos: pos + 1 };
};

const parseATXHeading = (
  lines: Line[],
  pos: number,
  offset: number,
  indentLevel: number,
): ParseResult => {
  const line = lines[pos];
  const content = indentLevel > 0 ? stripIndent(line.text, indentLevel) : line.text;
  const match = matchATXHeading(content)!;
  const children: SyntaxElement[] = [];
  let tokenOffset = offset;

  // If we stripped indent for nesting, we still need the raw text
  if (indentLevel > 0) {
    const rawPrefix = line.text.slice(0, line.text.length - content.length);
    if (rawPrefix) {
      children.push(createToken(SyntaxKind.WHITESPACE, rawPrefix, tokenOffset));
      tokenOffset += rawPrefix.length;
    }
  }

  if (match.indent) {
    children.push(createToken(SyntaxKind.WHITESPACE, match.indent, tokenOffset));
    tokenOffset += match.indent.length;
  }

  children.push(createToken(SyntaxKind.HASH, match.hashes, tokenOffset));
  tokenOffset += match.hashes.length;

  if (match.spacesAfterHash) {
    children.push(createToken(SyntaxKind.WHITESPACE, match.spacesAfterHash, tokenOffset));
    tokenOffset += match.spacesAfterHash.length;
  }

  if (match.content) {
    children.push(createToken(SyntaxKind.TEXT, match.content, tokenOffset));
    tokenOffset += match.content.length;
  }

  if (match.closingHashes) {
    children.push(createToken(SyntaxKind.WHITESPACE, " ", tokenOffset));
    tokenOffset += 1;
    children.push(createToken(SyntaxKind.HASH, match.closingHashes, tokenOffset));
    tokenOffset += match.closingHashes.length;
  }

  if (match.trailingSpaces) {
    children.push(createToken(SyntaxKind.WHITESPACE, match.trailingSpaces, tokenOffset));
    tokenOffset += match.trailingSpaces.length;
  }

  if (line.hasNewline) {
    children.push(createToken(SyntaxKind.NEWLINE, "\n", tokenOffset));
  }

  return {
    elements: [createNode(SyntaxKind.ATX_HEADING, children, offset)],
    nextPos: pos + 1,
  };
};

const parseThematicBreak = (
  lines: Line[],
  pos: number,
  offset: number,
  indentLevel: number,
): ParseResult => {
  const line = lines[pos];
  const content = indentLevel > 0 ? stripIndent(line.text, indentLevel) : line.text;
  const match = matchThematicBreak(content)!;
  const children: SyntaxElement[] = [];
  let tokenOffset = offset;

  if (indentLevel > 0) {
    const rawPrefix = line.text.slice(0, line.text.length - content.length);
    if (rawPrefix) {
      children.push(createToken(SyntaxKind.WHITESPACE, rawPrefix, tokenOffset));
      tokenOffset += rawPrefix.length;
    }
  }

  if (match.indent) {
    children.push(createToken(SyntaxKind.WHITESPACE, match.indent, tokenOffset));
    tokenOffset += match.indent.length;
  }

  children.push(createToken(SyntaxKind.THEMATIC_BREAK_CHARS, match.chars, tokenOffset));
  tokenOffset += match.chars.length;

  if (line.hasNewline) {
    children.push(createToken(SyntaxKind.NEWLINE, "\n", tokenOffset));
  }

  return {
    elements: [createNode(SyntaxKind.THEMATIC_BREAK, children, offset)],
    nextPos: pos + 1,
  };
};

const parseParagraph = (
  lines: Line[],
  pos: number,
  offset: number,
  indentLevel: number,
): ParseResult => {
  const children: SyntaxElement[] = [];
  let tokenOffset = offset;
  let currentPos = pos;

  while (currentPos < lines.length) {
    const line = lines[currentPos];
    const rawText = line.text;
    const content = indentLevel > 0 ? stripIndent(rawText, indentLevel) : rawText;

    // Check if this line starts a new block that would interrupt the paragraph
    if (currentPos > pos) {
      if (isBlankLine(content)) break;
      if (matchATXHeading(content)) break;
      if (matchThematicBreak(content)) break;
      if (matchListItemStart(content)) break;
    }

    children.push(createToken(SyntaxKind.TEXT, rawText, tokenOffset));
    tokenOffset += rawText.length;

    if (line.hasNewline) {
      children.push(createToken(SyntaxKind.NEWLINE, "\n", tokenOffset));
      tokenOffset += 1;
    }

    currentPos++;
  }

  return {
    elements: [createNode(SyntaxKind.PARAGRAPH, children, offset)],
    nextPos: currentPos,
  };
};

const parseList = (
  lines: Line[],
  pos: number,
  offset: number,
  indentLevel: number,
): ParseResult => {
  const listChildren: SyntaxElement[] = [];
  let currentPos = pos;
  let currentOffset = offset;

  // Determine list type from first item
  const firstLine = lines[pos];
  const firstContent = indentLevel > 0 ? stripIndent(firstLine.text, indentLevel) : firstLine.text;
  const firstMatch = matchListItemStart(firstContent)!;
  const listType = firstMatch.type;

  while (currentPos < lines.length) {
    const line = lines[currentPos];
    const content = indentLevel > 0 ? stripIndent(line.text, indentLevel) : line.text;

    // Check if this is a list item start
    const itemMatch = matchListItemStart(content);
    if (!itemMatch || itemMatch.type !== listType) {
      // Could be a blank line between loose list items
      if (isBlankLine(content) && currentPos + 1 < lines.length) {
        const nextLine = lines[currentPos + 1];
        const nextContent = indentLevel > 0 ? stripIndent(nextLine.text, indentLevel) : nextLine.text;
        const nextMatch = matchListItemStart(nextContent);
        if (nextMatch && nextMatch.type === listType) {
          // Blank line between list items (loose list) - attach to previous item
          const lastItem = listChildren[listChildren.length - 1] as SyntaxNode;
          if (lastItem) {
            const blankText = line.text + (line.hasNewline ? "\n" : "");
            const blankToken = createToken(SyntaxKind.BLANK_LINE, blankText, currentOffset);
            const updatedChildren = [...lastItem.children, blankToken];
            listChildren[listChildren.length - 1] = createNode(
              SyntaxKind.LIST_ITEM,
              updatedChildren,
              lastItem.offset,
            );
            currentOffset += blankToken.length;
            currentPos++;
            continue;
          }
        }
      }
      break;
    }

    const result = parseListItem(lines, currentPos, currentOffset, indentLevel, itemMatch);
    listChildren.push(...result.elements);
    currentOffset += result.elements.reduce((sum, el) => sum + el.length, 0);
    currentPos = result.nextPos;
  }

  return {
    elements: [createNode(SyntaxKind.LIST, listChildren, offset)],
    nextPos: currentPos,
  };
};

const parseListItem = (
  lines: Line[],
  pos: number,
  offset: number,
  indentLevel: number,
  itemMatch: ReturnType<typeof matchListItemStart> & {},
): ParseResult => {
  const children: SyntaxElement[] = [];
  let tokenOffset = offset;
  const line = lines[pos];
  const rawText = line.text;
  const content = indentLevel > 0 ? stripIndent(rawText, indentLevel) : rawText;

  // Add indent whitespace if present (from the raw line, before stripping parent indent)
  if (indentLevel > 0) {
    const rawPrefix = rawText.slice(0, rawText.length - content.length);
    if (rawPrefix) {
      // The indent for nesting is part of the item
    }
  }

  // Marker token - use the raw text's marker portion
  const markerStart = rawText.length - content.length + itemMatch.indent.length;
  const markerText = rawText.slice(markerStart, markerStart + itemMatch.marker.length);

  // Include indent if present
  const fullPrefix = rawText.slice(0, markerStart + itemMatch.marker.length);

  if (itemMatch.indent || (indentLevel > 0 && rawText.length > content.length)) {
    const indentText = rawText.slice(0, markerStart);
    if (indentText) {
      children.push(createToken(SyntaxKind.WHITESPACE, indentText, tokenOffset));
      tokenOffset += indentText.length;
    }
  }

  children.push(createToken(SyntaxKind.MARKER, markerText, tokenOffset));
  tokenOffset += markerText.length;

  // Content after marker
  const contentAfterMarker = content.slice(itemMatch.indent.length + itemMatch.marker.length);

  // Calculate the indent level for continuation lines
  // It's the width of everything before the content starts
  const contentIndent = indentLevel + itemMatch.indent.length + itemMatch.marker.length;

  // Collect all lines that belong to this item's content
  const contentLines: Line[] = [];

  // First line's content
  if (contentAfterMarker || line.hasNewline) {
    contentLines.push({
      text: contentAfterMarker,
      hasNewline: line.hasNewline,
      offset: tokenOffset,
    });
  }

  // Continuation lines
  let currentPos = pos + 1;
  while (currentPos < lines.length) {
    const nextLine = lines[currentPos];
    const nextRaw = nextLine.text;
    const nextFromParent = indentLevel > 0 ? stripIndent(nextRaw, indentLevel) : nextRaw;

    // Blank line could be part of a loose list
    if (isBlankLine(nextFromParent)) {
      break;
    }

    // Check if this line is indented enough to be a continuation
    const stripped = stripIndent(nextFromParent, itemMatch.indent.length + itemMatch.marker.length);
    if (stripped.length === nextFromParent.length && nextFromParent.length > 0) {
      // Not indented enough - check if it's a new block at parent level
      break;
    }

    // Check if this is a new list item at the same or parent level
    const nextItemMatch = matchListItemStart(nextFromParent);
    if (nextItemMatch && nextItemMatch.indent.length <= itemMatch.indent.length) {
      break;
    }

    // This is a continuation line - use the raw text to preserve original content
    contentLines.push({
      text: nextRaw,
      hasNewline: nextLine.hasNewline,
      offset: nextLine.offset,
    });
    currentPos++;
  }

  // Parse content lines into child blocks
  if (contentLines.length > 0) {
    const contentElements = parseContentLines(contentLines, tokenOffset, contentIndent);
    children.push(...contentElements);
  }

  return {
    elements: [createNode(SyntaxKind.LIST_ITEM, children, offset)],
    nextPos: currentPos,
  };
};

const parseContentLines = (
  contentLines: Line[],
  offset: number,
  indentLevel: number,
): SyntaxElement[] => {
  const elements: SyntaxElement[] = [];
  let pos = 0;
  let currentOffset = offset;

  while (pos < contentLines.length) {
    const line = contentLines[pos];
    const content = indentLevel > 0 ? stripIndent(line.text, indentLevel) : line.text;

    if (isBlankLine(content)) {
      const fullText = line.text + (line.hasNewline ? "\n" : "");
      elements.push(createToken(SyntaxKind.BLANK_LINE, fullText, currentOffset));
      currentOffset += fullText.length;
      pos++;
      continue;
    }

    if (matchATXHeading(content)) {
      const result = parseATXHeading(contentLines, pos, currentOffset, indentLevel);
      elements.push(...result.elements);
      currentOffset += result.elements.reduce((sum, el) => sum + el.length, 0);
      pos = result.nextPos;
      continue;
    }

    if (matchThematicBreak(content)) {
      const result = parseThematicBreak(contentLines, pos, currentOffset, indentLevel);
      elements.push(...result.elements);
      currentOffset += result.elements.reduce((sum, el) => sum + el.length, 0);
      pos = result.nextPos;
      continue;
    }

    if (matchListItemStart(content)) {
      const result = parseList(contentLines, pos, currentOffset, indentLevel);
      elements.push(...result.elements);
      currentOffset += result.elements.reduce((sum, el) => sum + el.length, 0);
      pos = result.nextPos;
      continue;
    }

    // Default: paragraph
    const paraChildren: SyntaxElement[] = [];
    let paraOffset = currentOffset;

    while (pos < contentLines.length) {
      const pLine = contentLines[pos];
      const pContent = indentLevel > 0 ? stripIndent(pLine.text, indentLevel) : pLine.text;

      if (pos > 0 || paraChildren.length > 0) {
        if (isBlankLine(pContent)) break;
        if (matchATXHeading(pContent)) break;
        if (matchThematicBreak(pContent)) break;
        if (matchListItemStart(pContent)) break;
      }

      // Use raw text for round-trip fidelity
      paraChildren.push(createToken(SyntaxKind.TEXT, pLine.text, currentOffset));
      currentOffset += pLine.text.length;

      if (pLine.hasNewline) {
        paraChildren.push(createToken(SyntaxKind.NEWLINE, "\n", currentOffset));
        currentOffset += 1;
      }
      pos++;
    }

    if (paraChildren.length > 0) {
      elements.push(createNode(SyntaxKind.PARAGRAPH, paraChildren, paraOffset));
    }
  }

  return elements;
};
