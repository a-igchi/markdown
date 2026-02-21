MarkdownのWYSIWYGエディタが欲しい。そのために以下のようなMarkdownパーサを実装したい。

- WYSISYGエディタ構築のために必要なASTを構築できる
- CommonMarベースで、以下の文法を最低限サポート
  - ATX Heading
  - Paragraphs
  - Blank lines
  - List items
  - Lists
  - Emphasis and strong emphasis
  - Links
- その他必要な仕様があれば追加で実装

実装時は以下の点に注意する

- CommonMarkはhttps://spec.commonmark.org/0.31.2を参照すること。
  - 上の使用にParsing Strategyという章がある。
- 上の仕様からテストを作成し、それを満たすように実装すること。
