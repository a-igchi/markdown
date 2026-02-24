import { test, expect } from "@playwright/test";
import { EditorHelper } from "./helpers/editor";

test.describe("Typing inline elements", () => {
  let editor: EditorHelper;

  test.beforeEach(async ({ page }) => {
    editor = new EditorHelper(page);
    await editor.goto();
  });

  test("**bold** → strong element", async ({ page }) => {
    await editor.clearAndType("**bold**");
    await expect(page.locator("strong")).toContainText("**bold**");
  });

  test("*italic* → em element", async ({ page }) => {
    await editor.clearAndType("*italic*");
    await expect(page.locator("em")).toContainText("*italic*");
  });

  test("`code` → code element inside paragraph", async ({ page }) => {
    await editor.clearAndType("`code`");
    await expect(page.locator("p code")).toContainText("`code`");
  });

  test("[text](url) → anchor with href", async ({ page }) => {
    await editor.clearAndType("[text](https://example.com)");
    const link = page.locator("a[href='https://example.com']");
    await expect(link).toContainText("[text](https://example.com)");
  });

  test("mixed paragraph: bold and italic inside text", async ({ page }) => {
    await editor.clearAndType("Hello **world** today");
    const para = page.locator("p[data-block='paragraph']");
    await expect(para).toContainText("Hello **world** today");
    await expect(para.locator("strong")).toContainText("**world**");
  });

  test("heading with inline link", async ({ page }) => {
    await editor.clearAndType("# Go [here](https://example.com)");
    const h1 = page.locator("h1[data-block='heading']");
    await expect(h1).toBeVisible();
    await expect(h1.locator("a[href='https://example.com']")).toBeAttached();
  });
});
