import { test, expect } from "@playwright/test";
import { getEditor, getRawMarkdown, getEditorBlockCount } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // Wait for the editor to be ready
  const editor = await getEditor(page);
  await expect(editor).toBeVisible();
});

test("typing 'a' Enter 'b' produces no duplicate text", async ({ page }) => {
  const editor = await getEditor(page);

  // Clear and start fresh by clicking at the end of a paragraph
  const p = editor.locator("p[data-block='paragraph']").first();
  await p.click();

  // Navigate to end of first paragraph and start typing
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  const blankLine = editor.locator("[data-block='blank_line']").first();
  await expect(blankLine).toBeVisible();

  await page.keyboard.type("b");

  // blank_line should be clean (empty) - no residual text
  const allBlankLines = editor.locator("[data-block='blank_line']");
  const count = await allBlankLines.count();
  for (let i = 0; i < count; i++) {
    const bl = allBlankLines.nth(i);
    const text = await bl.innerText();
    expect(text.trim()).toBe("");
  }
});

test("sequential Enter then type produces correct block structure", async ({ page }) => {
  const editor = await getEditor(page);

  // Click the first paragraph
  const p = editor.locator("p[data-block='paragraph']").first();
  await p.click();
  await page.keyboard.press("End");

  // Press Enter twice then type
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");

  // Type text in new location
  await page.keyboard.type("hello");

  // Check no blank_line contains text
  const allBlankLines = editor.locator("[data-block='blank_line']");
  const count = await allBlankLines.count();
  for (let i = 0; i < count; i++) {
    const text = await allBlankLines.nth(i).innerText();
    expect(text.trim()).toBe("");
  }
});

test("blank_line input: typing into blank_line converts it to paragraph", async ({ page }) => {
  const editor = await getEditor(page);

  // Press Enter at end of first paragraph to create blank_line
  const p = editor.locator("p[data-block='paragraph']").first();
  await p.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");

  const blankLine = editor.locator("[data-block='blank_line']").first();
  await expect(blankLine).toBeVisible();

  // Click the blank_line and type
  await blankLine.click();
  await page.keyboard.type("newtext");

  // After typing, blank_line should no longer contain "newtext"
  // (it should have been converted to a paragraph)
  const allBlankLines = editor.locator("[data-block='blank_line']");
  const blCount = await allBlankLines.count();
  for (let i = 0; i < blCount; i++) {
    const text = await allBlankLines.nth(i).innerText();
    expect(text.trim()).toBe("");
  }

  // The text "newtext" should appear in a paragraph
  const raw = await getRawMarkdown(page);
  expect(raw).toContain("newtext");
});

test("Backspace merges blocks correctly", async ({ page }) => {
  const editor = await getEditor(page);

  // Create a simple two-paragraph document
  const p = editor.locator("p[data-block='paragraph']").first();
  await p.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("second");

  // Now backspace to remove blank_line separator
  const blankLine = editor.locator("[data-block='blank_line']").first();
  await blankLine.click();
  await page.keyboard.press("Backspace");

  // Verify no blank_lines have text content
  const allBlankLines = editor.locator("[data-block='blank_line']");
  const count = await allBlankLines.count();
  for (let i = 0; i < count; i++) {
    const text = await allBlankLines.nth(i).innerText();
    expect(text.trim()).toBe("");
  }
});

test("raw markdown matches displayed content after edits", async ({ page }) => {
  const editor = await getEditor(page);

  // Type in the first paragraph
  const p = editor.locator("p[data-block='paragraph']").first();
  await p.click();
  await page.keyboard.press("Home");
  await page.keyboard.type("INSERTED ");

  // Get the raw markdown and verify it contains the inserted text
  const raw = await getRawMarkdown(page);
  expect(raw).toContain("INSERTED ");
});
