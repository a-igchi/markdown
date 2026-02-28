import { getLineAt } from "./text-utils.js";

export function getListContinuation(
  value: string,
  offset: number,
): { insertion: string; cursorOffset: number } {
  const { fullLine } = getLineAt(value, offset);

  // Bullet: /^( {0,3})([-+*] +)/
  const bulletMatch = fullLine.match(/^( {0,3})([-+*] +)/);
  if (bulletMatch) {
    const marker = bulletMatch[1] + bulletMatch[2];
    return { insertion: "\n" + marker, cursorOffset: offset + 1 + marker.length };
  }

  // Ordered: /^( {0,3})(\d{1,9})([.)] +)/
  const orderedMatch = fullLine.match(/^( {0,3})(\d{1,9})([.)] +)/);
  if (orderedMatch) {
    const indent = orderedMatch[1];
    const nextNum = parseInt(orderedMatch[2], 10) + 1;
    const sepAndSpace = orderedMatch[3];
    const marker = indent + nextNum + sepAndSpace;
    return { insertion: "\n" + marker, cursorOffset: offset + 1 + marker.length };
  }

  // Not a list → plain newline
  return { insertion: "\n", cursorOffset: offset + 1 };
}
