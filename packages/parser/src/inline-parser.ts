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

    // Code span: backtick string
    if (ch === "`") {
      const openStart = pos;
      let openLen = 0;
      while (pos < text.length && text[pos] === "`") {
        openLen++;
        pos++;
      }
      const closePos = findClosingBackticks(text, pos, openLen);
      if (closePos !== -1) {
        flushText(openStart);
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

        elements.push(createNode(SyntaxKind.CODE_SPAN, spanChildren, spanOffset));
        pos = closePos + openLen;
        textStart = pos;
        continue;
      }
      // No closing backtick found — treat as literal text, continue from openStart+1
      pos = openStart + 1;
      continue;
    }

    // Emphasis / Strong Emphasis: * or _
    if (ch === "*" || ch === "_") {
      const markerStart = pos;
      const markerChar = ch;
      let markerLen = 0;
      while (pos < text.length && text[pos] === markerChar) {
        markerLen++;
        pos++;
      }

      const strong = markerLen >= 2;
      const expectedLen = strong ? 2 : 1;

      const closePos = findClosingEmphasis(text, pos, markerChar, expectedLen);
      if (closePos !== -1) {
        flushText(markerStart);
        const emphOffset = baseOffset + markerStart;
        const emphChildren: SyntaxElement[] = [];
        let emphOff = emphOffset;

        const openMarker = text.slice(markerStart, markerStart + expectedLen);
        emphChildren.push(createToken(SyntaxKind.EMPHASIS_MARKER, openMarker, emphOff));
        emphOff += expectedLen;

        // Parse inner content recursively
        const innerText = text.slice(markerStart + expectedLen, closePos);
        const innerElements = parseInlines(innerText, emphOff);
        emphChildren.push(...innerElements);
        emphOff += innerText.length;

        emphChildren.push(createToken(SyntaxKind.EMPHASIS_MARKER, text.slice(closePos, closePos + expectedLen), emphOff));

        const kind = strong ? SyntaxKind.STRONG_EMPHASIS : SyntaxKind.EMPHASIS;
        elements.push(createNode(kind, emphChildren, emphOffset));

        // Consume only expectedLen of the opening markers
        // If markerLen > expectedLen, the extra chars become literal text
        pos = closePos + expectedLen;
        textStart = pos;
        continue;
      }
      // No closing found — treat as literal
      pos = markerStart + 1;
      continue;
    }

    // Inline link: [text](dest "title")
    if (ch === "[") {
      const linkStart = pos;
      const closePos = findMatchingBracket(text, pos + 1);
      if (closePos !== -1 && text[closePos + 1] === "(") {
        const destEnd = findClosingParen(text, closePos + 2);
        if (destEnd !== -1) {
          flushText(linkStart);
          const linkOffset = baseOffset + linkStart;
          const linkChildren: SyntaxElement[] = [];
          let linkOff = linkOffset;

          linkChildren.push(createToken(SyntaxKind.LINK_OPEN, "[", linkOff));
          linkOff += 1;

          const linkTextContent = text.slice(linkStart + 1, closePos);
          const textNode = createNode(
            SyntaxKind.LINK_TEXT,
            parseInlines(linkTextContent, linkOff),
            linkOff,
          );
          linkChildren.push(textNode);
          linkOff += linkTextContent.length;

          linkChildren.push(createToken(SyntaxKind.LINK_CLOSE, "]", linkOff));
          linkOff += 1;

          linkChildren.push(createToken(SyntaxKind.LINK_DEST_OPEN, "(", linkOff));
          linkOff += 1;

          const destContent = text.slice(closePos + 2, destEnd);
          if (destContent) {
            // Split destination and optional title
            const titleMatch = destContent.match(/^(.*?)( +"[^"]*"| +'[^']*'| +\([^)]*\))$/);
            if (titleMatch) {
              const dest = titleMatch[1];
              const title = titleMatch[2];
              if (dest) {
                linkChildren.push(createToken(SyntaxKind.LINK_DESTINATION, dest, linkOff));
                linkOff += dest.length;
              }
              linkChildren.push(createToken(SyntaxKind.LINK_TITLE, title, linkOff));
              linkOff += title.length;
            } else {
              linkChildren.push(createToken(SyntaxKind.LINK_DESTINATION, destContent, linkOff));
              linkOff += destContent.length;
            }
          }

          linkChildren.push(createToken(SyntaxKind.LINK_DEST_CLOSE, ")", linkOff));

          elements.push(createNode(SyntaxKind.LINK, linkChildren, linkOffset));
          pos = destEnd + 1;
          textStart = pos;
          continue;
        }
      }
      pos++;
      continue;
    }

    // Inline image: ![alt](dest "title")
    if (ch === "!" && pos + 1 < text.length && text[pos + 1] === "[") {
      const imgStart = pos;
      const closePos = findMatchingBracket(text, pos + 2);
      if (closePos !== -1 && text[closePos + 1] === "(") {
        const destEnd = findClosingParen(text, closePos + 2);
        if (destEnd !== -1) {
          flushText(imgStart);
          const imgOffset = baseOffset + imgStart;
          const imgChildren: SyntaxElement[] = [];
          let imgOff = imgOffset;

          imgChildren.push(createToken(SyntaxKind.IMAGE_OPEN, "![", imgOff));
          imgOff += 2;

          const altContent = text.slice(imgStart + 2, closePos);
          const altNode = createNode(
            SyntaxKind.IMAGE_ALT,
            parseInlines(altContent, imgOff),
            imgOff,
          );
          imgChildren.push(altNode);
          imgOff += altContent.length;

          imgChildren.push(createToken(SyntaxKind.LINK_CLOSE, "]", imgOff));
          imgOff += 1;

          imgChildren.push(createToken(SyntaxKind.LINK_DEST_OPEN, "(", imgOff));
          imgOff += 1;

          const destContent = text.slice(closePos + 2, destEnd);
          if (destContent) {
            const titleMatch = destContent.match(/^(.*?)( +"[^"]*"| +'[^']*'| +\([^)]*\))$/);
            if (titleMatch) {
              const dest = titleMatch[1];
              const title = titleMatch[2];
              if (dest) {
                imgChildren.push(createToken(SyntaxKind.LINK_DESTINATION, dest, imgOff));
                imgOff += dest.length;
              }
              imgChildren.push(createToken(SyntaxKind.LINK_TITLE, title, imgOff));
              imgOff += title.length;
            } else {
              imgChildren.push(createToken(SyntaxKind.LINK_DESTINATION, destContent, imgOff));
              imgOff += destContent.length;
            }
          }

          imgChildren.push(createToken(SyntaxKind.LINK_DEST_CLOSE, ")", imgOff));

          elements.push(createNode(SyntaxKind.IMAGE, imgChildren, imgOffset));
          pos = destEnd + 1;
          textStart = pos;
          continue;
        }
      }
      pos++;
      continue;
    }

    pos++;
  }

  flushText(text.length);
  return elements;
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
