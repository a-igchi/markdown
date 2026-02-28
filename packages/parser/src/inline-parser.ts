import { SyntaxKind } from "./syntax-kind.js";
import { createToken, createNode, type SyntaxElement } from "./nodes.js";

/**
 * Parse inline content from a text string, returning an array of SyntaxElements.
 * Handles: CODE_SPAN, EMPHASIS, STRONG_EMPHASIS, LINK, IMAGE, HARD_LINE_BREAK.
 *
 * @param text The raw text to parse (without trailing newline)
 * @param baseOffset The offset of `text[0]` within the document source
 */
export function parseInlines(text: string, baseOffset: number): SyntaxElement[] {
  const elements: SyntaxElement[] = [];
  let pos = 0;
  let textStart = 0;

  function flushText(end: number) {
    if (end > textStart) {
      elements.push(createToken(SyntaxKind.TEXT, text.slice(textStart, end), baseOffset + textStart));
    }
  }

  while (pos < text.length) {
    const ch = text[pos];

    if (ch === "`") {
      const result = tryParseCodeSpan(text, pos, baseOffset);
      if (result) { flushText(pos); elements.push(result.element); pos = result.newPos; textStart = pos; continue; }
      pos++;
      continue;
    }

    if (ch === "*" || ch === "_") {
      const result = tryParseEmphasis(text, pos, baseOffset);
      if (result) { flushText(pos); elements.push(result.element); pos = result.newPos; textStart = pos; continue; }
      pos++;
      continue;
    }

    if (ch === "[") {
      const result = tryParseLink(text, pos, baseOffset);
      if (result) { flushText(pos); elements.push(result.element); pos = result.newPos; textStart = pos; continue; }
      pos++;
      continue;
    }

    if (ch === "!" && pos + 1 < text.length && text[pos + 1] === "[") {
      const result = tryParseImage(text, pos, baseOffset);
      if (result) { flushText(pos); elements.push(result.element); pos = result.newPos; textStart = pos; continue; }
      pos++;
      continue;
    }

    pos++;
  }

  flushText(text.length);
  return elements;
}

type InlineParseResult = { element: SyntaxElement; newPos: number };

function tryParseCodeSpan(
  text: string,
  pos: number,
  baseOffset: number,
): InlineParseResult | null {
  const openStart = pos;
  let openLen = 0;
  while (pos < text.length && text[pos] === "`") { openLen++; pos++; }
  const closePos = findClosingBackticks(text, pos, openLen);
  if (closePos === -1) return null;

  const spanOffset = baseOffset + openStart;
  const spanChildren: SyntaxElement[] = [];
  let spanOff = spanOffset;

  spanChildren.push(createToken(SyntaxKind.BACKTICK, text.slice(openStart, openStart + openLen), spanOff));
  spanOff += openLen;

  const codeText = text.slice(pos, closePos);
  if (codeText) {
    spanChildren.push(createToken(SyntaxKind.TEXT, codeText, spanOff));
    spanOff += codeText.length;
  }

  spanChildren.push(createToken(SyntaxKind.BACKTICK, text.slice(closePos, closePos + openLen), spanOff));

  return {
    element: createNode(SyntaxKind.CODE_SPAN, spanChildren, spanOffset),
    newPos: closePos + openLen,
  };
}

function tryParseEmphasis(
  text: string,
  pos: number,
  baseOffset: number,
): InlineParseResult | null {
  const markerStart = pos;
  const markerChar = text[pos];
  let markerLen = 0;
  while (pos < text.length && text[pos] === markerChar) { markerLen++; pos++; }

  const strong = markerLen >= 2;
  const expectedLen = strong ? 2 : 1;
  const closePos = findClosingEmphasis(text, pos, markerChar, expectedLen);
  if (closePos === -1) return null;

  const emphOffset = baseOffset + markerStart;
  const emphChildren: SyntaxElement[] = [];
  let emphOff = emphOffset;

  emphChildren.push(createToken(SyntaxKind.EMPHASIS_MARKER, text.slice(markerStart, markerStart + expectedLen), emphOff));
  emphOff += expectedLen;

  const innerText = text.slice(markerStart + expectedLen, closePos);
  emphChildren.push(...parseInlines(innerText, emphOff));
  emphOff += innerText.length;

  emphChildren.push(createToken(SyntaxKind.EMPHASIS_MARKER, text.slice(closePos, closePos + expectedLen), emphOff));

  const kind = strong ? SyntaxKind.STRONG_EMPHASIS : SyntaxKind.EMPHASIS;
  return {
    element: createNode(kind, emphChildren, emphOffset),
    // Consume only expectedLen; extra markers become literal text via outer loop restart
    newPos: closePos + expectedLen,
  };
}

function tryParseLink(
  text: string,
  pos: number,
  baseOffset: number,
): InlineParseResult | null {
  const linkStart = pos;
  const closePos = findMatchingBracket(text, pos + 1);
  if (closePos === -1 || text[closePos + 1] !== "(") return null;
  const destEnd = findClosingParen(text, closePos + 2);
  if (destEnd === -1) return null;

  const linkOffset = baseOffset + linkStart;
  const linkChildren: SyntaxElement[] = [];
  let linkOff = linkOffset;

  linkChildren.push(createToken(SyntaxKind.LINK_OPEN, "[", linkOff));
  linkOff += 1;

  const linkTextContent = text.slice(linkStart + 1, closePos);
  linkChildren.push(createNode(SyntaxKind.LINK_TEXT, parseInlines(linkTextContent, linkOff), linkOff));
  linkOff += linkTextContent.length;

  linkChildren.push(createToken(SyntaxKind.LINK_CLOSE, "]", linkOff));
  linkOff += 1;

  linkChildren.push(createToken(SyntaxKind.LINK_DEST_OPEN, "(", linkOff));
  linkOff += 1;

  const destContent = text.slice(closePos + 2, destEnd);
  const { tokens: destTokens, length: destLen } = parseDestinationTokens(destContent, linkOff);
  linkChildren.push(...destTokens);
  linkOff += destLen;

  linkChildren.push(createToken(SyntaxKind.LINK_DEST_CLOSE, ")", linkOff));

  return { element: createNode(SyntaxKind.LINK, linkChildren, linkOffset), newPos: destEnd + 1 };
}

function tryParseImage(
  text: string,
  pos: number,
  baseOffset: number,
): InlineParseResult | null {
  const imgStart = pos;
  const closePos = findMatchingBracket(text, pos + 2);
  if (closePos === -1 || text[closePos + 1] !== "(") return null;
  const destEnd = findClosingParen(text, closePos + 2);
  if (destEnd === -1) return null;

  const imgOffset = baseOffset + imgStart;
  const imgChildren: SyntaxElement[] = [];
  let imgOff = imgOffset;

  imgChildren.push(createToken(SyntaxKind.IMAGE_OPEN, "![", imgOff));
  imgOff += 2;

  const altContent = text.slice(imgStart + 2, closePos);
  imgChildren.push(createNode(SyntaxKind.IMAGE_ALT, parseInlines(altContent, imgOff), imgOff));
  imgOff += altContent.length;

  imgChildren.push(createToken(SyntaxKind.LINK_CLOSE, "]", imgOff));
  imgOff += 1;

  imgChildren.push(createToken(SyntaxKind.LINK_DEST_OPEN, "(", imgOff));
  imgOff += 1;

  const destContent = text.slice(closePos + 2, destEnd);
  const { tokens: destTokens, length: destLen } = parseDestinationTokens(destContent, imgOff);
  imgChildren.push(...destTokens);
  imgOff += destLen;

  imgChildren.push(createToken(SyntaxKind.LINK_DEST_CLOSE, ")", imgOff));

  return { element: createNode(SyntaxKind.IMAGE, imgChildren, imgOffset), newPos: destEnd + 1 };
}

/**
 * Parse inline content for a line that may end with a hard line break.
 * @param lineText The line text (without trailing newline)
 * @param hasNewline Whether the line has a trailing newline
 * @param baseOffset Offset of lineText[0] in the document
 * @returns [inlineElements, hardLineBreak | null]
 */
export function parseInlineWithHardLineBreak(
  lineText: string,
  hasNewline: boolean,
  baseOffset: number,
): { inlines: SyntaxElement[]; hardLineBreak: SyntaxElement | null } {
  if (!hasNewline) {
    return { inlines: parseInlines(lineText, baseOffset), hardLineBreak: null };
  }

  // Check for hard line break: 2+ trailing spaces or backslash before newline
  const trailingSpaces = lineText.match(/ {2,}$/);
  if (trailingSpaces) {
    const textPart = lineText.slice(0, lineText.length - trailingSpaces[0].length);
    const inlines = parseInlines(textPart, baseOffset);
    const hlbOffset = baseOffset + textPart.length;
    const hlb = createToken(SyntaxKind.HARD_LINE_BREAK, trailingSpaces[0] + "\n", hlbOffset);
    return { inlines, hardLineBreak: hlb };
  }

  if (lineText.endsWith("\\")) {
    const textPart = lineText.slice(0, -1);
    const inlines = parseInlines(textPart, baseOffset);
    const hlbOffset = baseOffset + textPart.length;
    const hlb = createToken(SyntaxKind.HARD_LINE_BREAK, "\\\n", hlbOffset);
    return { inlines, hardLineBreak: hlb };
  }

  return { inlines: parseInlines(lineText, baseOffset), hardLineBreak: null };
}

function parseDestinationTokens(
  destContent: string,
  offset: number,
): { tokens: SyntaxElement[]; length: number } {
  const tokens: SyntaxElement[] = [];
  let len = 0;

  if (destContent) {
    const titleMatch = destContent.match(/^(.*?)( +"[^"]*"| +'[^']*'| +\([^)]*\))$/);
    if (titleMatch) {
      const dest = titleMatch[1];
      const title = titleMatch[2];
      if (dest) {
        tokens.push(createToken(SyntaxKind.LINK_DESTINATION, dest, offset + len));
        len += dest.length;
      }
      tokens.push(createToken(SyntaxKind.LINK_TITLE, title, offset + len));
      len += title.length;
    } else {
      tokens.push(createToken(SyntaxKind.LINK_DESTINATION, destContent, offset + len));
      len += destContent.length;
    }
  }

  return { tokens, length: len };
}

function findClosingBackticks(text: string, start: number, openLen: number): number {
  let pos = start;
  while (pos < text.length) {
    if (text[pos] === "`") {
      let closeLen = 0;
      while (pos + closeLen < text.length && text[pos + closeLen] === "`") {
        closeLen++;
      }
      if (closeLen === openLen) return pos;
      pos += closeLen;
    } else {
      pos++;
    }
  }
  return -1;
}

function findClosingEmphasis(
  text: string,
  start: number,
  markerChar: string,
  markerLen: number,
): number {
  let pos = start;
  while (pos < text.length) {
    if (text[pos] === markerChar) {
      let closeLen = 0;
      while (pos + closeLen < text.length && text[pos + closeLen] === markerChar) {
        closeLen++;
      }
      if (closeLen >= markerLen) {
        // For _ emphasis: must not be inside a word
        if (markerChar === "_") {
          const beforeClose = pos > 0 ? text[pos - 1] : " ";
          const afterClose = pos + closeLen < text.length ? text[pos + closeLen] : " ";
          if (/\w/.test(beforeClose) && /\w/.test(afterClose)) {
            pos += closeLen;
            continue;
          }
        }
        return pos;
      }
      pos += closeLen;
    } else {
      pos++;
    }
  }
  return -1;
}

function findMatchingBracket(text: string, start: number): number {
  let depth = 1;
  let pos = start;
  while (pos < text.length) {
    if (text[pos] === "[") depth++;
    else if (text[pos] === "]") {
      depth--;
      if (depth === 0) return pos;
    }
    pos++;
  }
  return -1;
}

function findClosingParen(text: string, start: number): number {
  let depth = 1;
  let pos = start;
  let inString: string | null = null;
  while (pos < text.length) {
    const ch = text[pos];
    if (inString) {
      if (ch === inString) inString = null;
    } else if (ch === '"' || ch === "'") {
      inString = ch;
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) return pos;
    }
    pos++;
  }
  return -1;
}
