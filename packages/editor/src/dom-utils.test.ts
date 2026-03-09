import { describe, it, expect } from "vitest";
import { isLeafBlock, isPlaceholderBr, isContainerBlock } from "./dom-utils.js";

function makeBr(parentTag: string, siblings = 0): HTMLElement {
  const parent = document.createElement(parentTag);
  const br = document.createElement("br");
  parent.appendChild(br);
  for (let i = 0; i < siblings; i++) {
    parent.appendChild(document.createTextNode("x"));
  }
  return br;
}

describe("isPlaceholderBr", () => {
  it("returns true for <br> sole child of <div>", () => {
    const br = makeBr("div");
    expect(isPlaceholderBr(br)).toBe(true);
  });

  it("returns true for <br> sole child of <p>", () => {
    const br = makeBr("p");
    expect(isPlaceholderBr(br)).toBe(true);
  });

  it("returns true for <br> sole child of <li>", () => {
    const br = makeBr("li");
    expect(isPlaceholderBr(br)).toBe(true);
  });

  it("returns true for <br> sole child of <h1>", () => {
    const br = makeBr("h1");
    expect(isPlaceholderBr(br)).toBe(true);
  });

  it("returns true for <br> sole child of <h6>", () => {
    const br = makeBr("h6");
    expect(isPlaceholderBr(br)).toBe(true);
  });

  it("returns false when <br> has a sibling in the parent", () => {
    const br = makeBr("p", 1);
    expect(isPlaceholderBr(br)).toBe(false);
  });

  it("returns false when parent is <span> (not a block)", () => {
    const parent = document.createElement("span");
    const br = document.createElement("br");
    parent.appendChild(br);
    expect(isPlaceholderBr(br)).toBe(false);
  });

  it("returns false when br has no parent", () => {
    const br = document.createElement("br");
    expect(isPlaceholderBr(br)).toBe(false);
  });
});

describe("isLeafBlock", () => {
  it("returns true for h1-h6 tags", () => {
    for (const tag of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
      const el = document.createElement(tag);
      expect(isLeafBlock(tag, el)).toBe(true);
    }
  });

  it("returns true for <p>", () => {
    const el = document.createElement("p");
    expect(isLeafBlock("p", el)).toBe(true);
  });

  it("returns true for <pre>", () => {
    const el = document.createElement("pre");
    expect(isLeafBlock("pre", el)).toBe(true);
  });

  it("returns true for <div> with data-block attribute", () => {
    const el = document.createElement("div");
    el.dataset.block = "blank_line";
    expect(isLeafBlock("div", el)).toBe(true);
  });

  it("returns false for <div> without data-block attribute", () => {
    const el = document.createElement("div");
    expect(isLeafBlock("div", el)).toBe(false);
  });

  it("returns true for <li> with data-block attribute", () => {
    const el = document.createElement("li");
    el.dataset.block = "list_item";
    expect(isLeafBlock("li", el)).toBe(true);
  });

  it("returns false for <li> without data-block attribute", () => {
    const el = document.createElement("li");
    expect(isLeafBlock("li", el)).toBe(false);
  });
});

describe("isContainerBlock", () => {
  it("returns true for <ul>", () => {
    const el = document.createElement("ul");
    expect(isContainerBlock("ul", el)).toBe(true);
  });

  it("returns true for <ol>", () => {
    const el = document.createElement("ol");
    expect(isContainerBlock("ol", el)).toBe(true);
  });

  it("returns true for <blockquote>", () => {
    const el = document.createElement("blockquote");
    expect(isContainerBlock("blockquote", el)).toBe(true);
  });

  it("returns true for <li> without data-block", () => {
    const el = document.createElement("li");
    expect(isContainerBlock("li", el)).toBe(true);
  });

  it("returns false for <li> with data-block", () => {
    const el = document.createElement("li");
    el.dataset.block = "list_item";
    expect(isContainerBlock("li", el)).toBe(false);
  });

  it("returns false for <p>", () => {
    const el = document.createElement("p");
    expect(isContainerBlock("p", el)).toBe(false);
  });
});
