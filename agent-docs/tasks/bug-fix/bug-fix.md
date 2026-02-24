# バグ一覧

## 1. 2つのブロック要素があるとき、2つ目のブロック要素の先頭で文字を削除するとエラーが発生する

### 再現手順

1. 2つの段落がある状態で、2つ目の段落の先頭にカーソルを置く
2. バックスペースを押す
3. 再現

### 期待される動作

2つ目の段落の先頭でバックスペースを押してもエラーが発生せず、1つ目の段落と結合されること。

## 2. 連続した複数の空白が表示されない

### 再現手順

1. `a`を入力
2. スペースを3回入力
3. `b`を入力
4. 3回入力したスペースが表示されない
5. Markdown上ではスペースが3つ入力されていることを確認できる

### 期待される動作

編集対象のMarkdownと同じくスペースが表示されること。

### 備考

この問題はHTMLで連続したスペースが1つのスペースとして表示されてしまうことが原因と思われる。

## 3. ブロックの最後の空白が表示されない

### 再現手順

1. `a`を入力
2. スペースを1回入力
3. ブロックの最後のスペースが表示されない
4. Markdown上ではスペースが入力されていることを確認できる

### 期待される動作

編集対象のMarkdownと同じくスペースが表示されること。

### 備考

3と関連していると思われる。listやheadingの入力で困る。

## 4. 改行が行われない

### 再現手順

1. `a`を入力
2. Enterを押す
3. `b`を入力
4. `a`と`b`が同じ段落に表示され、改行されない

### 期待される動作

`a`と`b`が別の段落に表示され、改行されること。

## 5. tight listの中でlist itemが2つあるとき、1つ目のlist itemの最後で改行するとtight listがloose listになる

### 再現手順

1. tight listの中でlist itemが2つある状態を作る
2. 1つ目のlist itemの最後にカーソルを置く
3. Enterを押す

Markdown

```markdown
- hoge
- fuga
```

初期

```html
<ul data-block="list"><li data-block="list_item">- hoge</li><li data-block="list_item">- fuga</li></ul>
```

操作後

```html
<ul data-block="list"><li data-block="list_item">- <p data-block="paragraph">hoge</p></li><li data-block="list_item">- <p data-block="paragraph">piyo</p></li><li data-block="list_item">- <p data-block="paragraph">fuga</p></li></ul>
```
