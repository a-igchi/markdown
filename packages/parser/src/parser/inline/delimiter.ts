import type { InlineNode, Emphasis, Strong, SourceLocation } from "../../ast/nodes.js";

export interface DelimiterEntry {
  type: "*" | "_";
  count: number;
  origCount: number;
  canOpen: boolean;
  canClose: boolean;
  textNodeIndex: number; // index into the nodes array at creation time
  active: boolean;
}

/**
 * Determine if a delimiter run is left-flanking and/or right-flanking.
 * Per CommonMark spec section 6.2.
 */
export function classifyDelimiterRun(
  text: string,
  delimStart: number,
  delimLength: number,
  delimChar: "*" | "_",
): { canOpen: boolean; canClose: boolean } {
  const charBefore = delimStart > 0 ? text[delimStart - 1] : "\n";
  const charAfter = delimStart + delimLength < text.length ? text[delimStart + delimLength] : "\n";

  const leftFlanking = isLeftFlanking(charBefore, charAfter);
  const rightFlanking = isRightFlanking(charBefore, charAfter);

  if (delimChar === "*") {
    return {
      canOpen: leftFlanking,
      canClose: rightFlanking,
    };
  } else {
    // _ has additional restrictions for intraword
    return {
      canOpen: leftFlanking && (!rightFlanking || isPunctuation(charBefore)),
      canClose: rightFlanking && (!leftFlanking || isPunctuation(charAfter)),
    };
  }
}

function isLeftFlanking(charBefore: string, charAfter: string): boolean {
  if (isUnicodeWhitespace(charAfter)) return false;
  if (!isPunctuation(charAfter)) return true;
  return isUnicodeWhitespace(charBefore) || isPunctuation(charBefore);
}

function isRightFlanking(charBefore: string, charAfter: string): boolean {
  if (isUnicodeWhitespace(charBefore)) return false;
  if (!isPunctuation(charBefore)) return true;
  return isUnicodeWhitespace(charAfter) || isPunctuation(charAfter);
}

function isUnicodeWhitespace(ch: string): boolean {
  return /\s/.test(ch);
}

function isPunctuation(ch: string): boolean {
  return /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~\u00A1-\u00BF\u00D7\u00F7\u2010-\u2027\u2030-\u205E\u2308-\u2318]/.test(
    ch,
  );
}

/**
 * Process emphasis using the delimiter algorithm from CommonMark spec.
 *
 * Uses a tagged-node approach: nodes carry tags linking them to delimiter entries.
 * After processing, strip any remaining delimiter text nodes and return clean results.
 */
export function processEmphasis(nodes: InlineNode[], delimiters: DelimiterEntry[]): InlineNode[] {
  if (delimiters.length === 0) return nodes;

  // We use a different strategy: instead of mutating arrays with splice,
  // we work with a linked structure. But for simplicity, let's use a
  // recursive approach that processes one match at a time.

  return processEmphasisRecursive(nodes, delimiters, 0);
}

function processEmphasisRecursive(
  nodes: InlineNode[],
  delimiters: DelimiterEntry[],
  depth: number,
): InlineNode[] {
  // Safety: prevent runaway recursion
  if (depth > 100) return nodes;

  // Find the first closer
  let closerIdx = -1;
  for (let i = 0; i < delimiters.length; i++) {
    if (delimiters[i].canClose && delimiters[i].count > 0 && delimiters[i].active) {
      closerIdx = i;
      break;
    }
  }

  if (closerIdx === -1) return nodes;

  const closer = delimiters[closerIdx];

  // Find matching opener (looking backwards)
  let openerIdx = -1;
  for (let i = closerIdx - 1; i >= 0; i--) {
    const opener = delimiters[i];
    if (!opener.active || opener.count === 0 || !opener.canOpen) continue;
    if (opener.type !== closer.type) continue;

    // Multiple-of-3 rule
    if ((opener.canOpen && opener.canClose) || (closer.canOpen && closer.canClose)) {
      if (
        (opener.origCount + closer.origCount) % 3 === 0 &&
        opener.origCount % 3 !== 0 &&
        closer.origCount % 3 !== 0
      ) {
        continue;
      }
    }

    openerIdx = i;
    break;
  }

  if (openerIdx === -1) {
    // No opener found; disable this as a closer but keep it as a potential opener
    closer.canClose = false;
    return processEmphasisRecursive(nodes, delimiters, depth + 1);
  }

  const opener = delimiters[openerIdx];

  // Determine emphasis vs strong
  const useCount = opener.count >= 2 && closer.count >= 2 ? 2 : 1;
  const isStrong = useCount === 2;

  // Find the actual node indices for opener and closer text nodes
  const openerTextIdx = findNodeByDelimiter(nodes, opener);
  const closerTextIdx = findNodeByDelimiter(nodes, closer);

  if (openerTextIdx === -1 || closerTextIdx === -1 || openerTextIdx >= closerTextIdx) {
    closer.active = false;
    return processEmphasisRecursive(nodes, delimiters, depth + 1);
  }

  // Consume delimiter characters
  opener.count -= useCount;
  closer.count -= useCount;

  // Trim opener text node
  const openerNode = nodes[openerTextIdx];
  if (openerNode.type === "text") {
    openerNode.value = openerNode.value.slice(0, openerNode.value.length - useCount);
  }

  // Trim closer text node
  const closerNode = nodes[closerTextIdx];
  if (closerNode.type === "text") {
    closerNode.value = closerNode.value.slice(useCount);
  }

  // Collect children between opener and closer
  const children = nodes.slice(openerTextIdx + 1, closerTextIdx);

  // Deactivate any delimiters between opener and closer
  for (let i = openerIdx + 1; i < closerIdx; i++) {
    delimiters[i].active = false;
  }

  // Create emphasis node
  // sourceLocation includes the delimiter characters (e.g., *..* or **...**)
  const loc: SourceLocation = {
    start: {
      line: openerNode.sourceLocation.start.line,
      column: openerNode.sourceLocation.end.column - useCount,
      offset: openerNode.sourceLocation.end.offset - useCount,
    },
    end: {
      line: closerNode.sourceLocation.end.line,
      column: closerNode.sourceLocation.start.column + useCount,
      offset: closerNode.sourceLocation.start.offset + useCount,
    },
  };

  const emphNode: Emphasis | Strong = isStrong
    ? { type: "strong", children, sourceLocation: loc }
    : { type: "emphasis", children, sourceLocation: loc };

  // Replace the range [openerTextIdx+1, closerTextIdx) with emphNode
  // Keep opener and closer text nodes (they may still have remaining chars)
  const newNodes: InlineNode[] = [
    ...nodes.slice(0, openerTextIdx + 1),
    emphNode,
    ...nodes.slice(closerTextIdx),
  ];

  // Remove empty text nodes
  const filtered = newNodes.filter((n) => {
    if (n.type === "text" && n.value === "") return false;
    return true;
  });

  // Update delimiter text node references
  // After the splice, nodes have shifted. We need to update textNodeIndex for remaining delimiters.
  // Instead of tracking indices, we use object identity.

  // Remove exhausted delimiters
  if (opener.count === 0) opener.active = false;
  if (closer.count === 0) closer.active = false;

  return processEmphasisRecursive(filtered, delimiters, depth + 1);
}

function findNodeByDelimiter(nodes: InlineNode[], delim: DelimiterEntry): number {
  // Find text node that contains this delimiter's characters
  // We use object identity by storing a reference
  // Actually, let's search by the tagged property
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if ((node as any).__delimId === delim) return i;
  }
  return -1;
}

/** Tag a text node with its delimiter entry for later lookup */
export function tagDelimiterNode(node: InlineNode, delim: DelimiterEntry): void {
  (node as any).__delimId = delim;
}
