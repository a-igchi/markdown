# シンタックスの追加

## 目的

[base-implementationタスク](../base-implementation/task.md)の続きになります。

Markdownパーサーに[CommonMark](https://spec.commonmark.org/0.31.2)準拠のシンタックスを追加します。追加したいのは以下のシンタックスです。

- thematic breaks
- fenced code blocks
- blockquotes
- code spans

進め方は前のタスクと同様に進めてください。

ただし、linterとformatterを実行するようにしてください

```bash
# lint, then you should fix lint errors
npm run lint
# format
npm run format
```
