# Add CST Parser Task

- MarkdownのWYSIWYGエディタが欲しくていろいろ作っている
    - Markdownのテキストをそのままマークアップして表示・編集できる感じのやつ
- 既存の実装はASTを構築しているが、テストは通っているもののカーソルの位置や新しい要素の追加・削除のあたりで実際使っているとバグが多い
- ASTだとHTMLに変換するうえで必要な情報が削られるので空白の情報もあるとよい？
    - https://biomejs.dev/ja/internals/architecture/
    - BiomeのドキュメントにCSTというやつがあった
- CSTを構築するパーサーとそれをもとにMarkdownの編集を実現するエディタを作る

## 実装する機能

上の感じで実装してほしい。ただし全部実装すると時間かかるので[CommonMark](https://spec.commonmark.org/0.31.2)のうち、以下の要素を最低限作って。これを実装するうえで必要なほかの仕様も追加する。

- ATX Heading
- Lists
- Paragraph
- Thematic Break

## 制約

- packages配下に以下のパッケージを作成
    - parser-cst: CSTパーサーの実装
    - editor-cst: Reactベースのエディタ
    - sample-app-cst: ViteとReactでeditor-cstを利用するサンプルアプリ
- 以下のようにテストを実装する　
    - 単体テスト
        - テスト対象モジュールと同じディレクトリに`<対象モジュールファイル>.test.ts`という名前でファイルを作る
    - 結合テスト
        - サブパッケージのルートに`test`というディレクトリを作ってここに作成する
- 利用ライブラリ
    - parserは依存なし
    - Vitest
    - testing-library
    - React
    - Vite

## ゴール

- parser-cstが実装されている
- editor-cstが実装されている
- sample-app-cstが実装されている

