import { describe, it, expect } from "vitest";
import { splitBlock, mergeWithPreviousBlock, updateBlockContent } from "./operations.js";
import type { Document, Block, ModelCursor } from "./types.js";

// Helpers
const para = (content: string) => ({ type: "paragraph" as const, content });
const heading = (content: string) => ({ type: "heading" as const, content });
const blank = () => ({ type: "blank_line" as const, content: "" as const });
const list = (content: string) => ({ type: "list" as const, content });
const code = (content: string) => ({ type: "fenced_code_block" as const, content });
const quote = (content: string) => ({ type: "block_quote" as const, content });

function doc(...blocks: Block[]): Document {
  return { blocks };
}

// --- splitBlock ---

describe("splitBlock", () => {
  describe("paragraph", () => {
    it("splits paragraph at cursor in middle", () => {
      const d = doc(para("Hello World"));
      const cursor: ModelCursor = { blockIndex: 0, offset: 5 };
      const { newDoc, newCursor } = splitBlock(d, cursor);
      expect(newDoc.blocks).toEqual([para("Hello"), para(" World")]);
      expect(newCursor).toEqual({ blockIndex: 1, offset: 0 });
    });

    it("splits paragraph at start → empty para + original", () => {
      const d = doc(para("Hello"));
      const cursor: ModelCursor = { blockIndex: 0, offset: 0 };
      const { newDoc, newCursor } = splitBlock(d, cursor);
      expect(newDoc.blocks).toEqual([para(""), para("Hello")]);
      expect(newCursor).toEqual({ blockIndex: 1, offset: 0 });
    });

    it("splits paragraph at end → original + empty para", () => {
      const d = doc(para("Hello"));
      const cursor: ModelCursor = { blockIndex: 0, offset: 5 };
      const { newDoc, newCursor } = splitBlock(d, cursor);
      expect(newDoc.blocks).toEqual([para("Hello"), para("")]);
      expect(newCursor).toEqual({ blockIndex: 1, offset: 0 });
    });

    it("splits empty paragraph → blank_line + empty para", () => {
      const d = doc(para(""));
      const cursor: ModelCursor = { blockIndex: 0, offset: 0 };
      const { newDoc, newCursor } = splitBlock(d, cursor);
      expect(newDoc.blocks).toEqual([blank(), para("")]);
      expect(newCursor).toEqual({ blockIndex: 1, offset: 0 });
    });

    it("skips leading \\n on right side when cursor is before soft line break", () => {
      // "hoge\npiyo" offset=4 → cursor is before the \n
      // right side should be "piyo", not "\npiyo"
      const d = doc(para("hoge\npiyo"));
      const cursor: ModelCursor = { blockIndex: 0, offset: 4 };
      const { newDoc, newCursor } = splitBlock(d, cursor);
      expect(newDoc.blocks).toEqual([para("hoge"), para("piyo")]);
      expect(newCursor).toEqual({ blockIndex: 1, offset: 0 });
    });

    it("preserves other blocks around split", () => {
      const d = doc(para("Before"), blank(), para("Hello World"), blank(), para("After"));
      const cursor: ModelCursor = { blockIndex: 2, offset: 5 };
      const { newDoc } = splitBlock(d, cursor);
      expect(newDoc.blocks).toEqual([
        para("Before"),
        blank(),
        para("Hello"),
        para(" World"),
        blank(),
        para("After"),
      ]);
    });
  });

  describe("heading", () => {
    it("skips leading \\n on right side when cursor is before soft line break in heading", () => {
      // "## Title\nSecond" offset=8 → right should be "Second", not "\nSecond"
      const d = doc(heading("## Title\nSecond"));
      const cursor: ModelCursor = { blockIndex: 0, offset: 8 };
      const { newDoc, newCursor } = splitBlock(d, cursor);
      expect(newDoc.blocks).toEqual([heading("## Title"), para("Second")]);
      expect(newCursor).toEqual({ blockIndex: 1, offset: 0 });
    });

    it("splits heading at cursor", () => {
      const d = doc(heading("## Title"));
      const cursor: ModelCursor = { blockIndex: 0, offset: 8 };
      const { newDoc, newCursor } = splitBlock(d, cursor);
      expect(newDoc.blocks).toEqual([heading("## Title"), para("")]);
      expect(newCursor).toEqual({ blockIndex: 1, offset: 0 });
    });
  });

  describe("list", () => {
    it("inserts bullet list continuation at end of last item", () => {
      const d = doc(list("- a\n- b"));
      const cursor: ModelCursor = { blockIndex: 0, offset: 7 }; // end of "- b"
      const { newDoc, newCursor } = splitBlock(d, cursor);
      expect(newDoc.blocks).toEqual([list("- a\n- b\n- ")]);
      expect(newCursor).toEqual({ blockIndex: 0, offset: 10 });
    });

    it("inserts bullet list continuation at end of first item", () => {
      const d = doc(list("- a\n- b"));
      const cursor: ModelCursor = { blockIndex: 0, offset: 3 }; // at '\n' after "- a"
      const { newDoc, newCursor } = splitBlock(d, cursor);
      expect(newDoc.blocks).toEqual([list("- a\n- \n- b")]);
      expect(newCursor).toEqual({ blockIndex: 0, offset: 6 }); // after inserted "\n- "
    });

    it("inserts ordered list continuation", () => {
      const d = doc(list("1. foo\n2. bar"));
      const cursor: ModelCursor = { blockIndex: 0, offset: 13 }; // end
      const { newDoc, newCursor } = splitBlock(d, cursor);
      expect(newDoc.blocks).toEqual([list("1. foo\n2. bar\n3. ")]);
      expect(newCursor).toEqual({ blockIndex: 0, offset: 17 });
    });
  });

  describe("fenced_code_block", () => {
    it("inserts newline within code block", () => {
      const d = doc(code("```\ncode here\n```"));
      const cursor: ModelCursor = { blockIndex: 0, offset: 13 }; // after "code here"
      const { newDoc, newCursor } = splitBlock(d, cursor);
      expect(newDoc.blocks).toEqual([code("```\ncode here\n\n```")]);
      expect(newCursor).toEqual({ blockIndex: 0, offset: 14 });
    });
  });

  describe("block_quote", () => {
    it("inserts newline within block quote", () => {
      const d = doc(quote("> line1"));
      const cursor: ModelCursor = { blockIndex: 0, offset: 7 }; // end
      const { newDoc, newCursor } = splitBlock(d, cursor);
      expect(newDoc.blocks).toEqual([quote("> line1\n")]);
      expect(newCursor).toEqual({ blockIndex: 0, offset: 8 });
    });
  });

  describe("thematic_break", () => {
    it("inserts empty paragraph after thematic break on Enter", () => {
      const thematic = () => ({ type: "thematic_break" as const, content: "---" });
      const d = doc(thematic());
      const cursor: ModelCursor = { blockIndex: 0, offset: 3 };
      const { newDoc, newCursor } = splitBlock(d, cursor);
      expect(newDoc.blocks).toEqual([thematic(), para("")]);
      expect(newCursor).toEqual({ blockIndex: 1, offset: 0 });
    });
  });

  describe("list splitList fallback", () => {
    it("splits list content that doesn't match bullet or ordered pattern into two paragraphs", () => {
      // Content that looks like a list syntactically but at the cursor position
      // the current line doesn't match bullet/ordered → fallback
      const d = doc(list("not a list line"));
      const cursor: ModelCursor = { blockIndex: 0, offset: 7 };
      const { newDoc, newCursor } = splitBlock(d, cursor);
      // Falls through to fallback: split into two paragraphs
      expect(newDoc.blocks).toEqual([para("not a l"), para("ist line")]);
      expect(newCursor).toEqual({ blockIndex: 1, offset: 0 });
    });
  });
});

// --- mergeWithPreviousBlock ---

describe("mergeWithPreviousBlock", () => {
  it("deletes preceding blank_line when at start of content block", () => {
    const d = doc(para("Hello"), blank(), para("World"));
    const cursor: ModelCursor = { blockIndex: 2, offset: 0 };
    const { newDoc, newCursor } = mergeWithPreviousBlock(d, cursor);
    expect(newDoc.blocks).toEqual([para("Hello"), para("World")]);
    expect(newCursor).toEqual({ blockIndex: 1, offset: 0 });
  });

  it("deletes current blank_line and merges adjacent content blocks", () => {
    const d = doc(para("Hello"), blank(), para("World"));
    const cursor: ModelCursor = { blockIndex: 1, offset: 0 };
    const { newDoc, newCursor } = mergeWithPreviousBlock(d, cursor);
    // blank_line between two content blocks → merge them with "\n"
    expect(newDoc.blocks).toEqual([para("Hello\nWorld")]);
    expect(newCursor).toEqual({ blockIndex: 0, offset: 5 });
  });

  it("merges two adjacent content blocks", () => {
    const d = doc(para("Hello"), para("World"));
    const cursor: ModelCursor = { blockIndex: 1, offset: 0 };
    const { newDoc, newCursor } = mergeWithPreviousBlock(d, cursor);
    expect(newDoc.blocks).toEqual([para("HelloWorld")]);
    expect(newCursor).toEqual({ blockIndex: 0, offset: 5 });
  });

  it("does nothing at first block", () => {
    const d = doc(para("Hello"));
    const cursor: ModelCursor = { blockIndex: 0, offset: 0 };
    const { newDoc, newCursor } = mergeWithPreviousBlock(d, cursor);
    expect(newDoc).toEqual(d);
    expect(newCursor).toEqual(cursor);
  });

  it("merges list into paragraph before it", () => {
    const d = doc(para("Hello"), list("- a\n- b"));
    const cursor: ModelCursor = { blockIndex: 1, offset: 0 };
    const { newDoc, newCursor } = mergeWithPreviousBlock(d, cursor);
    expect(newDoc.blocks).toEqual([para("Hello- a\n- b")]);
    expect(newCursor).toEqual({ blockIndex: 0, offset: 5 });
  });
});

// --- updateBlockContent ---

describe("updateBlockContent", () => {
  it("updates content of a paragraph block", () => {
    const d = doc(para("Hello"));
    const newDoc = updateBlockContent(d, 0, "Hello World");
    expect(newDoc.blocks).toEqual([para("Hello World")]);
  });

  it("updates content preserving other blocks", () => {
    const d = doc(para("Hello"), blank(), para("World"));
    const newDoc = updateBlockContent(d, 2, "Updated");
    expect(newDoc.blocks).toEqual([para("Hello"), blank(), para("Updated")]);
  });

  it("blank_line becomes paragraph when given non-empty content", () => {
    const d = doc(para("Hello"), blank(), para("World"));
    const newDoc = updateBlockContent(d, 1, "Typed text");
    expect(newDoc.blocks[1]).toEqual(para("Typed text"));
  });

  it("blank_line stays blank_line when given empty content", () => {
    const d = doc(para("Hello"), blank(), para("World"));
    const newDoc = updateBlockContent(d, 1, "");
    expect(newDoc.blocks[1]).toEqual(blank());
  });

  it("preserves block type for non-blank blocks with empty content", () => {
    const d = doc(para("Hello"));
    const newDoc = updateBlockContent(d, 0, "");
    expect(newDoc.blocks[0]).toEqual(para(""));
  });
});
