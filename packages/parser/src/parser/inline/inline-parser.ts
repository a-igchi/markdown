import type {
  InlineNode,
  Text,
  CodeSpan,
  SoftBreak,
  HardBreak,
  Link,
  SourceLocation,
  LinkReference,
} from "../../ast/nodes.js";
import {
  classifyDelimiterRun,
  processEmphasis,
  tagDelimiterNode,
  type DelimiterEntry,
} from "./delimiter.js";
import { normalizeLabel } from "../block/block-parser.js";

/**
 * Parse inline content from raw text.
 * Handles: text, soft breaks, hard breaks, emphasis/strong, links.
 */
export function parseInlines(
  rawContent: string,
  baseOffset: number,
  baseLine: number,
  references: Map<string, LinkReference>,
): InlineNode[] {
  const parser = new InlineParser(rawContent, baseOffset, baseLine, references);
  return parser.parse();
}

class InlineParser {
  private input: string;
  private pos: number = 0;
  private baseOffset: number;
  private baseLine: number;
  private references: Map<string, LinkReference>;

  constructor(
    input: string,
    baseOffset: number,
    baseLine: number,
    references: Map<string, LinkReference>,
  ) {
    this.input = input;
    this.baseOffset = baseOffset;
    this.baseLine = baseLine;
    this.references = references;
  }

  parse(): InlineNode[] {
    const nodes: InlineNode[] = [];
    const delimiters: DelimiterEntry[] = [];

    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];

      // Hard break: two or more spaces before newline, or backslash before newline
      if (ch === "\n") {
        const prev = this.input.slice(0, this.pos);
        const trailingSpaces = prev.match(/( +)$/);
        if (trailingSpaces && trailingSpaces[1].length >= 2) {
          // Remove trailing spaces from last text node
          this.trimLastTextNode(nodes, trailingSpaces[1].length);
          nodes.push(this.createHardBreak());
        } else if (this.pos > 0 && this.input[this.pos - 1] === "\\") {
          // Backslash hard break - remove the backslash from last text node
          this.trimLastTextNode(nodes, 1);
          nodes.push(this.createHardBreak());
        } else {
          nodes.push(this.createSoftBreak());
        }
        this.pos++;
        continue;
      }

      // Emphasis delimiters
      if (ch === "*" || ch === "_") {
        const delimStart = this.pos;
        let count = 0;
        while (this.pos < this.input.length && this.input[this.pos] === ch) {
          count++;
          this.pos++;
        }

        const { canOpen, canClose } = classifyDelimiterRun(this.input, delimStart, count, ch);

        const textNode = this.createText(ch.repeat(count), delimStart);
        nodes.push(textNode);

        if (canOpen || canClose) {
          const entry: DelimiterEntry = {
            type: ch,
            count,
            canOpen,
            canClose,
            textNodeIndex: nodes.length - 1,
            origCount: count,
            active: true,
          };
          tagDelimiterNode(textNode, entry);
          delimiters.push(entry);
        }
        continue;
      }

      // Link: [text](dest "title") or [text][label] or [text]
      if (ch === "[") {
        const linkResult = this.tryParseLink(nodes, delimiters);
        if (linkResult) {
          nodes.push(linkResult);
          continue;
        }
        // Not a link, treat as text
        nodes.push(this.createText("[", this.pos));
        this.pos++;
        continue;
      }

      // Code span
      if (ch === "`") {
        const codeSpanResult = this.tryParseCodeSpan();
        if (codeSpanResult.node) {
          nodes.push(codeSpanResult.node);
          continue;
        }
        // Not a code span; output the entire backtick string as literal text
        nodes.push(this.createText("`".repeat(codeSpanResult.openLength), this.pos));
        this.pos += codeSpanResult.openLength;
        continue;
      }

      // Backslash escape
      if (ch === "\\") {
        if (this.pos + 1 < this.input.length) {
          const nextCh = this.input[this.pos + 1];
          if (/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(nextCh)) {
            nodes.push(this.createText(nextCh, this.pos));
            this.pos += 2;
            continue;
          }
        }
        // Backslash not followed by escapable char: treat as literal backslash
        nodes.push(this.createText("\\", this.pos));
        this.pos++;
        continue;
      }

      // Regular text
      const textStart = this.pos;
      while (
        this.pos < this.input.length &&
        this.input[this.pos] !== "\n" &&
        this.input[this.pos] !== "*" &&
        this.input[this.pos] !== "_" &&
        this.input[this.pos] !== "[" &&
        this.input[this.pos] !== "\\" &&
        this.input[this.pos] !== "`"
      ) {
        this.pos++;
      }

      if (this.pos > textStart) {
        const text = this.input.slice(textStart, this.pos);
        nodes.push(this.createText(text, textStart));
      }
    }

    // Process emphasis delimiters
    const result = processEmphasis(nodes, delimiters);

    // Merge adjacent text nodes
    return mergeTextNodes(result);
  }

  private tryParseCodeSpan():
    | { node: CodeSpan; openLength: number }
    | { node: null; openLength: number } {
    const startPos = this.pos;

    // Count opening backticks
    let openLen = 0;
    while (startPos + openLen < this.input.length && this.input[startPos + openLen] === "`") {
      openLen++;
    }

    // Search for matching closing backtick string
    let i = startPos + openLen;
    while (i < this.input.length) {
      if (this.input[i] === "`") {
        let closeLen = 0;
        const closeStart = i;
        while (i < this.input.length && this.input[i] === "`") {
          closeLen++;
          i++;
        }
        if (closeLen === openLen) {
          // Found matching closer
          let content = this.input.slice(startPos + openLen, closeStart);

          // Line endings are converted to spaces
          content = content.replace(/\n/g, " ");

          // If content begins and ends with a space and doesn't consist entirely of spaces,
          // strip one space from front and back
          if (
            content.length >= 2 &&
            content[0] === " " &&
            content[content.length - 1] === " " &&
            content.trim().length > 0
          ) {
            content = content.slice(1, -1);
          }

          this.pos = i;
          return {
            node: {
              type: "code_span",
              value: content,
              sourceLocation: this.locFromRange(startPos, i),
            },
            openLength: openLen,
          };
        }
        // closeLen !== openLen, continue searching
      } else {
        i++;
      }
    }

    // No matching closer found
    return { node: null, openLength: openLen };
  }

  private tryParseLink(_existingNodes: InlineNode[], _delimiters: DelimiterEntry[]): Link | null {
    const startPos = this.pos;

    // Parse [text]
    const textResult = this.parseBracketedText(this.pos);
    if (!textResult) return null;

    const afterClose = textResult.end + 1;

    // Try inline link: (dest "title")
    if (afterClose < this.input.length && this.input[afterClose] === "(") {
      const inlineResult = this.parseInlineLinkTail(afterClose);
      if (inlineResult) {
        this.pos = inlineResult.end + 1;

        // Parse inline content within the link text
        const linkTextContent = textResult.content;
        const innerNodes = parseInlines(
          linkTextContent,
          this.baseOffset + startPos + 1,
          this.baseLine,
          this.references,
        );

        return {
          type: "link",
          destination: inlineResult.destination,
          title: inlineResult.title,
          children: innerNodes,
          sourceLocation: this.locFromRange(startPos, this.pos),
        };
      }
    }

    // Try full reference link: [text][label]
    if (afterClose < this.input.length && this.input[afterClose] === "[") {
      const labelResult = this.parseBracketedText(afterClose);
      if (labelResult) {
        const label = labelResult.content;
        const key = normalizeLabel(label);
        const ref = this.references.get(key);
        if (ref) {
          this.pos = labelResult.end + 1;
          const linkTextContent = textResult.content;
          const innerNodes = parseInlines(
            linkTextContent,
            this.baseOffset + startPos + 1,
            this.baseLine,
            this.references,
          );
          return {
            type: "link",
            destination: ref.destination,
            title: ref.title,
            children: innerNodes,
            sourceLocation: this.locFromRange(startPos, this.pos),
          };
        }
        // Empty label [text][] -> collapsed reference
        if (label === "") {
          const key2 = normalizeLabel(textResult.content);
          const ref2 = this.references.get(key2);
          if (ref2) {
            this.pos = labelResult.end + 1;
            const innerNodes = parseInlines(
              textResult.content,
              this.baseOffset + startPos + 1,
              this.baseLine,
              this.references,
            );
            return {
              type: "link",
              destination: ref2.destination,
              title: ref2.title,
              children: innerNodes,
              sourceLocation: this.locFromRange(startPos, this.pos),
            };
          }
        }
      }
    }

    // Try shortcut reference link: [text] where text matches a label
    const shortcutKey = normalizeLabel(textResult.content);
    const shortcutRef = this.references.get(shortcutKey);
    if (shortcutRef) {
      this.pos = textResult.end + 1;
      const innerNodes = parseInlines(
        textResult.content,
        this.baseOffset + startPos + 1,
        this.baseLine,
        this.references,
      );
      return {
        type: "link",
        destination: shortcutRef.destination,
        title: shortcutRef.title,
        children: innerNodes,
        sourceLocation: this.locFromRange(startPos, this.pos),
      };
    }

    return null;
  }

  private parseBracketedText(startPos: number): { content: string; end: number } | null {
    if (this.input[startPos] !== "[") return null;

    let depth = 1;
    let i = startPos + 1;
    let content = "";

    while (i < this.input.length && depth > 0) {
      if (this.input[i] === "\\") {
        content += this.input[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (this.input[i] === "[") depth++;
      if (this.input[i] === "]") {
        depth--;
        if (depth === 0) {
          return { content, end: i };
        }
      }
      content += this.input[i];
      i++;
    }

    return null;
  }

  private parseInlineLinkTail(
    startPos: number,
  ): { destination: string; title: string | null; end: number } | null {
    if (this.input[startPos] !== "(") return null;

    let i = startPos + 1;

    // Skip whitespace
    while (i < this.input.length && /[ \t\n]/.test(this.input[i])) i++;

    if (i >= this.input.length) return null;

    // Empty destination ()
    if (this.input[i] === ")") {
      return { destination: "", title: null, end: i };
    }

    // Parse destination
    let destination = "";

    if (this.input[i] === "<") {
      // Angle-bracket destination
      i++;
      while (i < this.input.length && this.input[i] !== ">") {
        if (this.input[i] === "\n") return null;
        if (this.input[i] === "\\") {
          i++;
          if (i < this.input.length) destination += this.input[i];
        } else {
          destination += this.input[i];
        }
        i++;
      }
      if (i >= this.input.length) return null;
      i++; // skip >
    } else {
      // Regular destination
      let parenDepth = 0;
      while (i < this.input.length) {
        const ch = this.input[i];
        if (ch === " " || ch === "\t" || ch === "\n") break;
        if (ch === "(") {
          parenDepth++;
        } else if (ch === ")") {
          if (parenDepth === 0) break;
          parenDepth--;
        } else if (ch === "\\") {
          i++;
          if (i < this.input.length) destination += this.input[i];
          i++;
          continue;
        }
        destination += ch;
        i++;
      }
    }

    // Skip whitespace
    while (i < this.input.length && /[ \t\n]/.test(this.input[i])) i++;

    // Parse optional title
    let title: string | null = null;
    if (
      i < this.input.length &&
      (this.input[i] === '"' || this.input[i] === "'" || this.input[i] === "(")
    ) {
      const openChar = this.input[i];
      const closeChar = openChar === "(" ? ")" : openChar;
      i++;
      let titleStr = "";
      while (i < this.input.length && this.input[i] !== closeChar) {
        if (this.input[i] === "\\") {
          i++;
          if (i < this.input.length) titleStr += this.input[i];
        } else {
          titleStr += this.input[i];
        }
        i++;
      }
      if (i >= this.input.length) return null;
      title = titleStr;
      i++; // skip close char
    }

    // Skip whitespace
    while (i < this.input.length && /[ \t\n]/.test(this.input[i])) i++;

    // Must end with )
    if (i >= this.input.length || this.input[i] !== ")") return null;

    return { destination, title, end: i };
  }

  private createText(value: string, startInInput: number): Text {
    return {
      type: "text",
      value,
      sourceLocation: this.locFromRange(startInInput, startInInput + value.length),
    };
  }

  private createSoftBreak(): SoftBreak {
    return {
      type: "softbreak",
      sourceLocation: this.locFromRange(this.pos, this.pos + 1),
    };
  }

  private createHardBreak(): HardBreak {
    return {
      type: "hardbreak",
      sourceLocation: this.locFromRange(this.pos, this.pos + 1),
    };
  }

  private trimLastTextNode(nodes: InlineNode[], count: number): void {
    if (nodes.length > 0) {
      const last = nodes[nodes.length - 1];
      if (last.type === "text") {
        last.value = last.value.slice(0, -count);
        if (last.value === "") {
          nodes.pop();
        }
      }
    }
  }

  private locFromRange(start: number, end: number): SourceLocation {
    // Simple offset-based location; line tracking would need more context
    return {
      start: {
        line: this.baseLine,
        column: start + 1,
        offset: this.baseOffset + start,
      },
      end: {
        line: this.baseLine,
        column: end + 1,
        offset: this.baseOffset + end,
      },
    };
  }
}

function mergeTextNodes(nodes: InlineNode[]): InlineNode[] {
  const result: InlineNode[] = [];
  for (const node of nodes) {
    if (node.type === "text" && result.length > 0 && result[result.length - 1].type === "text") {
      const prev = result[result.length - 1] as Text;
      prev.value += node.value;
      prev.sourceLocation.end = node.sourceLocation.end;
    } else {
      result.push(node);
    }
  }
  return result;
}
