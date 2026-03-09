import type { Block, Document, ModelCursor } from "./types.js";
import { getLineAt } from "../editing/text-utils.js";

type SplitResult = { newDoc: Document; newCursor: ModelCursor };
type MergeResult = { newDoc: Document; newCursor: ModelCursor };

// --- splitBlock (Enter key) ---

/**
 * Split the block at the given cursor position (Enter key behavior).
 *
 * - paragraph/heading: split content into two blocks at cursor offset
 * - empty paragraph: convert to blank_line + empty paragraph
 * - list: insert list continuation text at cursor offset
 * - fenced_code_block/block_quote: insert a newline at cursor offset
 */
export function splitBlock(doc: Document, cursor: ModelCursor): SplitResult {
  const { blockIndex, offset } = cursor;
  const block = doc.blocks[blockIndex];

  switch (block.type) {
    case "paragraph":
      return splitParagraph(doc, blockIndex, block.content, offset);
    case "heading":
      return splitHeading(doc, blockIndex, block.content, offset);
    case "list":
      return splitList(doc, blockIndex, block.content, offset);
    case "fenced_code_block":
    case "block_quote":
      return insertNewlineInBlock(doc, blockIndex, block, offset);
    case "blank_line":
      // Pressing Enter on a blank_line: insert another blank_line after it
      return insertBlockAfter(doc, blockIndex, { type: "blank_line", content: "" }, {
        blockIndex: blockIndex + 1,
        offset: 0,
      });
    case "thematic_break":
      // Enter after thematic break: insert a new paragraph after
      return insertBlockAfter(doc, blockIndex, { type: "paragraph", content: "" }, {
        blockIndex: blockIndex + 1,
        offset: 0,
      });
  }
}

function splitParagraph(
  doc: Document,
  blockIndex: number,
  content: string,
  offset: number,
): SplitResult {
  // Empty paragraph → blank_line + new empty paragraph
  if (content === "") {
    const newBlocks = [
      ...doc.blocks.slice(0, blockIndex),
      { type: "blank_line" as const, content: "" as const },
      { type: "paragraph" as const, content: "" },
      ...doc.blocks.slice(blockIndex + 1),
    ];
    return {
      newDoc: { blocks: newBlocks },
      newCursor: { blockIndex: blockIndex + 1, offset: 0 },
    };
  }

  const left = content.slice(0, offset);
  const rightStart = content[offset] === "\n" ? offset + 1 : offset;
  const right = content.slice(rightStart);
  const newBlocks = [
    ...doc.blocks.slice(0, blockIndex),
    { type: "paragraph" as const, content: left },
    { type: "paragraph" as const, content: right },
    ...doc.blocks.slice(blockIndex + 1),
  ];
  return {
    newDoc: { blocks: newBlocks },
    newCursor: { blockIndex: blockIndex + 1, offset: 0 },
  };
}

function splitHeading(
  doc: Document,
  blockIndex: number,
  content: string,
  offset: number,
): SplitResult {
  const left = content.slice(0, offset);
  const rightStart = content[offset] === "\n" ? offset + 1 : offset;
  const right = content.slice(rightStart);
  // Right portion becomes a paragraph (heading markers only on first line)
  const newBlocks = [
    ...doc.blocks.slice(0, blockIndex),
    { type: "heading" as const, content: left },
    { type: "paragraph" as const, content: right },
    ...doc.blocks.slice(blockIndex + 1),
  ];
  return {
    newDoc: { blocks: newBlocks },
    newCursor: { blockIndex: blockIndex + 1, offset: 0 },
  };
}

function splitList(
  doc: Document,
  blockIndex: number,
  content: string,
  offset: number,
): SplitResult {
  const { fullLine } = getLineAt(content, offset);

  // Bullet list continuation
  const bulletMatch = fullLine.match(/^( {0,3})([-+*] +)/);
  if (bulletMatch) {
    const marker = bulletMatch[1] + bulletMatch[2];
    const insertion = "\n" + marker;
    const newContent = content.slice(0, offset) + insertion + content.slice(offset);
    const newBlocks = [
      ...doc.blocks.slice(0, blockIndex),
      { type: "list" as const, content: newContent },
      ...doc.blocks.slice(blockIndex + 1),
    ];
    return {
      newDoc: { blocks: newBlocks },
      newCursor: { blockIndex: blockIndex, offset: offset + insertion.length },
    };
  }

  // Ordered list continuation
  const orderedMatch = fullLine.match(/^( {0,3})(\d{1,9})([.)] +)/);
  if (orderedMatch) {
    const indent = orderedMatch[1];
    const nextNum = parseInt(orderedMatch[2], 10) + 1;
    const sepAndSpace = orderedMatch[3];
    const marker = indent + nextNum + sepAndSpace;
    const insertion = "\n" + marker;
    const newContent = content.slice(0, offset) + insertion + content.slice(offset);
    const newBlocks = [
      ...doc.blocks.slice(0, blockIndex),
      { type: "list" as const, content: newContent },
      ...doc.blocks.slice(blockIndex + 1),
    ];
    return {
      newDoc: { blocks: newBlocks },
      newCursor: { blockIndex: blockIndex, offset: offset + insertion.length },
    };
  }

  // Fallback: split block into two paragraphs
  const left = content.slice(0, offset);
  const right = content.slice(offset);
  const newBlocks = [
    ...doc.blocks.slice(0, blockIndex),
    { type: "paragraph" as const, content: left },
    { type: "paragraph" as const, content: right },
    ...doc.blocks.slice(blockIndex + 1),
  ];
  return {
    newDoc: { blocks: newBlocks },
    newCursor: { blockIndex: blockIndex + 1, offset: 0 },
  };
}

function insertNewlineInBlock(
  doc: Document,
  blockIndex: number,
  block: Block,
  offset: number,
): SplitResult {
  const content = block.content;
  const newContent = content.slice(0, offset) + "\n" + content.slice(offset);
  const newBlocks = [
    ...doc.blocks.slice(0, blockIndex),
    { ...block, content: newContent } as Block,
    ...doc.blocks.slice(blockIndex + 1),
  ];
  return {
    newDoc: { blocks: newBlocks },
    newCursor: { blockIndex: blockIndex, offset: offset + 1 },
  };
}

function insertBlockAfter(
  doc: Document,
  blockIndex: number,
  newBlock: Block,
  newCursor: ModelCursor,
): SplitResult {
  const newBlocks = [
    ...doc.blocks.slice(0, blockIndex + 1),
    newBlock,
    ...doc.blocks.slice(blockIndex + 1),
  ];
  return { newDoc: { blocks: newBlocks }, newCursor };
}

// --- mergeWithPreviousBlock (Backspace at block start) ---

/**
 * Merge the block at cursor.blockIndex with the block before it.
 *
 * - If previous block is blank_line → delete the blank_line
 * - If current block is blank_line → delete it
 * - Otherwise → append current block's content to previous block's content
 */
export function mergeWithPreviousBlock(doc: Document, cursor: ModelCursor): MergeResult {
  const { blockIndex } = cursor;

  if (blockIndex === 0) {
    return { newDoc: doc, newCursor: cursor };
  }

  const blocks = doc.blocks;
  const prevBlock = blocks[blockIndex - 1];
  const currBlock = blocks[blockIndex];

  // Current block is blank_line → if adjacent to two content blocks, merge them
  if (currBlock.type === "blank_line") {
    const prevBlock = blockIndex > 0 ? blocks[blockIndex - 1] : null;
    const nextBlock = blockIndex < blocks.length - 1 ? blocks[blockIndex + 1] : null;

    if (prevBlock && prevBlock.type !== "blank_line" && nextBlock && nextBlock.type !== "blank_line") {
      // Merge: delete blank_line AND join adjacent content blocks with "\n"
      const mergedContent = prevBlock.content + "\n" + nextBlock.content;
      const mergedBlock: Block = { ...prevBlock, content: mergedContent } as Block;
      const newBlocks = [
        ...blocks.slice(0, blockIndex - 1),
        mergedBlock,
        ...blocks.slice(blockIndex + 2),
      ];
      return {
        newDoc: { blocks: newBlocks },
        newCursor: { blockIndex: blockIndex - 1, offset: prevBlock.content.length },
      };
    }

    // At start or end of document: just delete blank_line,
    // cursor goes to end of previous content block (or offset 0 if no previous content block).
    const newBlocks = [...blocks.slice(0, blockIndex), ...blocks.slice(blockIndex + 1)];
    const newBi = Math.min(blockIndex - 1, newBlocks.length - 1);
    const newBiBlock = newBi >= 0 ? newBlocks[newBi] : null;
    const newOff = newBiBlock && newBiBlock.type !== "blank_line" ? newBiBlock.content.length : 0;
    return {
      newDoc: { blocks: newBlocks },
      newCursor: { blockIndex: Math.max(0, newBi), offset: newOff },
    };
  }

  // Previous block is blank_line → delete it, cursor stays at current block (now at blockIndex-1)
  if (prevBlock.type === "blank_line") {
    const newBlocks = [...blocks.slice(0, blockIndex - 1), ...blocks.slice(blockIndex)];
    return {
      newDoc: { blocks: newBlocks },
      newCursor: { blockIndex: blockIndex - 1, offset: 0 },
    };
  }

  // Merge: append current content to previous block's content
  const mergedContent = prevBlock.content + currBlock.content;
  const prevOffset = prevBlock.content.length;
  const mergedBlock: Block = { ...prevBlock, content: mergedContent } as Block;
  const newBlocks = [
    ...blocks.slice(0, blockIndex - 1),
    mergedBlock,
    ...blocks.slice(blockIndex + 1),
  ];
  return {
    newDoc: { blocks: newBlocks },
    newCursor: { blockIndex: blockIndex - 1, offset: prevOffset },
  };
}

// --- updateBlockContent (normal typing) ---

/**
 * Update the content of the block at blockIndex.
 *
 * - blank_line + non-empty content → converts to paragraph
 * - Otherwise: keep same block type with new content
 */
export function updateBlockContent(
  doc: Document,
  blockIndex: number,
  newContent: string,
): Document {
  const block = doc.blocks[blockIndex];
  let newBlock: Block;

  if (block.type === "blank_line" && newContent !== "") {
    newBlock = { type: "paragraph", content: newContent };
  } else if (block.type === "blank_line") {
    newBlock = { type: "blank_line", content: "" };
  } else {
    newBlock = { ...block, content: newContent } as Block;
  }

  const newBlocks = [
    ...doc.blocks.slice(0, blockIndex),
    newBlock,
    ...doc.blocks.slice(blockIndex + 1),
  ];
  return { blocks: newBlocks };
}
