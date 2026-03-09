# ドキュメントモデル仕様

editorパッケージ（`packages/editor`）で使用されるドキュメントモデルの仕様書。

## 概要

ドキュメントモデルは、Markdown文字列とcontentEditable DOMの間に位置する中間表現。エディタの編集操作（入力・Enter・Backspace）はすべてこのモデルを通じて行われる。

### データフロー

```
Markdown文字列
    │
    ▼  parse() [parser パッケージ]
CST (SyntaxNode)
    │
    ▼  cstToModel()
Document { blocks: Block[] }
    │
    ├──▶ modelToReact()  ──▶ React要素 (contentEditable DOM)
    │                              │
    │                        [ユーザー操作]
    │                              │
    │                    saveDomCursorAsModelCursor()
    │                    extractBlockText()
    │                              │
    ├──▶ operations.ts  ◀──────────┘
    │    (splitBlock / mergeWithPreviousBlock / updateBlockContent)
    │
    ▼  modelToMarkdown()
Markdown文字列  ──▶ onChange(markdown)  ──▶ 親コンポーネントへ
```

---

## 型定義

ソース: `packages/editor/src/model/types.ts`

### Block

ドキュメントを構成するブロック要素の discriminated union。

```typescript
type Block =
  | { type: "paragraph";          content: string }
  | { type: "heading";            content: string }
  | { type: "thematic_break";     content: string }
  | { type: "list";               content: string }
  | { type: "fenced_code_block";  content: string }
  | { type: "block_quote";        content: string }
  | { type: "blank_line";         content: "" };
```

`content` はそのブロックの生のMarkdownソーステキスト（`#`, `-`, ` ``` ` などのマーカーを含む）。末尾の `\n` は除去されている。`blank_line` の `content` は常に空文字列。

### Document

```typescript
type Document = {
  blocks: readonly Block[];
};
```

ブロックのフラット配列。リスト・コードブロック・ブロッククォートなどの複数行ブロックも、1つの `Block` として `content` に全行を格納する（ネスト構造なし）。

### ModelCursor

```typescript
type ModelCursor = {
  blockIndex: number;  // blocks 配列上のインデックス
  offset: number;      // ブロックの content 文字列上の文字位置
};
```

---

## 変換関数

### cstToModel

**ソース:** `packages/editor/src/model/cst-to-model.ts`

```typescript
function cstToModel(doc: SyntaxNode): Document
```

CSTのドキュメントノードをDocumentモデルへ変換する。これがモデル生成の正規パス。

- CST子ノードを順に走査
- `BLANK_LINE` トークン → `{ type: "blank_line", content: "" }`
- ノード系 → `getText(child).replace(/\n$/, "")` でcontent取得、SyntaxKindをblockタイプへマッピング
  - `ATX_HEADING` → `"heading"`
  - `PARAGRAPH` → `"paragraph"`
  - `THEMATIC_BREAK` → `"thematic_break"`
  - `LIST` → `"list"`
  - `FENCED_CODE_BLOCK` → `"fenced_code_block"`
  - `BLOCK_QUOTE` → `"block_quote"`

---

### modelToMarkdown

**ソース:** `packages/editor/src/model/model-to-markdown.ts`

```typescript
function modelToMarkdown(doc: Document): string
```

DocumentモデルをMarkdown文字列へシリアライズする。

セパレータルール:
- 隣接する2つのcontent block（どちらも `blank_line` でない）の間 → `"\n\n"`
- どちらかが `blank_line` の場合 → `"\n"`
- 末尾の `blank_line` → 追加の `"\n"`

例:
```
[para("Hello"), blank_line, para("World")]
→ "Hello\n\nWorld"

[para("Hello"), blank_line, blank_line, blank_line, para("World")]
→ "Hello\n\n\n\nWorld"
```

---

### modelToReact

**ソース:** `packages/editor/src/model/model-to-react.tsx`

```typescript
function modelToReact(doc: Document): ReactNode[]
```

DocumentモデルをcontentEditable用のReact要素へ変換する。各ブロック要素には `data-block-index={i}` 属性が付与される。

- ブロックが0件の場合 → プレースホルダー `<p data-block="paragraph" data-block-index={0}><br/></p>`
- `blank_line` → `<div data-block="blank_line" data-block-index={i}><br/></div>`
- contentが空のブロック → blockタイプに対応するタグのプレースホルダー（`<br/>` 入り）
- contentがあるブロック → `parse(block.content)` でCST再パース → `cst-to-react.tsx` の `renderElement()` でHTML化

`blockTag` マッピング:

| blockタイプ | HTMLタグ |
|---|---|
| paragraph | p |
| heading | div (h1-h6はrenderElementが決定) |
| list | ul |
| fenced_code_block | pre |
| block_quote | blockquote |
| thematic_break | div |

---

## 編集操作

**ソース:** `packages/editor/src/model/operations.ts`

### splitBlock — Enterキー

```typescript
function splitBlock(
  doc: Document,
  cursor: ModelCursor
): { newDoc: Document; newCursor: ModelCursor }
```

カーソル位置でブロックを分割する。ブロックタイプ別の挙動:

| ブロックタイプ | 挙動 |
|---|---|
| paragraph | カーソル位置で2つのparagraphに分割。空paragraphの場合は `[blank_line, empty_paragraph]` |
| heading | 左がheading、右がparagraphになる |
| list | 現在行のリストマーカー（`- ` または `N. `）を検出し、`\n` + 継続マーカーをブロック内に挿入（ブロック分割なし） |
| fenced_code_block | ブロック内に `\n` を挿入（ブロック分割なし） |
| block_quote | ブロック内に `\n` を挿入（ブロック分割なし） |
| blank_line | blank_lineをもう1つ後ろに挿入 |
| thematic_break | 空paragraphを後ろに挿入 |

---

### mergeWithPreviousBlock — Backspace（ブロック先頭）

```typescript
function mergeWithPreviousBlock(
  doc: Document,
  cursor: ModelCursor
): { newDoc: Document; newCursor: ModelCursor }
```

カーソルがブロック先頭（offset === 0）にある場合の Backspace 処理。

| 状況 | 挙動 |
|---|---|
| 現在ブロックが blank_line かつ前後にcontent blockがある | blank_lineを削除し、前後のcontent blockを `\n` で結合 |
| 現在ブロックが blank_line かつドキュメント境界 | blank_lineを削除のみ |
| 直前ブロックが blank_line | blank_lineを削除、カーソルをblockIndex-1へ移動 |
| 通常の隣接content block | 現在ブロックのcontentを前ブロックの末尾に結合 |

---

### updateBlockContent — 通常入力

```typescript
function updateBlockContent(
  doc: Document,
  blockIndex: number,
  newContent: string
): Document
```

指定ブロックのcontentを更新する。

- blank_lineブロックにnon-empty contentが来た場合 → paragraphに変換
- blank_lineブロックにempty contentが来た場合 → blank_lineのまま維持
- 通常ブロック → 同じblockタイプを保ちつつcontentを更新

---

## カーソルマッピング

**ソース:** `packages/editor/src/model/cursor-mapping.ts`

DOM上のカーソル位置とModelCursorを相互変換する。

### saveDomCursorAsModelCursor

```typescript
function saveDomCursorAsModelCursor(container: HTMLElement): ModelCursor | null
```

`window.getSelection()` からDOM上のカーソルを読み取り、ModelCursorへ変換。

1. カーソルノードから最も近い `data-block-index` 属性を持つ祖先を探す → `blockIndex` を取得
2. `querySelector("[data-block-index=...]")` でブロック要素を特定
3. `walkBlock()` でブロックのDOMを走査し、文字オフセットを計算

---

### restoreModelCursorToDom

```typescript
function restoreModelCursorToDom(container: HTMLElement, cursor: ModelCursor): void
```

ModelCursorのbBlockIndexとoffsetからDOM上の正確な位置を特定し、`window.getSelection()` を設定する。

---

### walkBlock の仕組み

ブロック要素のDOMを走査し、以下のコールバックを発火する:

- `onText(node, text)` — テキストノードを発見したとき
- `onLeafBlockEnd(el)` — リーフブロック（h1-h6, p, pre, `li[data-block]`, `div[data-block]`）の走査終了後 → 構造的な `\n` として +1 カウント
- `onBlankLine(el)` — `div[data-block="blank_line"]` を発見したとき → +1 カウント

DOM要素の分類（`packages/editor/src/dom-utils.ts`）:

| 種別 | 対象要素 |
|---|---|
| leaf block | h1-h6, p, pre, `div[data-block]`, `li[data-block]` |
| container block | ul, ol, blockquote, `li`（`data-block`なし） |

---

## 正規化の不変条件

編集操作のたびに、モデルは以下の式で正規化される:

```typescript
newDoc = cstToModel(parse(modelToMarkdown(newDoc)));
```

これにより、モデルの状態は常にパーサーが生成するCST構造と同期が取れている。

また、以下のround-tripが保証される:

```
modelToMarkdown(cstToModel(parse(md))) === md
```

すなわち、Markdownをモデルに変換して再シリアライズしても情報が失われない。

---

## Editorコンポーネントとの統合

**ソース:** `packages/editor/src/components/Editor.tsx`

### 状態管理

```typescript
const docRef = useRef<Document>(cstToModel(parse(value)));
const modelCursorRef = useRef<ModelCursor | null>(null);
```

- `docRef` — 現在のDocumentモデル（Reactのstateではなくrefで保持）
- `modelCursorRef` — Reactの再レンダリング後にDOMカーソルを復元するための保留カーソル

### 編集フロー

**通常入力（handleInput）:**
1. `saveDomCursorAsModelCursor()` でカーソル保存
2. DOM上のテキストを `extractBlockText()` で取得
3. `updateBlockContent()` でモデル更新
4. `applyModel()` で正規化 → `onChange(markdown)` を発火

**Enterキー:**
1. `saveDomCursorAsModelCursor()` でカーソル保存
2. `splitBlock()` でモデル更新
3. `applyModel()` で正規化 → `onChange(markdown)` を発火

**Backspaceキー（ブロック先頭 / blank_line）:**
1. `saveDomCursorAsModelCursor()` でカーソル保存
2. `mergeWithPreviousBlock()` でモデル更新
3. `applyModel()` で正規化 → `onChange(markdown)` を発火

### applyModel

`applyModel()` は正規化フローの中核:
1. `modelToMarkdown(doc)` でMarkdown文字列化
2. `cstToModel(parse(markdown))` で正規化ドキュメントを生成
3. `modelCursorRef` にカーソルを保存（レンダリング後に `restoreModelCursorToDom()` で復元）
4. `onChange(markdown)` を発火

カーソルの正規化前後の変換には、`modelCursorToFlatOffset()` / `flatOffsetToModelCursor()` というローカルヘルパーを使用。これらはDocumentモデルとMarkdown文字列上のフラットオフセット間を相互変換する。
