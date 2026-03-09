import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { modelToReact } from "./model-to-react.js";
import type { Document } from "./types.js";

function renderDoc(doc: Document): HTMLElement {
  const elements = modelToReact(doc);
  const { container } = render(<div>{elements}</div>);
  return container.firstElementChild as HTMLElement;
}

describe("modelToReact", () => {
  it("renders placeholder for empty document (0 blocks)", () => {
    const doc: Document = { blocks: [] };
    const el = renderDoc(doc);
    const p = el.querySelector("p");
    expect(p).not.toBeNull();
    expect(p!.dataset.block).toBe("paragraph");
    expect(p!.dataset.blockIndex).toBe("0");
    // Should have a <br> as placeholder
    expect(p!.querySelector("br")).not.toBeNull();
  });

  it("renders blank_line block as div with br", () => {
    const doc: Document = { blocks: [{ type: "blank_line", content: "" }] };
    const el = renderDoc(doc);
    const div = el.querySelector("[data-block='blank_line']");
    expect(div).not.toBeNull();
    expect(div!.dataset.blockIndex).toBe("0");
  });

  it("renders empty paragraph block with placeholder br", () => {
    const doc: Document = { blocks: [{ type: "paragraph", content: "" }] };
    const el = renderDoc(doc);
    const p = el.querySelector("p");
    expect(p).not.toBeNull();
    expect(p!.querySelector("br")).not.toBeNull();
  });

  it("renders empty heading block with placeholder br as div (heading tag from content)", () => {
    const doc: Document = { blocks: [{ type: "heading", content: "" }] };
    const el = renderDoc(doc);
    // blockTag("heading") returns "div"
    const div = el.querySelector("div");
    expect(div).not.toBeNull();
    expect(div!.dataset.block).toBe("heading");
    expect(div!.querySelector("br")).not.toBeNull();
  });

  it("renders empty thematic_break block with placeholder br", () => {
    const doc: Document = { blocks: [{ type: "thematic_break", content: "" }] };
    const el = renderDoc(doc);
    const div = el.querySelector("[data-block='thematic_break']");
    expect(div).not.toBeNull();
    expect(div!.querySelector("br")).not.toBeNull();
  });

  it("renders empty list block with placeholder br in ul", () => {
    const doc: Document = { blocks: [{ type: "list", content: "" }] };
    const el = renderDoc(doc);
    const ul = el.querySelector("ul");
    expect(ul).not.toBeNull();
    expect(ul!.querySelector("br")).not.toBeNull();
  });

  it("renders empty fenced_code_block with placeholder br in pre", () => {
    const doc: Document = { blocks: [{ type: "fenced_code_block", content: "" }] };
    const el = renderDoc(doc);
    const pre = el.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre!.querySelector("br")).not.toBeNull();
  });

  it("renders empty block_quote with placeholder br in blockquote", () => {
    const doc: Document = { blocks: [{ type: "block_quote", content: "" }] };
    const el = renderDoc(doc);
    const bq = el.querySelector("blockquote");
    expect(bq).not.toBeNull();
    expect(bq!.querySelector("br")).not.toBeNull();
  });

  it("renders paragraph with content via CST", () => {
    const doc: Document = { blocks: [{ type: "paragraph", content: "Hello world" }] };
    const el = renderDoc(doc);
    const p = el.querySelector("p");
    expect(p).not.toBeNull();
    expect(p!.textContent).toBe("Hello world");
    expect(p!.dataset.blockIndex).toBe("0");
  });

  it("renders data-block-index for each block", () => {
    const doc: Document = {
      blocks: [
        { type: "paragraph", content: "First" },
        { type: "blank_line", content: "" },
        { type: "paragraph", content: "Second" },
      ],
    };
    const el = renderDoc(doc);
    const indexed = el.querySelectorAll("[data-block-index]");
    expect(indexed.length).toBeGreaterThanOrEqual(3);
  });

  it("handles unknown block type via default blockTag (returns p)", () => {
    // Force an unknown type through blockTag's default branch
    const doc = {
      blocks: [{ type: "unknown_type" as "paragraph", content: "" }],
    } as Document;
    const el = renderDoc(doc);
    // default branch returns "p"
    expect(el.children.length).toBeGreaterThan(0);
  });

  it("renders fallback plain text paragraph when parse produces no block nodes", () => {
    // Content that produces only tokens (no nodes) when parsed → blockNodes.length === 0
    // A single newline parses to BLANK_LINE token only, no block nodes
    const doc: Document = { blocks: [{ type: "paragraph", content: "\n" }] };
    const el = renderDoc(doc);
    // Fallback: plain text wrapped in <p data-block="paragraph">
    const p = el.querySelector("p");
    expect(p).not.toBeNull();
    expect(p!.dataset.block).toBe("paragraph");
  });
});
