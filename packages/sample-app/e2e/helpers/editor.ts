import type { Page } from "@playwright/test";

export class EditorHelper {
  constructor(private page: Page) {}

  /** Navigate to the app and wait for the editor to appear. */
  async goto() {
    await this.page.goto("/");
    await this.page.locator('div.editor[contenteditable="true"]').waitFor();
  }

  /**
   * Navigate to the app with the given text as initial content, then focus
   * and position the cursor at the end.
   *
   * This uses the `?md=` URL parameter rather than DOM manipulation, which
   * avoids the React reconciliation crash that occurs when execCommand or
   * keyboard shortcuts delete React-managed block elements en masse.
   */
  async clearAndType(text: string) {
    const url = `/?md=${encodeURIComponent(text)}`;
    await this.page.goto(url);
    await this.page.locator('div.editor[contenteditable="true"]').waitFor();
    // Focus the editor and move cursor to end so subsequent type/Enter calls
    // insert at the right position.
    await this.page.evaluate(() => {
      const el = document.querySelector(
        'div.editor[contenteditable="true"]',
      ) as HTMLElement;
      el.focus();
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false); // collapse to end
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
  }

  /**
   * Insert text at the current cursor position.
   *
   * Uses keyboard.type() so that Chrome removes placeholder <br> elements
   * in blank_line divs before inserting (which execCommand does not do).
   */
  async type(text: string) {
    await this.page.keyboard.type(text, { delay: 20 });
  }

  /** Press Enter (inserts \n\n — new blank-line block + new paragraph). */
  async pressEnter() {
    await this.page.keyboard.press("Enter");
  }

  /** Press Backspace one or more times. */
  async pressBackspace(count = 1) {
    for (let i = 0; i < count; i++) {
      await this.page.keyboard.press("Backspace");
    }
  }

  /** Open the Raw Markdown <details> section if it is closed. */
  async openRawSection() {
    await this.page.evaluate(() => {
      const details = document.querySelector(
        "details.raw-section",
      ) as HTMLDetailsElement;
      if (details && !details.open) {
        details.open = true;
      }
    });
  }

  /** Return the text content of the raw markdown <pre> element. */
  async getRawMarkdown(): Promise<string> {
    await this.openRawSection();
    return this.page.locator("pre.raw-source").innerText();
  }
}
