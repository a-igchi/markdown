import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { parse } from "parser-cst";
import { cstToReact } from "../rendering/cst-to-react.js";
import {
  saveCursorAsOffset,
  restoreCursorFromOffset,
} from "../cursor/cursor.js";

describe("cursor edge cases", () => {
  it("cursor restore clamps to end when offset exceeds document", () => {
    const doc = parse("Hello\n");
    const elements = cstToReact(doc);
    const { container } = render(<div>{elements}</div>);
    const root = container.firstElementChild as HTMLElement;

    restoreCursorFromOffset(root, 6);
    const restored = saveCursorAsOffset(root);
    expect(restored).toBe(5);
  });
});
