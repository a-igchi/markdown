import { test, expect } from "@playwright/test";
import { EditorHelper } from "./helpers/editor";

test.describe("Raw Markdown sync", () => {
  let editor: EditorHelper;

  test.beforeEach(async ({ page }) => {
    editor = new EditorHelper(page);
    await editor.goto();
  });

  test("initial raw markdown contains expected content", async () => {
    const raw = await editor.getRawMarkdown();
    expect(raw).toContain("# Hello World");
    expect(raw).toContain("**markdown**");
    expect(raw).toContain("*WYSIWYG*");
    expect(raw).toContain("- Item one");
    expect(raw).toContain("> This is a blockquote");
    expect(raw).toContain("---");
    expect(raw).toContain("https://example.com");
  });

  test("raw updates after clearAndType", async () => {
    await editor.clearAndType("# New Title");
    const raw = await editor.getRawMarkdown();
    expect(raw).toContain("# New Title");
  });

  test("raw reflects \\n\\n separator after Enter", async () => {
    await editor.clearAndType("first");
    await editor.pressEnter();
    await editor.type("second");
    const raw = await editor.getRawMarkdown();
    expect(raw).toContain("first");
    expect(raw).toContain("second");
    // Enter inserts two newlines → blank line between blocks
    expect(raw).toMatch(/first\n\nsecond/);
  });

  test("inline markdown syntax is preserved verbatim in raw", async () => {
    await editor.clearAndType("**bold** and *italic*");
    const raw = await editor.getRawMarkdown();
    expect(raw).toContain("**bold**");
    expect(raw).toContain("*italic*");
  });
});
