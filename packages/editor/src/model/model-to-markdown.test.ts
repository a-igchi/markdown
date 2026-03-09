import { describe, it, expect } from "vitest";
import { modelToMarkdown } from "./model-to-markdown.js";
import type { Document } from "./types.js";

describe("modelToMarkdown", () => {
  it("empty document", () => {
    expect(modelToMarkdown({ blocks: [] })).toBe("");
  });

  it("single paragraph", () => {
    const doc: Document = { blocks: [{ type: "paragraph", content: "Hello" }] };
    expect(modelToMarkdown(doc)).toBe("Hello");
  });

  it("two paragraphs separated by blank_line", () => {
    const doc: Document = {
      blocks: [
        { type: "paragraph", content: "Hello" },
        { type: "blank_line", content: "" },
        { type: "paragraph", content: "World" },
      ],
    };
    expect(modelToMarkdown(doc)).toBe("Hello\n\nWorld");
  });

  it("three blank lines between paragraphs", () => {
    const doc: Document = {
      blocks: [
        { type: "paragraph", content: "Hello" },
        { type: "blank_line", content: "" },
        { type: "blank_line", content: "" },
        { type: "blank_line", content: "" },
        { type: "paragraph", content: "World" },
      ],
    };
    expect(modelToMarkdown(doc)).toBe("Hello\n\n\n\nWorld");
  });

  it("adjacent content blocks (no blank_line) get \\n\\n separator", () => {
    const doc: Document = {
      blocks: [
        { type: "paragraph", content: "Hello" },
        { type: "paragraph", content: "World" },
      ],
    };
    expect(modelToMarkdown(doc)).toBe("Hello\n\nWorld");
  });

  it("empty paragraph after paragraph", () => {
    const doc: Document = {
      blocks: [
        { type: "paragraph", content: "Hello" },
        { type: "paragraph", content: "" },
      ],
    };
    expect(modelToMarkdown(doc)).toBe("Hello\n\n");
  });

  it("paragraph followed by trailing blank_line", () => {
    const doc: Document = {
      blocks: [
        { type: "paragraph", content: "Hello" },
        { type: "blank_line", content: "" },
      ],
    };
    expect(modelToMarkdown(doc)).toBe("Hello\n\n");
  });

  it("heading", () => {
    const doc: Document = { blocks: [{ type: "heading", content: "## Title" }] };
    expect(modelToMarkdown(doc)).toBe("## Title");
  });

  it("thematic break", () => {
    const doc: Document = { blocks: [{ type: "thematic_break", content: "---" }] };
    expect(modelToMarkdown(doc)).toBe("---");
  });

  it("fenced code block", () => {
    const doc: Document = {
      blocks: [{ type: "fenced_code_block", content: "```\ncode\n```" }],
    };
    expect(modelToMarkdown(doc)).toBe("```\ncode\n```");
  });

  it("list", () => {
    const doc: Document = {
      blocks: [{ type: "list", content: "- a\n- b" }],
    };
    expect(modelToMarkdown(doc)).toBe("- a\n- b");
  });

  it("complex mixed document", () => {
    const doc: Document = {
      blocks: [
        { type: "heading", content: "# Title" },
        { type: "blank_line", content: "" },
        { type: "paragraph", content: "Hello" },
        { type: "blank_line", content: "" },
        { type: "thematic_break", content: "---" },
      ],
    };
    expect(modelToMarkdown(doc)).toBe("# Title\n\nHello\n\n---");
  });
});
