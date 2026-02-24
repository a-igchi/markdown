import { describe, it, expect } from "vitest";
import { getListContinuation } from "./list-continuation.js";

describe("getListContinuation", () => {
  it("continues bullet list with -", () => {
    const value = "- item";
    const { insertion, cursorOffset } = getListContinuation(value, value.length);
    expect(insertion).toBe("\n- ");
    expect(cursorOffset).toBe(value.length + 3);
  });

  it("continues bullet list with *", () => {
    const value = "* item";
    const { insertion, cursorOffset } = getListContinuation(value, value.length);
    expect(insertion).toBe("\n* ");
    expect(cursorOffset).toBe(value.length + 3);
  });

  it("continues bullet list with +", () => {
    const value = "+ item";
    const { insertion, cursorOffset } = getListContinuation(value, value.length);
    expect(insertion).toBe("\n+ ");
    expect(cursorOffset).toBe(value.length + 3);
  });

  it("continues second item in multi-item list", () => {
    const value = "- item1\n- item2";
    const { insertion } = getListContinuation(value, value.length);
    expect(insertion).toBe("\n- ");
  });

  it("splits item when cursor is in the middle", () => {
    // "- ite|m1" → cursor at offset 5 (after "- ite")
    const value = "- item1";
    const { insertion } = getListContinuation(value, 5);
    expect(insertion).toBe("\n- ");
  });

  it("continues ordered list with .", () => {
    const value = "1. First\n2. Second";
    const { insertion, cursorOffset } = getListContinuation(value, value.length);
    expect(insertion).toBe("\n3. ");
    expect(cursorOffset).toBe(value.length + 4);
  });

  it("continues ordered list with )", () => {
    const value = "1) First\n2) Second";
    const { insertion, cursorOffset } = getListContinuation(value, value.length);
    expect(insertion).toBe("\n3) ");
    expect(cursorOffset).toBe(value.length + 4);
  });

  it("preserves indentation for nested bullet list", () => {
    const value = "- parent\n  - child";
    const { insertion } = getListContinuation(value, value.length);
    expect(insertion).toBe("\n  - ");
  });

  it("returns plain newline for paragraph", () => {
    const value = "Hello";
    const { insertion, cursorOffset } = getListContinuation(value, value.length);
    expect(insertion).toBe("\n");
    expect(cursorOffset).toBe(value.length + 1);
  });

  it("returns plain newline for heading", () => {
    const value = "# Title";
    const { insertion, cursorOffset } = getListContinuation(value, value.length);
    expect(insertion).toBe("\n");
    expect(cursorOffset).toBe(value.length + 1);
  });

  it("returns plain newline for empty document", () => {
    const { insertion, cursorOffset } = getListContinuation("", 0);
    expect(insertion).toBe("\n");
    expect(cursorOffset).toBe(1);
  });
});
