import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { parse } from "parser-cst";
import {
  saveCursorAsOffset,
  restoreCursorFromOffset,
} from "../src/cursor/cursor.js";
import { markdownDoc } from "./arbitraries.js";
import { roundTrip, renderIntoContainer } from "./test-helpers.jsx";

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
      { numRuns: 200 },
    );
  });
});

describe("property-based: cursor save/restore", () => {
  beforeEach(() => {
    window.getSelection()?.removeAllRanges();
  });

  it("restoring then saving cursor offset is identity", () => {
    fc.assert(
      fc.property(
        markdownDoc.filter((s) => s.length > 0),
        fc.nat(),
        (md, rawOffset) => {
          const offset = rawOffset % (md.length + 1);
          const el = renderIntoContainer(md);
          restoreCursorFromOffset(el, offset);
          const restored = saveCursorAsOffset(el);
          expect(restored).toBe(offset);
        },
      ),
      { numRuns: 200 },
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
      { numRuns: 200 },
    );
  });
});
