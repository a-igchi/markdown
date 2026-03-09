import { describe, it, expect } from "vitest";
import { parse } from "parser-cst";
import { cstToModel } from "./cst-to-model.js";

describe("cstToModel", () => {
  it("empty document", () => {
    expect(cstToModel(parse(""))).toEqual({ blocks: [] });
  });

  it("single paragraph", () => {
    expect(cstToModel(parse("Hello world"))).toEqual({
      blocks: [{ type: "paragraph", content: "Hello world" }],
    });
  });

  it("two paragraphs separated by blank line", () => {
    expect(cstToModel(parse("Hello\n\nWorld"))).toEqual({
      blocks: [
        { type: "paragraph", content: "Hello" },
        { type: "blank_line", content: "" },
        { type: "paragraph", content: "World" },
      ],
    });
  });

  it("multiple consecutive blank lines", () => {
    expect(cstToModel(parse("Hello\n\n\n\nWorld"))).toEqual({
      blocks: [
        { type: "paragraph", content: "Hello" },
        { type: "blank_line", content: "" },
        { type: "blank_line", content: "" },
        { type: "blank_line", content: "" },
        { type: "paragraph", content: "World" },
      ],
    });
  });

  it("ATX heading", () => {
    expect(cstToModel(parse("## Title"))).toEqual({
      blocks: [{ type: "heading", content: "## Title" }],
    });
  });

  it("thematic break", () => {
    expect(cstToModel(parse("---"))).toEqual({
      blocks: [{ type: "thematic_break", content: "---" }],
    });
  });

  it("fenced code block", () => {
    expect(cstToModel(parse("```\ncode\n```"))).toEqual({
      blocks: [{ type: "fenced_code_block", content: "```\ncode\n```" }],
    });
  });

  it("block quote", () => {
    expect(cstToModel(parse("> quote"))).toEqual({
      blocks: [{ type: "block_quote", content: "> quote" }],
    });
  });

  it("bullet list", () => {
    expect(cstToModel(parse("- a\n- b"))).toEqual({
      blocks: [{ type: "list", content: "- a\n- b" }],
    });
  });

  it("ordered list", () => {
    expect(cstToModel(parse("1. foo\n2. bar"))).toEqual({
      blocks: [{ type: "list", content: "1. foo\n2. bar" }],
    });
  });

  it("paragraph with trailing newline strips it", () => {
    expect(cstToModel(parse("Hello\n\nWorld"))).toEqual({
      blocks: [
        { type: "paragraph", content: "Hello" },
        { type: "blank_line", content: "" },
        { type: "paragraph", content: "World" },
      ],
    });
  });

  it("mixed blocks", () => {
    const md = "# Title\n\n---\n\nParagraph";
    expect(cstToModel(parse(md))).toEqual({
      blocks: [
        { type: "heading", content: "# Title" },
        { type: "blank_line", content: "" },
        { type: "thematic_break", content: "---" },
        { type: "blank_line", content: "" },
        { type: "paragraph", content: "Paragraph" },
      ],
    });
  });
});
