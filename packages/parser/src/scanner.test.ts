import { describe, it, expect } from "vitest";
import {
  isBlankLine,
  matchATXHeading,
  matchThematicBreak,
  matchListItemStart,
  matchCodeFence,
  isClosingCodeFence,
  matchBlockQuote,
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

  it("greedy match: content with internal # and closing hashes", () => {
    const result = matchATXHeading("# foo # bar ##");
    expect(result).not.toBeNull();
    expect(result!.content).toBe("foo # bar");
    expect(result!.closingHashes).toBe("##");
  });

  it("no closing hash when # not preceded by space at end", () => {
    const result = matchATXHeading("# foo#bar");
    expect(result).not.toBeNull();
    expect(result!.content).toBe("foo#bar");
    expect(result!.closingHashes).toBe("");
  });

  it("space-hash in middle is not closing if not at end", () => {
    const result = matchATXHeading("# foo ## bar");
    expect(result).not.toBeNull();
    expect(result!.content).toBe("foo ## bar");
    expect(result!.closingHashes).toBe("");
  });

  it("hash-only content after space is content, not closing", () => {
    // "# #" → rest is "#", closing hash requires space before it
    const result = matchATXHeading("# #");
    expect(result).not.toBeNull();
    expect(result!.content).toBe("#");
    expect(result!.closingHashes).toBe("");
  });

  it("content with ## and closing ##", () => {
    const result = matchATXHeading("## foo ## ##");
    expect(result).not.toBeNull();
    expect(result!.content).toBe("foo ##");
    expect(result!.closingHashes).toBe("##");
  });

  it("backslash before # in content", () => {
    const result = matchATXHeading("# foo \\#");
    expect(result).not.toBeNull();
    // \\# doesn't match (#+)$ because \\ is not #, so it stays in content
    expect(result!.content).toBe("foo \\#");
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

describe("matchCodeFence", () => {
  it("matches triple backtick fence", () => {
    const result = matchCodeFence("```");
    expect(result).not.toBeNull();
    expect(result!.fence).toBe("```");
    expect(result!.char).toBe("`");
    expect(result!.fenceLength).toBe(3);
    expect(result!.info).toBe("");
  });

  it("matches triple tilde fence", () => {
    const result = matchCodeFence("~~~");
    expect(result).not.toBeNull();
    expect(result!.char).toBe("~");
  });

  it("matches fence with info string", () => {
    const result = matchCodeFence("```js");
    expect(result).not.toBeNull();
    expect(result!.fence).toBe("```");
    expect(result!.info).toBe("js");
  });

  it("matches fence with 0-3 spaces indent", () => {
    expect(matchCodeFence("   ```")).not.toBeNull();
    expect(matchCodeFence("   ```")!.indent).toBe("   ");
  });

  it("does not match 4+ spaces indent", () => {
    expect(matchCodeFence("    ```")).toBeNull();
  });

  it("does not match fewer than 3 backticks", () => {
    expect(matchCodeFence("``")).toBeNull();
  });

  it("matches 4+ backticks", () => {
    const result = matchCodeFence("````");
    expect(result).not.toBeNull();
    expect(result!.fenceLength).toBe(4);
  });

  it("rejects backtick fence with backtick in info string", () => {
    expect(matchCodeFence("``` foo`bar")).toBeNull();
  });

  it("allows tilde fence with backtick in info string", () => {
    const result = matchCodeFence("~~~ foo`bar");
    expect(result).not.toBeNull();
    expect(result!.info).toBe(" foo`bar");
  });
});

describe("isClosingCodeFence", () => {
  it("matches closing backtick fence", () => {
    expect(isClosingCodeFence("```", "`", 3)).toBe(true);
  });

  it("matches closing tilde fence", () => {
    expect(isClosingCodeFence("~~~", "~", 3)).toBe(true);
  });

  it("requires same or more chars than opening", () => {
    expect(isClosingCodeFence("```", "`", 4)).toBe(false);
    expect(isClosingCodeFence("````", "`", 3)).toBe(true);
  });

  it("rejects closing fence with info string", () => {
    expect(isClosingCodeFence("``` js", "`", 3)).toBe(false);
  });

  it("allows trailing spaces", () => {
    expect(isClosingCodeFence("```   ", "`", 3)).toBe(true);
  });

  it("rejects wrong character type", () => {
    expect(isClosingCodeFence("~~~", "`", 3)).toBe(false);
    expect(isClosingCodeFence("```", "~", 3)).toBe(false);
  });

  it("matches with 0-3 spaces indent", () => {
    expect(isClosingCodeFence("   ```", "`", 3)).toBe(true);
  });

  it("rejects 4+ spaces indent", () => {
    expect(isClosingCodeFence("    ```", "`", 3)).toBe(false);
  });
});

describe("matchBlockQuote", () => {
  it("matches > prefix", () => {
    const result = matchBlockQuote("> foo");
    expect(result).not.toBeNull();
    expect(result!.marker).toBe("> ");
  });

  it("matches > without trailing space", () => {
    const result = matchBlockQuote(">foo");
    expect(result).not.toBeNull();
    expect(result!.marker).toBe(">");
  });

  it("matches with 0-3 spaces indent", () => {
    const result = matchBlockQuote("   > foo");
    expect(result).not.toBeNull();
    expect(result!.marker).toBe("   > ");
  });

  it("does not match 4+ spaces indent", () => {
    expect(matchBlockQuote("    > foo")).toBeNull();
  });

  it("does not match lines without >", () => {
    expect(matchBlockQuote("foo")).toBeNull();
    expect(matchBlockQuote("")).toBeNull();
  });
});
