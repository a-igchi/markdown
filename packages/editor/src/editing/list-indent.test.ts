import { describe, it, expect } from "vitest";
import { indentListItem, dedentListItem } from "./list-indent.js";

describe("indentListItem", () => {
  it("indents a bullet list item by 2 spaces", () => {
    const result = indentListItem("- item", 6);
    expect(result).toEqual({ newValue: "  - item", newOffset: 8 });
  });

  it("indents the second line in multi-line value", () => {
    const result = indentListItem("- a\n- b", 7);
    expect(result).toEqual({ newValue: "- a\n  - b", newOffset: 9 });
  });

  it("indents an ordered list item", () => {
    const result = indentListItem("1. item", 7);
    expect(result).toEqual({ newValue: "  1. item", newOffset: 9 });
  });

  it("returns null for non-list line", () => {
    expect(indentListItem("Hello", 5)).toBeNull();
  });

  it("works when cursor is at line start", () => {
    const result = indentListItem("- item", 0);
    expect(result).toEqual({ newValue: "  - item", newOffset: 2 });
  });

  it("indents already-indented list item further", () => {
    const result = indentListItem("  - item", 8);
    expect(result).toEqual({ newValue: "    - item", newOffset: 10 });
  });
});

describe("dedentListItem", () => {
  it("dedents an indented bullet list item by 2 spaces", () => {
    const result = dedentListItem("  - item", 8);
    expect(result).toEqual({ newValue: "- item", newOffset: 6 });
  });

  it("dedents by 2 from 4-space indent", () => {
    const result = dedentListItem("    - item", 10);
    expect(result).toEqual({ newValue: "  - item", newOffset: 8 });
  });

  it("returns null when no leading spaces", () => {
    expect(dedentListItem("- item", 6)).toBeNull();
  });

  it("returns null for non-list line", () => {
    expect(dedentListItem("Hello", 5)).toBeNull();
  });

  it("removes only 1 space if line has 1-space indent", () => {
    const result = dedentListItem(" - item", 7);
    expect(result).toEqual({ newValue: "- item", newOffset: 6 });
  });

  it("clamps offset to lineStart when cursor is near beginning", () => {
    // Cursor at offset 1 (within the leading spaces), after dedent lineStart=0
    const result = dedentListItem("  - item", 1);
    expect(result).toEqual({ newValue: "- item", newOffset: 0 });
  });

  it("dedents second line in multi-line value", () => {
    const result = dedentListItem("- a\n  - b", 9);
    expect(result).toEqual({ newValue: "- a\n- b", newOffset: 7 });
  });
});
