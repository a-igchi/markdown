# complex テスト失敗の解析

## 現状

- 31 件の e2e テストのうち 30 件パス
- 残り 1 件「complex: multi-block document with corrections」が失敗

## エラー内容

```
strict mode violation: locator('p[data-block=\'paragraph\']').first().locator('em')
resolved to 4 elements
```

1 つ目の `<p>` の中に `<em>` が 4 つある（期待値: 1 つ）。

## error-context.md のスナップショット

エディタ内に **5 つの `<p>` 要素**が存在し、各段落に大量の繰り返しテキストが入っている。

```
- paragraph [ref=e9]:
    - text: This is
    - strong: "**bold** and *italic* text."
    - text: "- first itema- second itemn> a wise quoted---"
    - emphasis: "*italic*"
    - text: "text. - first itema- second itemn> a wise quoted---"
    - emphasis: "*italic*"
    - text: "text. - first itema- second itemn> a wise quoted--"
    ...（4 回繰り返し、各回末尾が 1 文字ずつ減少）
- paragraph [ref=e16]:  "d" から始まり同様の繰り返し
- paragraph [ref=e33]:  "nd" から始まり同様の繰り返し
- paragraph [ref=e49]:  "and" から始まり同様の繰り返し
- paragraph [ref=e64]:  "and" から始まる最終段落
```

## 観察された謎のパターン

テキスト `"- first itema- second itemn> a wise quoted---"` の中の **"a", "n", "d"** が不審。

- `"- first item"` + **`"a"`** + `"- second item"` + **`"n"`** + `"> a wise quote"` + **`"d"`** + `"---"`

各ブロックのコンテンツが連結されているように見えるが、間に謎の 1 文字が挟まっている。

## パーサーの動作確認

```js
parse("# Hello\n\nThis is **bold** and *italic* text.\n\n- first item\n\n")
// 7 ブロック: heading, blank_line, paragraph, blank_line, list[li], blank_line, blank_line
// list は tight: true, items: 1

parse("# Hello\n\nThis is **bold** and *italic* text.\n\n- first item\n\n-")
// 5 ブロック: heading, blank_line, paragraph, blank_line, list[li0, li1]
// list は tight: false（loose）, items: 2
//   li0.children: [paragraph]  ← p ラッパーあり
//   li1.children: [blank_line]  ← blank_line 子要素
```

## 根本原因の特定

### タイト→ルーズ遷移時のカーソルオフセットのずれ

**問題のシナリオ：** `type("- second item")` の最初の文字 `"-"` をタイプする直前

1. **pressEnter() の後**: 値 = `"...first item\n\n"` → DOM: `h1, bl, p, bl, ul[li0(tight)], bl(b5), bl(b6)` (7 ブロック)
2. **cursorOffsetRef.current = 59** (bl(b5) の位置)
3. React が非同期で再レンダリングをスケジュール（未実行の可能性）
4. **Playwright が即座に `"-"` をタイプ**

#### パターン A: React が再レンダリング済みの場合（正常）

`"-"` は bl(b5) に入り → 値 = `"...first item\n\n-"` → parse → loose list (5 ブロック)

**DOM 変化**: tight list → loose list (li0 に `<p>` ラッパーが追加される)

旧 DOM (tight) での `saveCursorAsOffset` = **61**:
```
h1(7) + \n(1) + bl(b1)(1) + p(35) + \n(1) + bl(b3)(1)
+ ul→li0 tight: "- "(2) + "first item"(10) + \n li_end(1) = 59
+ bl(b5) with "-": onBlankLine(1) + text "-"(1) = 61
```

新 DOM (loose) での `restoreCursorFromOffset(61)` の歩き:
```
h1(7) + \n(1) + bl(b1)(1) + p(35) + \n(1) + bl(b3)(1) = 46 消費
ul → li0 (LOOSE: "- " + <p>first item</p>):
  "- "(2) + "first item"(10) + \n p_end(1) + \n li_end(1) = 14 消費 → total 60
ul → li1:
  "- " text (2): remaining = 1 ≤ 2 → カーソルを "- " テキストの位置 1 に配置！
```

**結果**: カーソルが li1 のプレフィックス `"- "` の内部（`"-"` と `" "` の間）に置かれる。

#### tight vs loose で li のカーソルカウントが異なる

| 状態 | DOM 構造 | cursor.ts のカウント |
|------|----------|---------------------|
| tight li | `<li>- first item</li>` | `2 + 10 + 1 = 13` chars |
| loose li | `<li>- <p>first item</p></li>` | `2 + 10 + \n_p + \n_li = 14` chars |

`saveCursorAsOffset` を旧 DOM (tight, 13 chars for li0) で実行し、`restoreCursorFromOffset` を新 DOM (loose, 14 chars for li0) で実行すると、**1 文字分ずれて**カーソルが li1 の `"- "` プレフィックスに落ちる。

### 連鎖的な破壊

カーソルが li1 のプレフィックス `"- "` の中に入ると:

- `" "` (type の次文字) が プレフィックス内に挿入される → DOM 破損
- 以後の文字がすべて誤った位置にタイプされ続ける
- React の再レンダリングのたびに誤った値で `onChange` → 値が積み重なって破損
- 最終的に最初の段落に大量の繰り返しテキストが入る

### "a", "n", "d" の正体

カーソルが li1 のプレフィックス内に入った後、値のずれで再レンダリングされるたびに余分な文字が生じる。
（正確なメカニズムは複雑だが、tight→loose 遷移後のカーソルの 1 文字ずれが連鎖して生じた副産物）

## 修正案

### 案 1: `flushSync` でレンダリングを同期化（推奨）

`Editor.tsx` の `handleInput` と `handleKeyDown` で `onChange` を `flushSync` でラップする。

```ts
import { flushSync } from 'react-dom';

// handleInput 内:
cursorOffsetRef.current = saveCursorAsOffset(container);
const newText = extractText(container);
flushSync(() => {
  onChange(newText);
});
// ← ここで useLayoutEffect（正規化 + カーソル復元）が完了している
```

**効果**: `onChange` → React 同期再レンダリング → `useLayoutEffect` (正規化 + カーソル復元) → 次のイベント。
Playwright が次のキーを送信する前に DOM が正しい状態になる。

**懸念点**: キーストロークごとに同期レンダリングが走るためパフォーマンスが下がる可能性。
ただし ContentEditable での WYSIWYG は本来同期的な操作であり、これが適切な使い方。

### 案 2: li 内の段落を常に tight 扱いでレンダリング

`renderListItem` で常に `tight=true` で子段落をレンダリングし、`<p>` ラッパーを省略する。

**問題**: tight で統一すると `extractText` が `"- item\n"` を返し、loose list の `\n\n` セパレータが失われる。値のラウンドトリップが壊れる。

→ 実現可能だが `extractText` と `cursor.ts` の大幅な書き直しが必要。

### 案 3: テストにウェイトを追加

各 `pressEnter()` の後に React の再レンダリングを待つ。

```ts
async pressEnter() {
  await this.page.keyboard.press("Enter");
  // React の再レンダリングと useLayoutEffect の完了を待つ
  await this.page.waitForFunction(() => {
    // カーソルが blank_line 内にあることを確認
    const sel = window.getSelection();
    return sel?.anchorNode?.parentElement?.dataset?.block === 'blank_line';
  });
}
```

**問題**: 条件が難しく、脆弤。根本原因の修正にならない。

## 推奨アクション

**案 1（`flushSync`）を採用する**。

ContentEditable 編集は本来ユーザー操作の直後に UI が同期的に更新される必要があり、`flushSync` はこのユースケースのために設計されている。パフォーマンスへの影響は許容範囲内（実際の人間のタイピング速度では問題にならない）。

## 影響ファイル

- `packages/editor/src/components/Editor.tsx` — `handleInput` と `handleKeyDown` に `flushSync` を追加
- テスト変更なし（根本を修正するため）
