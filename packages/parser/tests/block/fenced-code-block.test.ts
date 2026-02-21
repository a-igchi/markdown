import { describe, it, expect } from "vitest";
import { parse, renderToHtml } from "../../src/index.js";

describe("Fenced Code Blocks", () => {
  // Example 119: Simple backtick fence
  it("should parse backtick fenced code block", () => {
    const doc = parse("```\nfoo\n```");
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].type).toBe("code_block");
    const cb = doc.children[0] as { type: "code_block"; info: string; value: string };
    expect(cb.value).toBe("foo\n");
    expect(cb.info).toBe("");
  });

  // Example 120: Simple tilde fence
  it("should parse tilde fenced code block", () => {
    const doc = parse("~~~\nfoo\n~~~");
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].type).toBe("code_block");
    const cb = doc.children[0] as { type: "code_block"; info: string; value: string };
    expect(cb.value).toBe("foo\n");
  });

  // Example 121: Fewer than 3 backticks is not a fence
  it("should not parse fewer than 3 backticks as fence", () => {
    const doc = parse("``\nfoo\n``");
    expect(doc.children[0].type).not.toBe("code_block");
  });

  // Example 122: Closing fence must be at least as long as opening
  it("should require closing fence at least as long as opening", () => {
    const doc = parse("````\nfoo\n```\n````");
    expect(doc.children).toHaveLength(1);
    const cb = doc.children[0] as { type: "code_block"; info: string; value: string };
    expect(cb.value).toBe("foo\n```\n");
  });

  // Example 130: Unclosed code block extends to end of document
  it("should extend to end of document if unclosed", () => {
    const doc = parse("```\nfoo");
    expect(doc.children).toHaveLength(1);
    const cb = doc.children[0] as { type: "code_block"; info: string; value: string };
    expect(cb.value).toBe("foo\n");
  });

  // Example 142: Info string
  it("should parse info string", () => {
    const doc = parse("```ruby\ndef foo\nend\n```");
    expect(doc.children).toHaveLength(1);
    const cb = doc.children[0] as { type: "code_block"; info: string; value: string };
    expect(cb.info).toBe("ruby");
    expect(cb.value).toBe("def foo\nend\n");
  });

  // Example 143: Info string with multiple words
  it("should use first word of info string for language class", () => {
    const doc = parse("```ruby startline=3\ndef foo\nend\n```");
    const cb = doc.children[0] as { type: "code_block"; info: string; value: string };
    expect(cb.info).toBe("ruby startline=3");
    expect(renderToHtml(doc)).toContain('class="language-ruby"');
  });

  // Example 145: Backtick fence info string cannot contain backticks
  it("should not allow backticks in backtick fence info string", () => {
    const doc = parse("``` foo`bar\nbaz\n```");
    expect(doc.children[0].type).not.toBe("code_block");
  });

  // Tilde fence info string can contain backticks
  it("should allow backticks in tilde fence info string", () => {
    const doc = parse("~~~ foo`bar\nbaz\n~~~");
    expect(doc.children).toHaveLength(1);
    const cb = doc.children[0] as { type: "code_block"; info: string; value: string };
    expect(cb.info).toBe("foo`bar");
  });

  // Example 132: Empty code block
  it("should parse empty code block", () => {
    const doc = parse("```\n```");
    expect(doc.children).toHaveLength(1);
    const cb = doc.children[0] as { type: "code_block"; info: string; value: string };
    expect(cb.value).toBe("");
  });

  // Example 136: Closing fence must not have an info string
  it("should not close if closing fence has words after it", () => {
    // Closing fence with trailing text after the fence chars is still a valid closing fence
    // according to CommonMark spec, trailing spaces/tabs are allowed but other chars are not
    const doc = parse("```\nfoo\n``` aaa\n```");
    const cb = doc.children[0] as { type: "code_block"; info: string; value: string };
    expect(cb.value).toBe("foo\n``` aaa\n");
  });

  // Multiple code blocks
  it("should parse multiple code blocks", () => {
    const doc = parse("```\nfoo\n```\n\n```\nbar\n```");
    const codeBlocks = doc.children.filter((n) => n.type === "code_block");
    expect(codeBlocks).toHaveLength(2);
  });

  // 1-3 spaces indent in opening fence
  it("should allow 1-3 spaces indent in opening fence", () => {
    const doc = parse("   ```\n   foo\n   ```");
    expect(doc.children).toHaveLength(1);
    const cb = doc.children[0] as { type: "code_block"; info: string; value: string };
    expect(cb.value).toBe("foo\n");
  });

  // HTML rendering
  it("should render as <pre><code>", () => {
    const doc = parse("```\nfoo\n```");
    expect(renderToHtml(doc)).toBe("<pre><code>foo\n</code></pre>\n");
  });

  it("should render with language class", () => {
    const doc = parse("```js\nconsole.log();\n```");
    expect(renderToHtml(doc)).toBe(
      '<pre><code class="language-js">console.log();\n</code></pre>\n',
    );
  });

  // HTML escaping in code blocks
  it("should escape HTML in code blocks", () => {
    const doc = parse("```\n<div>&</div>\n```");
    expect(renderToHtml(doc)).toContain("&lt;div&gt;&amp;&lt;/div&gt;");
  });

  // Source location
  it("should track source location", () => {
    const doc = parse("```\nfoo\n```");
    const cb = doc.children[0];
    expect(cb.sourceLocation.start).toEqual({ line: 1, column: 1, offset: 0 });
    expect(cb.sourceLocation.end.line).toBe(3);
  });
});
