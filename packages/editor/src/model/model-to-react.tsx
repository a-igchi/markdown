import React, { type ReactNode } from "react";
import { parse, isNode } from "parser-cst";
import { renderElement } from "../rendering/cst-to-react.js";
import type { Document } from "./types.js";

/**
 * Convert a Document Model into React elements for contentEditable rendering.
 *
 * Each block element gets a `data-block-index` attribute for cursor mapping.
 * Block content is parsed and rendered via the existing CST renderer.
 */
export function modelToReact(doc: Document): ReactNode[] {
  const blocks = doc.blocks;

  if (blocks.length === 0) {
    return [
      <p key="placeholder" data-block="paragraph" data-block-index={0}>
        <br />
      </p>,
    ];
  }

  const result: ReactNode[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const key = `b${i}`;

    if (block.type === "blank_line") {
      result.push(
        <div key={key} data-block="blank_line" data-block-index={i}>
          <br />
        </div>,
      );
      continue;
    }

    if (block.content === "") {
      // Empty content block → placeholder with <br>
      const tag = blockTag(block.type);
      result.push(
        React.createElement(tag, {
          key,
          "data-block": block.type,
          "data-block-index": i,
        }, <br />),
      );
      continue;
    }

    // Parse the block content and render via CST renderer
    const cst = parse(block.content);
    const blockNodes = cst.children.filter(isNode);

    if (blockNodes.length === 0) {
      // Fallback: plain text paragraph
      result.push(
        <p key={key} data-block="paragraph" data-block-index={i}>
          {block.content}
        </p>,
      );
      continue;
    }

    if (blockNodes.length === 1) {
      // Common case: one parsed block — clone with data-block-index
      const rendered = renderElement(blockNodes[0], key);
      if (React.isValidElement(rendered)) {
        result.push(
          React.cloneElement(rendered, { "data-block-index": i } as Record<string, unknown>),
        );
      } else {
        result.push(rendered);
      }
      continue;
    }

    // Multiple parsed blocks from one model block (e.g. content breaks into para+list).
    // Wrap in a plain <div> (no data-block attribute) so extractBlockText reads all content.
    const renderedParts = blockNodes.map((node, j) => renderElement(node, `${key}-${j}`));
    result.push(
      <div key={key} data-block-index={i}>
        {renderedParts}
      </div>,
    );
  }

  return result;
}

function blockTag(type: string): string {
  switch (type) {
    case "heading":
      return "div"; // Heading level determined by content parsing
    case "paragraph":
      return "p";
    case "thematic_break":
      return "div";
    case "list":
      return "ul";
    case "fenced_code_block":
      return "pre";
    case "block_quote":
      return "blockquote";
    default:
      return "p";
  }
}
