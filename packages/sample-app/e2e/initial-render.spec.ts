import { test, expect } from "@playwright/test";
import { EditorHelper } from "./helpers/editor";

test.describe("Initial render", () => {
  let editor: EditorHelper;

  test.beforeEach(async ({ page }) => {
    editor = new EditorHelper(page);
    await editor.goto();
  });

  test("shows the app title", async ({ page }) => {
    await expect(page.locator("h1.app-title")).toBeVisible();
  });

  test("renders the h1 heading", async ({ page }) => {
    const heading = page.locator("h1[data-block='heading']");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText("# Hello World");
  });

  test("renders bold text", async ({ page }) => {
    const strong = page.locator("strong").first();
    await expect(strong).toContainText("**markdown**");
  });

  test("renders italic text", async ({ page }) => {
    const em = page.locator("em").first();
    await expect(em).toContainText("*WYSIWYG*");
  });

  test("renders an unordered list with 3 items", async ({ page }) => {
    const items = page.locator("ul[data-block='list'] li");
    await expect(items).toHaveCount(3);
  });

  test("renders a blockquote", async ({ page }) => {
    const bq = page.locator("blockquote[data-block='block_quote'] p");
    await expect(bq).toContainText("This is a blockquote");
  });

  test("renders a fenced code block", async ({ page }) => {
    const code = page.locator("pre[data-block='code_block'] code");
    await expect(code).toBeVisible();
    await expect(code).toContainText("console.log");
  });

  test("renders a thematic break", async ({ page }) => {
    const hr = page.locator("div[data-block='thematic_break']");
    await expect(hr).toContainText("---");
  });

  test("renders a link", async ({ page }) => {
    const link = page.locator("a[href='https://example.com']");
    await expect(link).toBeVisible();
  });

  test("renders multiple block-level elements (no blank_line divs)", async ({ page }) => {
    // blank_line divs are no longer emitted; blocks are separated by CSS margin
    const blanks = page.locator("div[data-block='blank_line']");
    await expect(blanks).toHaveCount(0);
    // Verify at least one heading and paragraph are present
    await expect(page.locator("h1[data-block='heading']")).toBeVisible();
    await expect(page.locator("p[data-block='paragraph']").first()).toBeVisible();
  });
});
