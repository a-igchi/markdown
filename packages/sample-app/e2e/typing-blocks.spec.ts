import { test, expect } from "@playwright/test";
import { EditorHelper } from "./helpers/editor";

test.describe("Typing block elements", () => {
  let editor: EditorHelper;

  test.beforeEach(async ({ page }) => {
    editor = new EditorHelper(page);
    await editor.goto();
  });

  test("# Hello → h1 heading", async ({ page }) => {
    await editor.clearAndType("# Hello");
    const h1 = page.locator("h1[data-block='heading']");
    await expect(h1).toContainText("# Hello");
  });

  test("## Sub → h2 heading", async ({ page }) => {
    await editor.clearAndType("## Sub");
    await expect(page.locator("h2[data-block='heading']")).toContainText(
      "## Sub"
    );
  });

  test("### Third → h3 heading", async ({ page }) => {
    await editor.clearAndType("### Third");
    await expect(page.locator("h3[data-block='heading']")).toContainText(
      "### Third"
    );
  });

  test("plain text → paragraph", async ({ page }) => {
    await editor.clearAndType("Just text");
    await expect(
      page.locator("p[data-block='paragraph']")
    ).toContainText("Just text");
  });

  test("- item → unordered list item", async ({ page }) => {
    await editor.clearAndType("- item");
    await expect(
      page.locator("ul[data-block='list'] li")
    ).toContainText("item");
  });

  test("1. item → ordered list item", async ({ page }) => {
    await editor.clearAndType("1. item");
    await expect(
      page.locator("ol[data-block='list'] li")
    ).toContainText("item");
  });

  test("> quoted → blockquote", async ({ page }) => {
    await editor.clearAndType("> quoted");
    await expect(
      page.locator("blockquote[data-block='block_quote'] p")
    ).toContainText("quoted");
  });

  test("--- → thematic break", async ({ page }) => {
    await editor.clearAndType("---");
    await expect(
      page.locator("div[data-block='thematic_break']")
    ).toContainText("---");
  });

  test("fenced code block with language tag", async ({ page }) => {
    await editor.clearAndType("```js");
    await editor.pressEnter();
    await editor.type("const x = 1;");
    await editor.pressEnter();
    await editor.type("```");
    await expect(
      page.locator("pre[data-block='code_block'] code")
    ).toContainText("const x = 1;");
  });

  test("Enter creates two paragraphs (no blank_line div)", async ({ page }) => {
    await editor.clearAndType("first");
    await editor.pressEnter();
    await editor.type("second");
    // blank_line divs are no longer emitted; separation is via CSS margin
    await expect(page.locator("div[data-block='blank_line']")).toHaveCount(0);
    const paragraphs = page.locator("p[data-block='paragraph']");
    await expect(paragraphs).toHaveCount(2);
  });

  test("two list items with Enter between them", async ({ page }) => {
    await editor.clearAndType("- first item");
    await editor.pressEnter();
    await editor.type("- second item");
    await expect(page.locator("ul[data-block='list'] li")).toHaveCount(2);
  });

  test("complex: multi-block document with corrections", async ({ page }) => {
    // Clear and type heading with a typo, then fix it
    await editor.clearAndType("# Hellp");
    await editor.pressBackspace();
    await editor.type("o");

    // Add paragraph with inline formatting
    await editor.pressEnter();
    await editor.type("This is **bold** and *italic* text.");

    // Add unordered list
    await editor.pressEnter();
    await editor.type("- first item");
    await editor.pressEnter();
    await editor.type("- second item");

    await editor.pressEnter();
    await editor.type("> a wise quote");

    await editor.pressEnter();
    await editor.type("---");

    // Assertions
    await expect(page.locator("h1[data-block='heading']")).toContainText(
      "# Hello"
    );

    const para = page.locator("p[data-block='paragraph']").first();
    await expect(para.locator("strong")).toContainText("**bold**");
    await expect(para.locator("em")).toContainText("*italic*");

    await expect(page.locator("ul[data-block='list'] li")).toHaveCount(2);
    await expect(
      page.locator("blockquote[data-block='block_quote'] p")
    ).toContainText("a wise quote");
    await expect(
      page.locator("div[data-block='thematic_break']")
    ).toContainText("---");

    const raw = await editor.getRawMarkdown();
    expect(raw).toContain("# Hello");
    expect(raw).toContain("**bold**");
    expect(raw).toContain("*italic*");
    expect(raw).toContain("- first item");
    expect(raw).toContain("- second item");
    expect(raw).toContain("> a wise quote");
    expect(raw).toContain("---");
  });
});
