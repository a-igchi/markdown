import * as fc from "fast-check";

// --- Markdown generators ---

// Safe plain text: letters and spaces only (no markdown special chars)
// Always starts and ends with a letter so emphasis flanking rules work correctly.
export const safeText = fc.stringMatching(/^[a-zA-Z][a-zA-Z ]{0,18}[a-zA-Z]$/);

// Safe code content: letters/spaces/digits only (no backticks)
export const safeCodeContent = fc.stringMatching(/^[a-zA-Z0-9 ]{1,20}$/);

// ATX heading: "# text" with level 1-6
export const headingBlock = fc
  .tuple(fc.integer({ min: 1, max: 6 }), safeText)
  .map(([level, text]) => `${"#".repeat(level)} ${text}`);

// Paragraph: one or more lines of safe text joined by \n
export const paragraphBlock = fc
  .array(safeText, { minLength: 1, maxLength: 3 })
  .map((lines) => lines.join("\n"));

// Paragraph with inline code span: "text `code` text"
export const paragraphWithCodeSpan = fc
  .tuple(safeText, safeCodeContent, safeText)
  .map(([before, code, after]) => `${before} \`${code}\` ${after}`);

// Paragraph with emphasis: "text *emph* text"
export const paragraphWithEmphasis = fc
  .tuple(safeText, safeText, safeText)
  .map(([before, inner, after]) => `${before} *${inner}* ${after}`);

// Paragraph with strong emphasis: "text **strong** text"
export const paragraphWithStrong = fc
  .tuple(safeText, safeText, safeText)
  .map(([before, inner, after]) => `${before} **${inner}** ${after}`);

// Paragraph with hard line break (2 trailing spaces + newline)
export const paragraphWithHardBreak = fc
  .tuple(safeText, safeText)
  .map(([line1, line2]) => `${line1}  \n${line2}`);

// Paragraph with inline link: "[text](url)"
// Use safe URL-like strings (no parens/spaces)
export const safeUrl = fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/);
export const paragraphWithLink = fc
  .tuple(safeText, safeText, safeUrl)
  .map(([before, linkText, url]) => `${before} [${linkText}](${url}) ${before}`);

// Paragraph with image: "![alt](url)"
export const paragraphWithImage = fc
  .tuple(safeText, safeUrl)
  .map(([alt, url]) => `![${alt}](${url})`);

// Bullet list: one or more "- text" items
export const bulletListBlock = fc
  .array(safeText, { minLength: 1, maxLength: 4 })
  .map((items) => items.map((t) => `- ${t}`).join("\n"));

// Ordered list: "1. text", "2. text", ...
export const orderedListBlock = fc
  .array(safeText, { minLength: 1, maxLength: 4 })
  .map((items) => items.map((t, i) => `${i + 1}. ${t}`).join("\n"));

// Thematic break
export const thematicBreakBlock = fc.constant("---");

// Fenced code block: "```\ncontent\n```"
export const fencedCodeBlock = fc
  .array(safeCodeContent, { minLength: 0, maxLength: 3 })
  .map((lines) => `\`\`\`\n${lines.join("\n")}${lines.length > 0 ? "\n" : ""}\`\`\``);

// Fenced code block with info string: "```lang\ncontent\n```"
export const safeInfoString = fc.stringMatching(/^[a-zA-Z]{1,10}$/);
export const fencedCodeBlockWithInfo = fc
  .tuple(safeInfoString, safeCodeContent)
  .map(([lang, code]) => `\`\`\`${lang}\n${code}\n\`\`\``);

// Block quote: one or more "> text" lines
export const blockQuoteBlock = fc
  .array(safeText, { minLength: 1, maxLength: 3 })
  .map((lines) => lines.map((t) => `> ${t}`).join("\n"));

// Full document: blocks joined by "\n\n"
export const markdownDoc = fc
  .array(
    fc.oneof(
      headingBlock,
      paragraphBlock,
      paragraphWithCodeSpan,
      paragraphWithEmphasis,
      paragraphWithStrong,
      paragraphWithHardBreak,
      paragraphWithLink,
      paragraphWithImage,
      bulletListBlock,
      orderedListBlock,
      thematicBreakBlock,
      fencedCodeBlock,
      fencedCodeBlockWithInfo,
      blockQuoteBlock,
    ),
    { minLength: 0, maxLength: 5 },
  )
  .map((blocks) => blocks.join("\n\n"));
