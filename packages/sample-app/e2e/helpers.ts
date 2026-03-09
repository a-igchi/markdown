import { type Page, type Locator } from "@playwright/test";

export async function getEditor(page: Page): Promise<Locator> {
  return page.locator("[data-testid='editor-wrapper'] [contenteditable]");
}

export async function getRawMarkdown(page: Page): Promise<string> {
  // Open the details element if it's closed
  const details = page.locator("[data-testid='raw-section']");
  const isOpen = await details.getAttribute("open");
  if (isOpen === null) {
    await details.locator("summary").click();
  }
  return page.locator("[data-testid='raw-markdown']").innerText();
}

export async function clearEditor(page: Page): Promise<void> {
  const editor = await getEditor(page);
  await editor.click();
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Delete");
}

export async function getEditorBlockCount(page: Page): Promise<number> {
  const editor = await getEditor(page);
  return editor.locator("[data-block-index]").count();
}
