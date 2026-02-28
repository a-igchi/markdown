import { getLineAt } from "./text-utils.js";

const INDENT = "  "; // 2 spaces

export function indentListItem(
  value: string,
  offset: number,
): { newValue: string; newOffset: number } | null {
  const { lineStart, fullLine } = getLineAt(value, offset);

  if (!isListLine(fullLine)) return null;

  const newValue = value.slice(0, lineStart) + INDENT + value.slice(lineStart);
  return { newValue, newOffset: offset + INDENT.length };
}

export function dedentListItem(
  value: string,
  offset: number,
): { newValue: string; newOffset: number } | null {
  const { lineStart, fullLine } = getLineAt(value, offset);

  if (!isListLine(fullLine)) return null;

  const leadingSpaces = fullLine.match(/^ */)?.[0].length ?? 0;
  const removeCount = Math.min(leadingSpaces, INDENT.length);
  if (removeCount === 0) return null;

  const newValue = value.slice(0, lineStart) + value.slice(lineStart + removeCount);
  return { newValue, newOffset: Math.max(lineStart, offset - removeCount) };
}

function isListLine(line: string): boolean {
  return /^( {0,9})([-+*] +)/.test(line) || /^( {0,9})(\d{1,9}[.)] +)/.test(line);
}
