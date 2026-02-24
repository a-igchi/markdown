# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

pnpm monorepo with three packages:

- **`packages/parser`** (`markdown-parser`) — Zero-dependency CommonMark parser; produces an AST with source-location metadata on every node
- **`packages/editor`** (`markdown-editor`) — React WYSIWYG editor built on top of the parser; renders markdown syntax literally (e.g. `# ` prefix stays visible)
- **`packages/sample-app`** — Vite/React demo app

The editor depends on the parser via `workspace:*`.

## Commands

### Root (runs across all packages)
```bash
pnpm test       # all tests
pnpm build      # all packages
```

### Per-package
```bash
# from packages/parser or packages/editor
pnpm test            # vitest run --coverage
pnpm test:watch      # vitest watch

# parser only
pnpm lint            # oxlint
pnpm lint:fix
pnpm fmt             # oxfmt
pnpm fmt:check

# sample-app only
pnpm dev             # vite dev server
```

### Running a single test file
```bash
cd packages/parser
pnpm exec vitest run tests/block/atx-heading.test.ts

cd packages/editor
pnpm exec vitest run tests/rendering/ast-to-react.test.tsx
```

## Architecture

### Parser — two-phase design

**Phase 1 — Block parsing** (`src/parser/block/block-parser.ts`):
Splits input into `LineInfo[]` (each line carries its absolute character `offset` in the original string), then recognises ATX headings, paragraphs, lists, fenced code blocks, blockquotes, thematic breaks, blank lines, and link-reference definitions.
Container blocks (blockquote, list item) strip their markers and call `parseBlocks` **recursively on the stripped sub-content**. This means all child node `sourceLocation` offsets are relative to the stripped sub-string, not the original source — a critical fact for any renderer that uses `source[node.offset]` to recover marker characters.

**Phase 2 — Inline parsing** (`src/parser/inline/inline-parser.ts`):
`processInlines` walks block nodes and replaces empty `children: []` with parsed inline nodes (Text, Emphasis, Strong, Link, CodeSpan, SoftBreak, HardBreak). Uses a delimiter-stack algorithm for emphasis/strong matching.

**Entry point** (`src/index.ts`):
```ts
export function parse(input: string): Document
```

Every AST node carries `sourceLocation: { start: Position, end: Position }` where `Position = { line, column, offset }`. This is the foundation for WYSIWYG cursor tracking.

### Editor — contentEditable with offset-based cursors

**`Editor.tsx`** is a controlled component (`value` / `onChange`). Flow on each keystroke:

1. `handleInput` → `saveCursorAsOffset(container)` captures cursor as a plain integer character offset (via `extractText` semantics), then `extractText(container)` reconstructs the markdown string, then `onChange(newText)` fires.
2. Parent updates `value` → React re-renders → `useLayoutEffect` → `restoreCursorFromOffset(container, offset)` puts the cursor back.

Enter key inserts `\n\n` (new blank-line block) at the cursor offset.

**`ast-to-react.tsx`** — renders AST nodes to JSX, deliberately keeping markdown syntax visible (WYSIWYG):
- `#` prefix in headings, `- ` / `1. ` in list items, delimiters in `<em>`/`<strong>`, full link syntax in `<a>`, raw fences in `<pre><code>`
- `blank_line` → `<div data-block="blank_line">` (needed as a cursor target)
- `thematic_break` → `<div data-block="thematic_break">` (can't use `<hr>` — void element can't hold text)
- **Blockquote sub-source**: because the parser strips `> ` before recursing, `renderBlockQuote` must reconstruct the same stripped sub-source before passing it to child renderers, so that `source[emphasis.start.offset]` yields the correct delimiter character.

**`extract-text.ts`** — walks the rendered DOM and reconstructs the markdown string:
- `ul`, `ol`, `blockquote` → container blocks, recurse without adding newlines
- `h1–h6`, `p`, `li`, `pre`, `div[data-block]` → leaf blocks, append `\n` after content
- `blank_line` → contributes an extra `\n` (producing an empty line between the surrounding blocks' trailing newlines)
- `<br>` that is the sole child of a block element → placeholder, ignored

**`cursor.ts`** — `saveCursorAsOffset` / `restoreCursorFromOffset` walk the same DOM using the same leaf/container rules as `extract-text.ts` to map between a DOM `Range` and a plain integer offset into the markdown string.

### Test structure

- Parser tests live under `packages/parser/tests/` and are plain `.test.ts` (no DOM needed)
- Editor tests live under `packages/editor/tests/` and are `.test.tsx`; vitest uses jsdom + `@testing-library/react`
- Editor test directories: `rendering/`, `text-extraction/`, `cursor/`, `integration/`
