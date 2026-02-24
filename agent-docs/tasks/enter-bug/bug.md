改行周りがバグっている

初期状態から以下のように入力

1. `This is a markdown editor with CST-based rendering.`のあとにカーソルを置く
2. `hoge`と入力
3. バグ発生

操作後のMarkdown

```markdown
# Hello World

This is a markdown editor with CST-based rendering.

hoge
hog
ho
h


- Item one
- Item two
- Item three

1. First
2. Second
3. Third

---

Another paragraph here.
```

おかしいのは以下の部分。

```
hoge
hog
ho
h
```

最初のParagraph（`This is ~ rendering.`）の後に空行を挿入し、`hoge`とだけ入力したはずなのに、そのあとに意図しないテキストが入る


## 期待する動作

- 余計なテキストが挿入されない
- 改行1つでは新しいParagraphを生成しない
- 改行2回でBlank LineをはさんでParagraphを生成する

[CommonMark](https://spec.commonmark.org/0.31.2)のExample 220