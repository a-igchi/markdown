# 既知の失敗テストケース

## model-based test: BackspaceCommand の不一致

**ファイル**: `packages/editor/test/model-based.test.tsx`
**テスト名**: `model-based: Editor operations > random command sequences maintain text consistency`

### 症状

モノレポ全体のテスト (`pnpm run test`) を実行すると、model-based test が断続的に失敗する。単体で実行した場合は通過する（フレーキーテスト）。

```
Caused by: AssertionError: expected '0\n2. a\n1. aa\n\n- aaaaAaa' to be '0\n2. a1. aa\n\n- aaaaAaa'
❯ BackspaceCommand.run test/model-based.test.tsx:206:21
```

### 内容

`BackspaceCommand` 実行後、モデルが予測するテキストと実エディタの `extractText` 結果が一致しない。

- **モデルの予測**: `'0\n2. a1. aa\n\n- aaaaAaa'`（ブロック境界なし）
- **実際の結果**: `'0\n2. a\n1. aa\n\n- aaaaAaa'`（`\n` が余分に入る）

Backspace でテキストノードの1文字を削除した後、extractText がモデルの想定と異なるブロック境界 (`\n`) を生成する。

### 状況

- 私の変更（Enter キーで `\n\n` を挿入するバグ修正）の前から存在する既知の不具合
- `git stash` して元のコードに戻しても同様に失敗することを確認済み
- 単独実行では再現しないため、テスト並列実行時の JSDOM 共有状態が関係している可能性がある

### 再現方法

```bash
cd /home/erayn/works/markdown/master
pnpm run test  # モノレポ全体で実行（数回試すと失敗する）
```

### 対応方針（案）

- `BackspaceCommand.check` に追加の制約を加え、段落末尾の文字削除を避ける
- または model-based test の期待値を extractText の実際の挙動に合わせて修正する
- 根本原因: ordered list アイテムの最後の文字を削除すると、パーサーの再解釈によってブロック構造が変化し、extractText の出力が変わる
