import type {
  Document,
  BlockNode,
  Heading,
  Paragraph,
  BlankLine,
  List,
  ListItem,
  ThematicBreak,
  CodeBlock,
  BlockQuote,
  SourceLocation,
  Position,
  LinkReference,
} from "../../ast/nodes.js";

interface LineInfo {
  raw: string;
  lineNumber: number;
  offset: number; // character offset in full input
}

export interface BlockParseResult {
  document: Document;
  references: Map<string, LinkReference>;
}

export function parseBlocks(input: string): BlockParseResult {
  const lines = splitLines(input);
  const references = new Map<string, LinkReference>();
  const nodes: BlockNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Try link reference definition
    const refResult = tryLinkReferenceDefinition(lines, i);
    if (refResult) {
      const key = normalizeLabel(refResult.ref.label);
      if (!references.has(key)) {
        references.set(key, refResult.ref);
      }
      i = refResult.nextIndex;
      continue;
    }

    // Blank line
    if (isBlankLine(line.raw)) {
      nodes.push(createBlankLine(line));
      i++;
      continue;
    }

    // ATX Heading
    const heading = tryATXHeading(line);
    if (heading) {
      nodes.push(heading);
      i++;
      continue;
    }

    // Thematic break (must be before list item, since --- could be either)
    const thematicBreak = tryThematicBreak(line);
    if (thematicBreak) {
      nodes.push(thematicBreak);
      i++;
      continue;
    }

    // Fenced code block
    const fenceInfo = tryFencedCodeBlockStart(line);
    if (fenceInfo) {
      const codeResult = parseFencedCodeBlock(lines, i, fenceInfo);
      nodes.push(codeResult.codeBlock);
      i = codeResult.nextIndex;
      continue;
    }

    // Blockquote
    if (isBlockQuoteStart(line.raw)) {
      const bqResult = parseBlockQuote(lines, i);
      nodes.push(bqResult.blockQuote);
      i = bqResult.nextIndex;
      continue;
    }

    // List item
    const listItemInfo = tryListItemStart(line);
    if (listItemInfo) {
      const listResult = parseList(lines, i);
      nodes.push(listResult.list);
      i = listResult.nextIndex;
      continue;
    }

    // Paragraph (default)
    const paraResult = parseParagraph(lines, i);
    nodes.push(paraResult.paragraph);
    i = paraResult.nextIndex;
  }

  const document: Document = {
    type: "document",
    children: nodes,
    sourceLocation: {
      start: { line: 1, column: 1, offset: 0 },
      end:
        lines.length > 0 ? endOfLine(lines[lines.length - 1]) : { line: 1, column: 1, offset: 0 },
    },
  };

  return { document, references };
}

function splitLines(input: string): LineInfo[] {
  const result: LineInfo[] = [];
  let offset = 0;
  let lineNumber = 1;

  // Split preserving line endings to accurately track offsets
  const rawLines = input.split(/\n/);

  for (let i = 0; i < rawLines.length; i++) {
    result.push({
      raw: rawLines[i],
      lineNumber,
      offset,
    });
    // +1 for the \n character (except for the last line if input doesn't end with \n)
    offset += rawLines[i].length + (i < rawLines.length - 1 ? 1 : 0);
    lineNumber++;
  }

  return result;
}

function isBlankLine(line: string): boolean {
  return /^[ \t]*$/.test(line);
}

function createBlankLine(line: LineInfo): BlankLine {
  return {
    type: "blank_line",
    sourceLocation: lineLocation(line),
  };
}

function lineLocation(line: LineInfo): SourceLocation {
  return {
    start: { line: line.lineNumber, column: 1, offset: line.offset },
    end: endOfLine(line),
  };
}

function endOfLine(line: LineInfo): Position {
  return {
    line: line.lineNumber,
    column: line.raw.length + 1,
    offset: line.offset + line.raw.length,
  };
}

// --- ATX Heading ---

function tryATXHeading(line: LineInfo): Heading | null {
  // 0-3 spaces of leading indentation, then 1-6 # characters, then space or end
  const match = line.raw.match(/^( {0,3})(#{1,6})([ \t]+|$)(.*?)(?:[ \t]+#+[ \t]*$|[ \t]*$)/);
  if (!match) return null;

  const _indent = match[1];
  const hashes = match[2];
  const spaceAfter = match[3];
  let content = match[4];

  // Must have space after # (or be empty heading)
  if (spaceAfter === "" && content !== "") return null;

  // The content is the raw inline content; trim trailing closing sequence already handled by regex
  content = content.trim();

  const level = hashes.length as 1 | 2 | 3 | 4 | 5 | 6;

  return {
    type: "heading",
    level,
    children: [], // inline parsing happens in Phase 2
    rawContent: content,
    sourceLocation: lineLocation(line),
  } as Heading & { rawContent: string };
}

// --- Paragraph ---

function parseParagraph(
  lines: LineInfo[],
  startIndex: number,
): { paragraph: Paragraph; nextIndex: number } {
  let endIndex = startIndex;
  const contentLines: string[] = [];

  while (endIndex < lines.length) {
    const line = lines[endIndex];

    if (isBlankLine(line.raw)) break;
    if (tryATXHeading(line)) break;
    if (tryThematicBreak(line)) break;
    if (tryFencedCodeBlockStart(line)) break;
    if (isBlockQuoteStart(line.raw)) break;
    if (tryListItemStart(line)) break;

    // Check if this is a link reference definition
    const refCheck = tryLinkReferenceDefinition(lines, endIndex);
    if (refCheck) break;

    contentLines.push(line.raw);
    endIndex++;
  }

  const rawContent = contentLines.join("\n");

  const paragraph: Paragraph = {
    type: "paragraph",
    children: [],
    rawContent,
    sourceLocation: {
      start: {
        line: lines[startIndex].lineNumber,
        column: 1,
        offset: lines[startIndex].offset,
      },
      end: endOfLine(lines[endIndex - 1]),
    },
  } as Paragraph & { rawContent: string };

  return { paragraph, nextIndex: endIndex };
}

// --- List ---

interface ListItemStart {
  markerType: "bullet" | "ordered";
  marker: string;
  bulletChar?: string;
  orderedStart?: number;
  orderedDelimiter?: string;
  contentIndent: number; // total columns to content start
  contentStart: number; // index in line where content begins
  indent: number; // leading spaces before marker
}

function tryListItemStart(line: LineInfo): ListItemStart | null {
  // Bullet list: 0-3 spaces, then [-+*], then 1-4 spaces
  const bulletMatch = line.raw.match(/^( {0,3})([-+*])( {1,4})(?=\S|$)/);
  if (bulletMatch) {
    const indent = bulletMatch[1].length;
    const marker = bulletMatch[2];
    const spacesAfter = bulletMatch[3].length;
    return {
      markerType: "bullet",
      marker: bulletMatch[2],
      bulletChar: marker,
      contentIndent: indent + 1 + spacesAfter,
      contentStart: indent + 1 + spacesAfter,
      indent,
    };
  }

  // Ordered list: 0-3 spaces, then 1-9 digits, then . or ), then 1-4 spaces
  const orderedMatch = line.raw.match(/^( {0,3})(\d{1,9})([.)])( {1,4})(?=\S|$)/);
  if (orderedMatch) {
    const indent = orderedMatch[1].length;
    const digits = orderedMatch[2];
    const delimiter = orderedMatch[3];
    const spacesAfter = orderedMatch[4].length;
    return {
      markerType: "ordered",
      marker: digits + delimiter,
      orderedStart: parseInt(digits, 10),
      orderedDelimiter: delimiter,
      contentIndent: indent + digits.length + 1 + spacesAfter,
      contentStart: indent + digits.length + 1 + spacesAfter,
      indent,
    };
  }

  // Empty list items: bullet or ordered marker followed by nothing
  const emptyBullet = line.raw.match(/^( {0,3})([-+*])[ \t]*$/);
  if (emptyBullet) {
    const indent = emptyBullet[1].length;
    return {
      markerType: "bullet",
      marker: emptyBullet[2],
      bulletChar: emptyBullet[2],
      contentIndent: indent + 2,
      contentStart: line.raw.length,
      indent,
    };
  }

  const emptyOrdered = line.raw.match(/^( {0,3})(\d{1,9})([.)])[ \t]*$/);
  if (emptyOrdered) {
    const indent = emptyOrdered[1].length;
    const digits = emptyOrdered[2];
    const delimiter = emptyOrdered[3];
    return {
      markerType: "ordered",
      marker: digits + delimiter,
      orderedStart: parseInt(digits, 10),
      orderedDelimiter: delimiter,
      contentIndent: indent + digits.length + 2,
      contentStart: line.raw.length,
      indent,
    };
  }

  return null;
}

function parseList(lines: LineInfo[], startIndex: number): { list: List; nextIndex: number } {
  const firstItemInfo = tryListItemStart(lines[startIndex])!;
  const items: ListItem[] = [];
  let i = startIndex;
  let hasBlankLineBetweenItems = false;

  while (i < lines.length) {
    const itemInfo = tryListItemStart(lines[i]);
    if (!itemInfo) break;

    // Must be same list type
    if (itemInfo.markerType !== firstItemInfo.markerType) break;
    if (itemInfo.markerType === "bullet" && itemInfo.bulletChar !== firstItemInfo.bulletChar) break;
    if (
      itemInfo.markerType === "ordered" &&
      itemInfo.orderedDelimiter !== firstItemInfo.orderedDelimiter
    )
      break;

    const itemResult = parseListItem(lines, i, itemInfo);
    items.push(itemResult.item);
    i = itemResult.nextIndex;

    // Check for blank lines between items
    if (i < lines.length && isBlankLine(lines[i].raw)) {
      // Look ahead - is there another item after blank lines?
      let j = i;
      while (j < lines.length && isBlankLine(lines[j].raw)) j++;
      if (j < lines.length) {
        const nextItemInfo = tryListItemStart(lines[j]);
        if (
          nextItemInfo &&
          nextItemInfo.markerType === firstItemInfo.markerType &&
          (nextItemInfo.markerType === "bullet"
            ? nextItemInfo.bulletChar === firstItemInfo.bulletChar
            : nextItemInfo.orderedDelimiter === firstItemInfo.orderedDelimiter)
        ) {
          hasBlankLineBetweenItems = true;
          i = j; // skip blank lines, continue to next item
          continue;
        }
      }
      // blank line but no next item of same type => list ends
      break;
    }
  }

  // Determine tight/loose: loose if there are blank lines between items
  // or if any item contains blank lines internally
  let loose = hasBlankLineBetweenItems;
  if (!loose) {
    for (const item of items) {
      if (itemContainsBlankLine(item)) {
        loose = true;
        break;
      }
    }
  }

  const list: List = {
    type: "list",
    ordered: firstItemInfo.markerType === "ordered",
    start: firstItemInfo.orderedStart ?? 1,
    tight: !loose,
    children: items,
    sourceLocation: {
      start: {
        line: lines[startIndex].lineNumber,
        column: 1,
        offset: lines[startIndex].offset,
      },
      end:
        items.length > 0
          ? items[items.length - 1].sourceLocation.end
          : { line: lines[startIndex].lineNumber, column: 1, offset: lines[startIndex].offset },
    },
  };

  return { list, nextIndex: i };
}

function itemContainsBlankLine(item: ListItem): boolean {
  for (const child of item.children) {
    if (child.type === "blank_line") return true;
  }
  return false;
}

function parseListItem(
  lines: LineInfo[],
  startIndex: number,
  itemInfo: ListItemStart,
): { item: ListItem; nextIndex: number } {
  const contentLines: string[] = [];
  const startLine = lines[startIndex];

  // First line content
  const firstLineContent = startLine.raw.slice(itemInfo.contentStart);
  contentLines.push(firstLineContent);

  let i = startIndex + 1;

  // Continuation lines
  while (i < lines.length) {
    const line = lines[i];

    // Blank line might be part of the item
    if (isBlankLine(line.raw)) {
      // Look ahead: if next non-blank line is indented enough, blank line is part of item
      let j = i + 1;
      while (j < lines.length && isBlankLine(lines[j].raw)) j++;

      if (j < lines.length) {
        const nextLine = lines[j];
        // Check if next non-blank line is indented enough to be a continuation
        const nextIndent = nextLine.raw.match(/^( *)/)?.[1].length ?? 0;
        const nextItemInfo = tryListItemStart(nextLine);
        const isNestedContent = nextIndent >= itemInfo.contentIndent && !nextItemInfo;
        const isNestedList = nextItemInfo && nextItemInfo.indent >= itemInfo.contentIndent;
        if (isNestedContent || isNestedList) {
          // Blank line is internal to this item
          contentLines.push("");
          i++;
          continue;
        }
      }
      break;
    }

    // Check if this line is indented enough to be nested content
    const lineIndent = line.raw.match(/^( *)/)?.[1].length ?? 0;

    // New list item - check if it's nested or a sibling
    const newItemInfo = tryListItemStart(line);
    if (newItemInfo) {
      // If the marker starts at or beyond our content indent, it's nested
      if (newItemInfo.indent >= itemInfo.contentIndent) {
        contentLines.push(line.raw.slice(itemInfo.contentIndent));
        i++;
        continue;
      }
      // Otherwise it's a sibling item, end this item
      break;
    }

    // Check indentation for continuation
    if (lineIndent >= itemInfo.contentIndent) {
      contentLines.push(line.raw.slice(itemInfo.contentIndent));
      i++;
    } else {
      // Lazy continuation for paragraphs
      if (!isBlankLine(contentLines[contentLines.length - 1] ?? "")) {
        contentLines.push(line.raw.trimStart());
        i++;
      } else {
        break;
      }
    }
  }

  // Parse the content lines as sub-blocks
  const subContent = contentLines.join("\n");
  const subResult = parseBlocks(subContent);
  const subChildren = subResult.document.children;

  const item: ListItem = {
    type: "list_item",
    marker: itemInfo.marker,
    children: subChildren,
    sourceLocation: {
      start: {
        line: startLine.lineNumber,
        column: 1,
        offset: startLine.offset,
      },
      end: i > startIndex ? endOfLine(lines[i - 1]) : endOfLine(startLine),
    },
  };

  return { item, nextIndex: i };
}

// --- Thematic Break ---

function tryThematicBreak(line: LineInfo): ThematicBreak | null {
  // 0-3 spaces of indentation, then three or more matching -, _, or * characters,
  // each optionally followed by spaces or tabs
  const match = line.raw.match(/^ {0,3}([-_*])[ \t]*(?:\1[ \t]*){2,}$/);
  if (!match) return null;

  return {
    type: "thematic_break",
    sourceLocation: lineLocation(line),
  };
}

// --- Fenced Code Block ---

interface FenceInfo {
  indent: number;
  fenceChar: string;
  fenceLength: number;
  infoString: string;
}

function tryFencedCodeBlockStart(line: LineInfo): FenceInfo | null {
  // 0-3 spaces, then 3+ backticks or tildes
  const match = line.raw.match(/^( {0,3})((`{3,})(.*)|~{3,}(.*)?)$/);
  if (!match) return null;

  const indent = match[1].length;

  if (match[3]) {
    // Backtick fence
    const fenceChar = "`";
    const fenceLength = match[3].length;
    const infoString = (match[4] ?? "").trim();
    // Info string for backtick fences must not contain backticks
    if (infoString.includes("`")) return null;
    return { indent, fenceChar, fenceLength, infoString };
  }

  // Tilde fence
  const tildeMatch = line.raw.match(/^( {0,3})(~{3,})(.*)?$/);
  if (!tildeMatch) return null;
  const fenceLength = tildeMatch[2].length;
  const infoString = (tildeMatch[3] ?? "").trim();
  return { indent, fenceChar: "~", fenceLength, infoString };
}

function parseFencedCodeBlock(
  lines: LineInfo[],
  startIndex: number,
  fenceInfo: FenceInfo,
): { codeBlock: CodeBlock; nextIndex: number } {
  const contentLines: string[] = [];
  let i = startIndex + 1;

  while (i < lines.length) {
    const line = lines[i];

    // Check for closing fence: 0-3 spaces, then same char repeated >= fenceLength times, then optional spaces
    const closePattern = new RegExp(
      `^ {0,3}${escapeRegex(fenceInfo.fenceChar)}{${fenceInfo.fenceLength},}[ \\t]*$`,
    );
    if (closePattern.test(line.raw)) {
      i++;
      break;
    }

    // Remove up to fenceInfo.indent spaces from the beginning of content lines
    let content = line.raw;
    let removed = 0;
    while (removed < fenceInfo.indent && content.length > 0 && content[0] === " ") {
      content = content.slice(1);
      removed++;
    }
    contentLines.push(content);
    i++;
  }

  const value = contentLines.length > 0 ? contentLines.join("\n") + "\n" : "";

  const codeBlock: CodeBlock = {
    type: "code_block",
    info: fenceInfo.infoString,
    value,
    sourceLocation: {
      start: { line: lines[startIndex].lineNumber, column: 1, offset: lines[startIndex].offset },
      end: endOfLine(lines[i - 1]),
    },
  };

  return { codeBlock, nextIndex: i };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- Block Quote ---

function isBlockQuoteStart(raw: string): boolean {
  return /^ {0,3}>/.test(raw);
}

function parseBlockQuote(
  lines: LineInfo[],
  startIndex: number,
): { blockQuote: BlockQuote; nextIndex: number } {
  const contentLines: string[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i];

    // Block quote line: 0-3 spaces, >, optional space
    const bqMatch = line.raw.match(/^ {0,3}> ?(.*)/);
    if (bqMatch) {
      contentLines.push(bqMatch[1]);
      i++;
      continue;
    }

    // Lazy continuation: non-blank line that doesn't start a new block construct
    if (
      !isBlankLine(line.raw) &&
      !tryATXHeading(line) &&
      !tryThematicBreak(line) &&
      !tryFencedCodeBlockStart(line) &&
      !tryListItemStart(line) &&
      !isBlockQuoteStart(line.raw)
    ) {
      // Only allow lazy continuation if we're in a paragraph
      const lastContent = contentLines[contentLines.length - 1];
      if (lastContent !== undefined && lastContent !== "" && !isBlankLine(lastContent)) {
        contentLines.push(line.raw);
        i++;
        continue;
      }
    }

    break;
  }

  // Parse the collected content as blocks
  const subContent = contentLines.join("\n");
  const subResult = parseBlocks(subContent);

  const blockQuote: BlockQuote = {
    type: "block_quote",
    children: subResult.document.children,
    sourceLocation: {
      start: { line: lines[startIndex].lineNumber, column: 1, offset: lines[startIndex].offset },
      end: endOfLine(lines[i - 1]),
    },
  };

  return { blockQuote, nextIndex: i };
}

// --- Link Reference Definition ---

function tryLinkReferenceDefinition(
  lines: LineInfo[],
  startIndex: number,
): { ref: LinkReference; nextIndex: number } | null {
  const line = lines[startIndex];

  // [label]: destination "title"
  // Label: up to 999 chars, no unescaped brackets
  const labelMatch = line.raw.match(/^ {0,3}\[([^\]]{1,999})\]:[ \t]+/);
  if (!labelMatch) return null;

  const label = labelMatch[1];
  const afterLabel = line.raw.slice(labelMatch[0].length);

  // Parse destination
  const destResult = parseLinkDestination(afterLabel);
  if (!destResult) return null;

  const afterDest = afterLabel.slice(destResult.consumed).trim();

  // Parse optional title (can be on next line)
  let title: string | null = null;
  let nextIndex = startIndex + 1;

  if (afterDest) {
    const titleResult = parseLinkTitle(afterDest);
    if (titleResult) {
      // Everything after title must be blank
      const afterTitle = afterDest.slice(titleResult.consumed).trim();
      if (afterTitle === "") {
        title = titleResult.title;
      } else {
        return null; // non-blank content after title
      }
    } else {
      return null; // non-blank, non-title content after destination
    }
  } else if (nextIndex < lines.length) {
    // Title might be on next line
    const nextLine = lines[nextIndex].raw.trim();
    if (nextLine) {
      const titleResult = parseLinkTitle(nextLine);
      if (titleResult) {
        const afterTitle = nextLine.slice(titleResult.consumed).trim();
        if (afterTitle === "") {
          title = titleResult.title;
          nextIndex++;
        }
      }
    }
  }

  return {
    ref: { label, destination: destResult.destination, title },
    nextIndex,
  };
}

function parseLinkDestination(input: string): { destination: string; consumed: number } | null {
  if (input.startsWith("<")) {
    // Angle-bracket destination
    const match = input.match(/^<([^<>\n]*)>/);
    if (match) {
      return { destination: match[1], consumed: match[0].length };
    }
    return null;
  }

  // Regular destination (no spaces, balanced parens)
  let i = 0;
  let parenDepth = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === " " || ch === "\t" || ch === "\n") break;
    if (ch === "(") {
      parenDepth++;
    } else if (ch === ")") {
      if (parenDepth === 0) break;
      parenDepth--;
    } else if (ch === "\\") {
      i++; // skip escaped character
    }
    i++;
  }

  if (i === 0) return null;
  return { destination: input.slice(0, i), consumed: i };
}

function parseLinkTitle(input: string): { title: string; consumed: number } | null {
  if (input.length === 0) return null;

  const openChar = input[0];
  let closeChar: string;
  if (openChar === '"') closeChar = '"';
  else if (openChar === "'") closeChar = "'";
  else if (openChar === "(") closeChar = ")";
  else return null;

  let i = 1;
  let title = "";
  while (i < input.length) {
    if (input[i] === "\\") {
      i++;
      if (i < input.length) title += input[i];
    } else if (input[i] === closeChar) {
      return { title, consumed: i + 1 };
    } else {
      title += input[i];
    }
    i++;
  }

  return null; // no closing character found
}

export function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}
