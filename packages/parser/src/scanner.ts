export type ATXHeadingMatch = {
  indent: string;
  hashes: string;
  spacesAfterHash: string;
  content: string;
  closingHashes: string;
  trailingSpaces: string;
  level: number;
};

export type ThematicBreakMatch = {
  indent: string;
  chars: string;
};

export type ListItemMatch = {
  indent: string;
  marker: string;
  type: "bullet" | "ordered";
};

export const isBlankLine = (line: string): boolean => /^[ \t]*$/.test(line);

export const matchATXHeading = (line: string): ATXHeadingMatch | null => {
  // 0-3 spaces indent, then 1-6 #, then space or end of line
  const match = line.match(/^( {0,3})(#{1,6})( +|$)(.*?)$/);
  if (!match) return null;

  const [, indent, hashes, spacesAfterHash, rest] = match;

  // Parse closing hashes from rest
  let content = rest;
  let closingHashes = "";
  let trailingSpaces = "";

  // Check for trailing spaces first
  const trailingMatch = content.match(/^(.*?)( +)$/);
  if (trailingMatch) {
    content = trailingMatch[1];
    trailingSpaces = trailingMatch[2];
  }

  // Check for closing hashes (must be preceded by space in original content)
  const closingMatch = content.match(/^(.*) (#+)$/);
  if (closingMatch) {
    content = closingMatch[1];
    closingHashes = closingMatch[2];
  }

  return {
    indent,
    hashes,
    spacesAfterHash,
    content,
    closingHashes,
    trailingSpaces,
    level: hashes.length,
  };
};

export const matchThematicBreak = (line: string): ThematicBreakMatch | null => {
  const match = line.match(/^( {0,3})([-*_][-*_ \t]*)$/);
  if (!match) return null;

  const [, indent, chars] = match;

  // All non-whitespace characters must be the same type, and at least 3
  const charOnly = chars.replace(/[ \t]/g, "");
  if (charOnly.length < 3) return null;
  const first = charOnly[0];
  if (!charOnly.split("").every((c) => c === first)) return null;

  return { indent, chars };
};

export type CodeFenceMatch = {
  indent: string;
  fence: string;
  char: "`" | "~";
  fenceLength: number;
  info: string;
};

export const matchCodeFence = (line: string): CodeFenceMatch | null => {
  const match = line.match(/^( {0,3})(`{3,}|~{3,})(.*)$/);
  if (!match) return null;
  const [, indent, fence, info] = match;
  const char = fence[0] as "`" | "~";
  // Backtick info string cannot contain backticks (CommonMark §4.5)
  if (char === "`" && info.includes("`")) return null;
  return { indent, fence, char, fenceLength: fence.length, info };
};

const closingFenceCache = new Map<string, RegExp>();

export const isClosingCodeFence = (
  line: string,
  openChar: "`" | "~",
  minLength: number,
): boolean => {
  const key = openChar + minLength;
  let re = closingFenceCache.get(key);
  if (!re) {
    const fencePattern = openChar === "`" ? `\`{${minLength},}` : `~{${minLength},}`;
    re = new RegExp(`^( {0,3})${fencePattern}[ \\t]*$`);
    closingFenceCache.set(key, re);
  }
  return re.test(line);
};

export type BlockQuoteMatch = {
  marker: string;
};

export const matchBlockQuote = (line: string): BlockQuoteMatch | null => {
  const match = line.match(/^( {0,3})> ?/);
  if (!match) return null;
  return { marker: match[0] };
};

export type BlockKind =
  | "blank"
  | "codeFence"
  | "atxHeading"
  | "thematicBreak"
  | "blockQuote"
  | "listItem"
  | "paragraph";

export const classifyLine = (content: string): BlockKind => {
  if (isBlankLine(content)) return "blank";
  if (matchCodeFence(content)) return "codeFence";
  if (matchATXHeading(content)) return "atxHeading";
  if (matchThematicBreak(content)) return "thematicBreak";
  if (matchBlockQuote(content)) return "blockQuote";
  if (matchListItemStart(content)) return "listItem";
  return "paragraph";
};

export const matchListItemStart = (line: string): ListItemMatch | null => {
  // Bullet list: 0-3 spaces, then [-+*], then 1+ space
  const bulletMatch = line.match(/^( {0,3})([-+*] +)/);
  if (bulletMatch) {
    return {
      indent: bulletMatch[1],
      marker: bulletMatch[2],
      type: "bullet",
    };
  }

  // Ordered list: 0-3 spaces, then 1-9 digits, then [.)], then 1+ space
  const orderedMatch = line.match(/^( {0,3})(\d{1,9}[.)] +)/);
  if (orderedMatch) {
    return {
      indent: orderedMatch[1],
      marker: orderedMatch[2],
      type: "ordered",
    };
  }

  return null;
};
