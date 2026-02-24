import { describe, it, expect } from "vitest";
import { SyntaxKind } from "./syntax-kind.js";
import {
  createToken,
  createNode,
  isToken,
  isNode,
  getText,
  findChildren,
  findFirstToken,
  type SyntaxToken,
  type SyntaxNode,
  type SyntaxElement,
} from "./nodes.js";

describe("createToken", () => {
  it("creates a token with correct properties", () => {
    const token = createToken(SyntaxKind.TEXT, "hello", 0);
    expect(token.kind).toBe(SyntaxKind.TEXT);
    expect(token.text).toBe("hello");
    expect(token.offset).toBe(0);
    expect(token.length).toBe(5);
  });

  it("calculates length from text", () => {
    const token = createToken(SyntaxKind.HASH, "##", 3);
    expect(token.length).toBe(2);
    expect(token.offset).toBe(3);
  });
});

describe("createNode", () => {
  it("creates a node with children", () => {
    const child1 = createToken(SyntaxKind.HASH, "#", 0);
    const child2 = createToken(SyntaxKind.WHITESPACE, " ", 1);
    const child3 = createToken(SyntaxKind.TEXT, "hi", 2);
    const node = createNode(SyntaxKind.ATX_HEADING, [child1, child2, child3], 0);

    expect(node.kind).toBe(SyntaxKind.ATX_HEADING);
    expect(node.children).toHaveLength(3);
    expect(node.offset).toBe(0);
    expect(node.length).toBe(4); // 1 + 1 + 2
  });

  it("handles empty children", () => {
    const node = createNode(SyntaxKind.DOCUMENT, [], 0);
    expect(node.children).toHaveLength(0);
    expect(node.length).toBe(0);
  });
});

describe("isToken / isNode", () => {
  it("distinguishes tokens from nodes", () => {
    const token = createToken(SyntaxKind.TEXT, "x", 0);
    const node = createNode(SyntaxKind.PARAGRAPH, [token], 0);

    expect(isToken(token)).toBe(true);
    expect(isNode(token)).toBe(false);
    expect(isToken(node)).toBe(false);
    expect(isNode(node)).toBe(true);
  });
});

describe("getText", () => {
  it("returns text for a token", () => {
    const token = createToken(SyntaxKind.TEXT, "hello", 0);
    expect(getText(token)).toBe("hello");
  });

  it("concatenates children text for a node", () => {
    const hash = createToken(SyntaxKind.HASH, "#", 0);
    const space = createToken(SyntaxKind.WHITESPACE, " ", 1);
    const text = createToken(SyntaxKind.TEXT, "title", 2);
    const newline = createToken(SyntaxKind.NEWLINE, "\n", 7);
    const heading = createNode(SyntaxKind.ATX_HEADING, [hash, space, text, newline], 0);

    expect(getText(heading)).toBe("# title\n");
  });

  it("works recursively with nested nodes", () => {
    const text = createToken(SyntaxKind.TEXT, "item", 0);
    const para = createNode(SyntaxKind.PARAGRAPH, [text], 0);
    const marker = createToken(SyntaxKind.MARKER, "- ", 0);
    const listItem = createNode(SyntaxKind.LIST_ITEM, [marker, para], 0);

    expect(getText(listItem)).toBe("- item");
  });
});

describe("findChildren", () => {
  it("finds children by kind", () => {
    const hash = createToken(SyntaxKind.HASH, "#", 0);
    const space = createToken(SyntaxKind.WHITESPACE, " ", 1);
    const text = createToken(SyntaxKind.TEXT, "title", 2);
    const heading = createNode(SyntaxKind.ATX_HEADING, [hash, space, text], 0);

    const whitespaces = findChildren(heading, SyntaxKind.WHITESPACE);
    expect(whitespaces).toHaveLength(1);
    expect(whitespaces[0]).toBe(space);
  });

  it("returns empty array when no match", () => {
    const text = createToken(SyntaxKind.TEXT, "hello", 0);
    const para = createNode(SyntaxKind.PARAGRAPH, [text], 0);

    expect(findChildren(para, SyntaxKind.HASH)).toHaveLength(0);
  });
});

describe("findFirstToken", () => {
  it("finds first token of given kind", () => {
    const hash = createToken(SyntaxKind.HASH, "#", 0);
    const space = createToken(SyntaxKind.WHITESPACE, " ", 1);
    const text = createToken(SyntaxKind.TEXT, "title", 2);
    const heading = createNode(SyntaxKind.ATX_HEADING, [hash, space, text], 0);

    expect(findFirstToken(heading, SyntaxKind.TEXT)).toBe(text);
  });

  it("returns undefined when not found", () => {
    const text = createToken(SyntaxKind.TEXT, "hello", 0);
    const para = createNode(SyntaxKind.PARAGRAPH, [text], 0);

    expect(findFirstToken(para, SyntaxKind.HASH)).toBeUndefined();
  });
});
