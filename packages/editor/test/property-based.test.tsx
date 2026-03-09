import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { parse } from "parser-cst";
import { render } from "@testing-library/react";
import { cstToModel } from "../src/model/cst-to-model.js";
import { modelToMarkdown } from "../src/model/model-to-markdown.js";
import { modelToReact } from "../src/model/model-to-react.js";
import {
  saveDomCursorAsModelCursor,
  restoreModelCursorToDom,
} from "../src/model/cursor-mapping.js";
import type { ModelCursor } from "../src/model/types.js";
import { markdownDoc } from "./arbitraries.js";
import { roundTrip } from "./test-helpers.jsx";
import { fcOptions } from "./fc-config.js";

// --- Strip offset/length for structural AST comparison ---

function stripOffsets(node: unknown): unknown {
  if (typeof node !== "object" || node === null) return node;
  if (Array.isArray(node)) return node.map(stripOffsets);
  const obj = node as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (key === "offset" || key === "length") continue;
    result[key] = stripOffsets(obj[key]);
  }
  return result;
}

// --- Property-based tests ---

describe("property-based: extractText round-trip", () => {
  it("roundTrip(md) === md for generated markdown", () => {
    fc.assert(
      fc.property(markdownDoc, (md) => {
        expect(roundTrip(md)).toBe(md);
      }),
      fcOptions({ numRuns: 200 }),
    );
  });
});

describe("property-based: cursor save/restore", () => {
  beforeEach(() => {
    window.getSelection()?.removeAllRanges();
  });

  const docWithCursorArb = markdownDoc
    .filter((s) => s.length > 0)
    .map((md) => cstToModel(parse(md)))
    .filter((doc) => doc.blocks.length > 0)
    .chain((doc) =>
      fc.integer({ min: 0, max: doc.blocks.length - 1 }).chain((blockIndex) => {
        const block = doc.blocks[blockIndex];
        const maxOffset = block.type === "blank_line" ? 0 : block.content.length;
        return fc
          .integer({ min: 0, max: maxOffset })
          .map((offset) => ({ doc, cursor: { blockIndex, offset } as ModelCursor }));
      }),
    );

  it("restoring then saving model cursor is identity", () => {
    fc.assert(
      fc.property(docWithCursorArb, ({ doc, cursor }) => {
        const elements = modelToReact(doc);
        const { container } = render(
          <div contentEditable suppressContentEditableWarning>{elements}</div>,
        );
        const el = container.firstElementChild as HTMLElement;
        restoreModelCursorToDom(el, cursor);
        const restored = saveDomCursorAsModelCursor(el);
        expect(restored).toEqual(cursor);
      }),
      fcOptions({ numRuns: 200 }),
    );
  });
});

describe("property-based: parse idempotency", () => {
  it("parse(roundTrip(md)) has same structure as parse(md)", () => {
    fc.assert(
      fc.property(markdownDoc, (md) => {
        const ast1 = parse(md);
        const rt = roundTrip(md);
        const ast2 = parse(rt);
        expect(stripOffsets(ast2)).toEqual(stripOffsets(ast1));
      }),
      fcOptions({ numRuns: 200 }),
    );
  });
});

describe("property-based: model roundtrip", () => {
  it("modelToMarkdown(cstToModel(parse(md))) === md for generated markdown", () => {
    fc.assert(
      fc.property(markdownDoc, (md) => {
        expect(modelToMarkdown(cstToModel(parse(md)))).toBe(md);
      }),
      fcOptions({ numRuns: 200 }),
    );
  });
});
