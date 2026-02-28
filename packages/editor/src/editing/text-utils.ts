/**
 * Get the boundaries and text of the line containing `offset`.
 */
export function getLineAt(
  value: string,
  offset: number,
): { lineStart: number; lineEnd: number; fullLine: string } {
  const lineStart = value.lastIndexOf("\n", offset - 1) + 1;
  const lineEndIndex = value.indexOf("\n", offset);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  return { lineStart, lineEnd, fullLine: value.slice(lineStart, lineEnd) };
}
