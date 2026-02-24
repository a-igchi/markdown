import { describe, it, expect } from "vitest";
import {
  isBlankLine,
  matchATXHeading,
  matchThematicBreak,
  matchListItemStart,
} from "./scanner.js";

describe("isBlankLine", () => {
  it("returns true for empty string", () => {
    expect(isBlankLine("")).toBe(true);
  });

  it("returns true for only spaces", () => {
    expect(isBlankLine("   ")).toBe(true);
  });

  it("returns true for only tabs", () => {
    expect(isBlankLine("\t\t")).toBe(true);
  });

  it("returns true for mixed whitespace", () => {
    expect(isBlankLine("  \t ")).toBe(true);
  });

  it("returns false for line with text", () => {
    expect(isBlankLine("hello")).toBe(false);
  });

  it("returns false for line with leading space then text", () => {
    expect(isBlankLine("  hello")).toBe(false);
  });
});

describe("matchATXHeading", () => {
  it("matches level 1 heading", () => {
    const result = matchATXHeading("# Hello");
    expect(result).not.toBeNull();
    expect(result!.level).toBe(1);
    expect(result!.indent).toBe("");
    expect(result!.hashes).toBe("#");
    expect(result!.spacesAfterHash).toBe(" ");
    expect(result!.content).toBe("Hello");
    expect(result!.closingHashes).toBe("");
    expect(result!.trailingSpaces).toBe("");
  });

  it("matches level 3 heading", () => {
    const result = matchATXHeading("### Heading");
    expect(result).not.toBeNull();
    expect(result!.level).toBe(3);
    expect(result!.hashes).toBe("###");
  });

  it("matches level 6 heading", () => {
    const result = matchATXHeading("###### Six");
    expect(result).not.toBeNull();
    expect(result!.level).toBe(6);
  });

  it("does not match 7 hashes", () => {
    expect(matchATXHeading("####### Seven")).toBeNull();
  });

  it("matches heading with 0-3 spaces indent", () => {
    expect(matchATXHeading(" # H")).not.toBeNull();
    expect(matchATXHeading("  # H")).not.toBeNull();
    expect(matchATXHeading("   # H")).not.toBeNull();
  });

  it("does not match 4+ spaces indent", () => {
    expect(matchATXHeading("    # H")).toBeNull();
  });

  it("matches heading with closing hashes", () => {
    const result = matchATXHeading("## Heading ##");
    expect(result).not.toBeNull();
    expect(result!.content).toBe("Heading");
    expect(result!.closingHashes).toBe("##");
  });

  it("matches heading with closing hashes and trailing spaces", () => {
    const result = matchATXHeading("# Title #  ");
    expect(result).not.toBeNull();
    expect(result!.content).toBe("Title");
    expect(result!.closingHashes).toBe("#");
    expect(result!.trailingSpaces).toBe("  ");
  });

  it("matches empty heading (hash only)", () => {
    const result = matchATXHeading("#");
    expect(result).not.toBeNull();
    expect(result!.content).toBe("");
    expect(result!.spacesAfterHash).toBe("");
  });

  it("matches empty heading with trailing space", () => {
    const result = matchATXHeading("# ");
    expect(result).not.toBeNull();
    expect(result!.content).toBe("");
    expect(result!.spacesAfterHash).toBe(" ");
  });

  it("requires space after hashes when content follows", () => {
    // "#Foo" is not a heading per CommonMark
    expect(matchATXHeading("#Foo")).toBeNull();
  });

  it("closing hashes need space before them", () => {
    // "# foo#" - the # is part of content, not closing
    const result = matchATXHeading("# foo#");
    expect(result).not.toBeNull();
    expect(result!.content).toBe("foo#");
    expect(result!.closingHashes).toBe("");
  });
});

describe("matchThematicBreak", () => {
  it("matches ---", () => {
    expect(matchThematicBreak("---")).not.toBeNull();
  });

  it("matches ***", () => {
    expect(matchThematicBreak("***")).not.toBeNull();
  });

  it("matches ___", () => {
    expect(matchThematicBreak("___")).not.toBeNull();
  });

  it("matches with spaces between", () => {
    expect(matchThematicBreak("- - -")).not.toBeNull();
    expect(matchThematicBreak("*  *  *")).not.toBeNull();
  });

  it("matches with more than 3 chars", () => {
    expect(matchThematicBreak("-----")).not.toBeNull();
  });

  it("matches with 0-3 spaces indent", () => {
    expect(matchThematicBreak(" ---")).not.toBeNull();
    expect(matchThematicBreak("  ---")).not.toBeNull();
    expect(matchThematicBreak("   ---")).not.toBeNull();
  });

  it("does not match 4+ spaces indent", () => {
    expect(matchThematicBreak("    ---")).toBeNull();
  });

  it("does not match mixed characters", () => {
    expect(matchThematicBreak("-*-")).toBeNull();
  });

  it("does not match fewer than 3 chars", () => {
    expect(matchThematicBreak("--")).toBeNull();
  });

  it("returns indent and chars", () => {
    const result = matchThematicBreak("  - - -  ");
    expect(result).not.toBeNull();
    expect(result!.indent).toBe("  ");
    expect(result!.chars).toBe("- - -  ");
  });
});

describe("matchListItemStart", () => {
  it("matches bullet - ", () => {
    const result = matchListItemStart("- item");
    expect(result).not.toBeNull();
    expect(result!.indent).toBe("");
    expect(result!.marker).toBe("- ");
    expect(result!.type).toBe("bullet");
  });

  it("matches bullet * ", () => {
    const result = matchListItemStart("* item");
    expect(result).not.toBeNull();
    expect(result!.marker).toBe("* ");
    expect(result!.type).toBe("bullet");
  });

  it("matches bullet + ", () => {
    const result = matchListItemStart("+ item");
    expect(result).not.toBeNull();
    expect(result!.marker).toBe("+ ");
    expect(result!.type).toBe("bullet");
  });

  it("matches ordered 1. ", () => {
    const result = matchListItemStart("1. item");
    expect(result).not.toBeNull();
    expect(result!.marker).toBe("1. ");
    expect(result!.type).toBe("ordered");
  });

  it("matches ordered 1) ", () => {
    const result = matchListItemStart("1) item");
    expect(result).not.toBeNull();
    expect(result!.marker).toBe("1) ");
    expect(result!.type).toBe("ordered");
  });

  it("matches ordered with larger numbers", () => {
    const result = matchListItemStart("123. item");
    expect(result).not.toBeNull();
    expect(result!.marker).toBe("123. ");
  });

  it("does not match ordered with 10+ digits", () => {
    expect(matchListItemStart("1234567890. item")).toBeNull();
  });

  it("matches with 0-3 spaces indent", () => {
    expect(matchListItemStart("   - item")).not.toBeNull();
    expect(matchListItemStart("   - item")!.indent).toBe("   ");
  });

  it("does not match 4+ spaces indent (becomes code block)", () => {
    expect(matchListItemStart("    - item")).toBeNull();
  });

  it("matches bullet followed by empty content", () => {
    const result = matchListItemStart("- ");
    expect(result).not.toBeNull();
    expect(result!.marker).toBe("- ");
  });

  it("requires space after bullet marker", () => {
    expect(matchListItemStart("-item")).toBeNull();
  });

  it("matches bullet with multiple spaces after marker", () => {
    const result = matchListItemStart("-  item");
    expect(result).not.toBeNull();
    expect(result!.marker).toBe("-  ");
  });
});
