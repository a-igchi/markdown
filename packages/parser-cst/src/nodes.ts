import { SyntaxKind } from "./syntax-kind.js";

export type SyntaxToken = {
  readonly kind: SyntaxKind;
  readonly text: string;
  readonly offset: number;
  readonly length: number;
};

export type SyntaxNode = {
  readonly kind: SyntaxKind;
  readonly children: ReadonlyArray<SyntaxElement>;
  readonly offset: number;
  readonly length: number;
};

export type SyntaxElement = SyntaxNode | SyntaxToken;

export const createToken = (
  kind: SyntaxKind,
  text: string,
  offset: number,
): SyntaxToken => ({
  kind,
  text,
  offset,
  length: text.length,
});

export const createNode = (
  kind: SyntaxKind,
  children: ReadonlyArray<SyntaxElement>,
  offset: number,
): SyntaxNode => ({
  kind,
  children,
  offset,
  length: children.reduce((sum, child) => sum + child.length, 0),
});

export const isToken = (element: SyntaxElement): element is SyntaxToken =>
  "text" in element;

export const isNode = (element: SyntaxElement): element is SyntaxNode =>
  "children" in element;

export const getText = (element: SyntaxElement): string => {
  if (isToken(element)) {
    return element.text;
  }
  return element.children.map(getText).join("");
};

export const findChildren = (
  node: SyntaxNode,
  kind: SyntaxKind,
): SyntaxElement[] => node.children.filter((child) => child.kind === kind);

export const findFirstToken = (
  node: SyntaxNode,
  kind: SyntaxKind,
): SyntaxToken | undefined => {
  for (const child of node.children) {
    if (isToken(child) && child.kind === kind) {
      return child;
    }
  }
  return undefined;
};
