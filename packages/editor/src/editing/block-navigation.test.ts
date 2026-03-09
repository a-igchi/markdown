import { describe, it, expect, beforeEach } from "vitest";
import { isAtBlockStart, getPreviousBlock } from "./block-navigation.js";

function makeContainer(): HTMLDivElement {
  return document.createElement("div");
}

function setRange(node: Node, offset: number): Range {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
  return range;
}

describe("isAtBlockStart", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = makeContainer();
    document.body.appendChild(container);
  });

  it("returns false when cursor offset > 0 in text node", () => {
    container.innerHTML = "<p>hello</p>";
    const p = container.querySelector("p")!;
    const textNode = p.firstChild!;
    const range = setRange(textNode, 3);
    expect(isAtBlockStart(range, container)).toBe(false);
  });

  it("returns false when cursor is at start of first block (no previous block)", () => {
    container.innerHTML = "<p>hello</p>";
    const p = container.querySelector("p")!;
    const textNode = p.firstChild!;
    const range = setRange(textNode, 0);
    expect(isAtBlockStart(range, container)).toBe(false);
  });

  it("returns true when cursor is at start of second block", () => {
    container.innerHTML = "<p>first</p><p>second</p>";
    const ps = container.querySelectorAll("p");
    const secondP = ps[1];
    const textNode = secondP.firstChild!;
    const range = setRange(textNode, 0);
    expect(isAtBlockStart(range, container)).toBe(true);
  });

  it("returns true when cursor is on block element node directly (at offset 0)", () => {
    container.innerHTML = "<p>first</p><p>second</p>";
    const ps = container.querySelectorAll("p");
    const secondP = ps[1];
    // Cursor directly on the element node at offset 0
    const range = setRange(secondP, 0);
    expect(isAtBlockStart(range, container)).toBe(true);
  });

  it("returns false when cursor is on element node (block) that is the first block", () => {
    container.innerHTML = "<p>only</p>";
    const p = container.querySelector("p")!;
    const range = setRange(p, 0);
    expect(isAtBlockStart(range, container)).toBe(false);
  });

  it("returns false when node walks up without finding a block", () => {
    // cursor on container itself → the while loop exits at container
    const range = setRange(container, 0);
    expect(isAtBlockStart(range, container)).toBe(false);
  });

  it("returns false when cursor is in middle of inline element in first block", () => {
    container.innerHTML = "<p><em>text</em></p>";
    const em = container.querySelector("em")!;
    const textNode = em.firstChild!;
    const range = setRange(textNode, 2);
    expect(isAtBlockStart(range, container)).toBe(false);
  });

  it("returns true when cursor is at start of inline element in second block", () => {
    container.innerHTML = "<p>first</p><p><em>second</em></p>";
    const ps = container.querySelectorAll("p");
    const em = ps[1].querySelector("em")!;
    const textNode = em.firstChild!;
    const range = setRange(textNode, 0);
    expect(isAtBlockStart(range, container)).toBe(true);
  });

  it("returns false when first child check fails (cursor not at first child)", () => {
    container.innerHTML = "<p>first</p><p>A<em>B</em></p>";
    const ps = container.querySelectorAll("p");
    const em = ps[1].querySelector("em")!;
    const textNode = em.firstChild!;
    const range = setRange(textNode, 0);
    // em is not the first child of p (text "A" is first), so isAtBlockStart→false
    expect(isAtBlockStart(range, container)).toBe(false);
  });
});

describe("getPreviousBlock", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = makeContainer();
    document.body.appendChild(container);
  });

  it("returns previous sibling when it exists", () => {
    container.innerHTML = "<p>first</p><p>second</p>";
    const ps = container.querySelectorAll("p");
    const result = getPreviousBlock(ps[1] as HTMLElement, container);
    expect(result).toBe(ps[0]);
  });

  it("returns null for first block (no previous sibling)", () => {
    container.innerHTML = "<p>only</p>";
    const p = container.querySelector("p")!;
    const result = getPreviousBlock(p as HTMLElement, container);
    expect(result).toBeNull();
  });

  it("walks up through parent to find previous sibling", () => {
    container.innerHTML = "<div><p>first</p></div><div><p>second</p></div>";
    const divs = container.querySelectorAll("div");
    const innerP = divs[1].querySelector("p")!;
    // innerP has no previousElementSibling, so walk up to its parent div[1],
    // which has previousElementSibling div[0]
    const result = getPreviousBlock(innerP as HTMLElement, container);
    expect(result).toBe(divs[0]);
  });

  it("returns null when node is the container itself", () => {
    const result = getPreviousBlock(container, container);
    expect(result).toBeNull();
  });
});
