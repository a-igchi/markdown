import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { parse, getText } from "../../parser/dist/index.js";
import { cstToReact } from "../src/rendering/cst-to-react.js";
import { extractText } from "../src/text-extraction/extract-text.js";
import { Editor } from "../src/index.js";

function roundTrip(source: string): string {
  const doc = parse(source);
  const elements = cstToReact(doc);
  const { container } = render(<div>{elements}</div>);
  return extractText(container.firstElementChild as HTMLElement);
}

describe("integration: CST round-trip", () => {
  it("round-trips a complex document", () => {
    const source =
      "# Title\n\nSome text here.\n\n- item 1\n- item 2\n\n---\n\n1. one\n2. two\n\n## Subtitle\n\nAnother paragraph.";
    expect(roundTrip(source)).toBe(source);
  });

  it("round-trips heading + paragraph", () => {
    const source = "# Hello\n\nWorld";
    expect(roundTrip(source)).toBe(source);
  });

  it("round-trips multiline paragraph", () => {
    const source = "Line 1\nLine 2\nLine 3";
    expect(roundTrip(source)).toBe(source);
  });

  it("round-trips nested lists", () => {
    const source = "- parent\n  - child1\n  - child2";
    expect(roundTrip(source)).toBe(source);
  });

  it("round-trips loose list", () => {
    const source = "- item1\n\n- item2";
    expect(roundTrip(source)).toBe(source);
  });

  it("CST getText matches original source", () => {
    const source = "# Title\n\nParagraph text.\n\n- list1\n- list2\n\n---";
    const doc = parse(source);
    expect(getText(doc)).toBe(source);
  });

  it("CST round-trip: parse → getText === source", () => {
    const source =
      "# Heading\n\nSome paragraph.\n\n- a\n- b\n\n1. x\n2. y\n\n***";
    const doc = parse(source);
    expect(getText(doc)).toBe(source);
  });
});

describe("integration: Editor component", () => {
  it("renders and extracts a complex document correctly", () => {
    const source = "# Title\n\nParagraph\n\n- item1\n- item2\n\n---";
    const { container } = render(
      <Editor value={source} onChange={() => {}} />,
    );

    const editable = container.querySelector("[contenteditable]")!;
    expect(editable.querySelector("h1")).not.toBeNull();
    expect(editable.querySelector("p")).not.toBeNull();
    expect(editable.querySelector("ul")).not.toBeNull();
    expect(editable.querySelectorAll("li").length).toBe(2);
    expect(
      editable.querySelector("[data-block='thematic_break']"),
    ).not.toBeNull();
  });

  it("handles Enter key in a complex document", () => {
    const onChange = vi.fn();
    const source = "# Title\n\nHello";
    const { container } = render(
      <Editor value={source} onChange={onChange} />,
    );
    const editable = container.querySelector("[contenteditable]")!;

    // Place cursor at end of "Hello"
    const p = editable.querySelector("p")!;
    const textNode = p.firstChild!;
    const range = document.createRange();
    range.setStart(textNode, 5);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);

    fireEvent.keyDown(editable, { key: "Enter" });

    expect(onChange).toHaveBeenCalled();
    const newValue = onChange.mock.calls[0][0];
    expect(newValue).toContain("\n\n");
  });
});
