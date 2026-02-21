# Markdown WYSIWYGエディタ実装

MarkdownのWYSIWYGエディタを実装してほしい。以下の要件を満たすように実装してください。

## 機能要件

Markdownとしてのテキストフォーマットはそのまま表示しつつ、内容の編集をそのまま行えるエディタが欲しい。

例えば、以下のような入力の場合を考える。

```markdown
# Heading 1

Pragraph text.

- list1
- list2
```

エディタの中ではこれを以下のようなHTMLとして表示しつつ、その中身を編集できるようにしてほしい。もちろんMarkdownのシンタックスが変化すれば、それに応じて表示も変化するようにしてほしい。

```html
<h1># Heading 1</h1>
<p>Paragraph text.</p>
<ul>
    <li>- list1</li>
    <li>- list2</li>
</ul>
```

スタイルについてはこのパッケージでは未定義。CSSは外部から提供されることを想定している。

## 技術要件

- packages/editorとしてMarkdownのWYSIWYGエディタを実装する
- packages/parserにMarkdownパーサがあるのでこれを使う
    - エディタ実装のために必要な機能が足りなければ拡張してもよい
    - シンタックスの拡張はしない
- Reactのライブラリとして実装する
    - 例えば各種UIライブラリから利用可能な抽象レイヤーを作ったほうが実装が楽などの場合はこの限りではない
    - 一旦Reactのやつが欲しい

## テスト方針

TBD

ざっくりt-wadaのTDDでやる。

## 完了条件

-[ ] 上記の機能要件を満たすMarkdown WYSIWYGエディタが実装されていること
-[ ] テストが実装されていること
-[ ] サンプルアプリが存在していること
    -[ ] packeages/sample-appでサンプルアプリが実装されていること
    -[ ] ViteのSPA