# CLAUDE.md

このファイルは、このリポジトリでAIアシスタント（Claude/Copilot等）が作業する際のガイドラインです。

## Project summary

- ライブラリ名: `kerning`
- 目的: ブラウザ上で調整したカーニングをJSON化し、DOMに適用する
- 主要公開API:
  - `createKerningEditor` — 統合API（editable オプションで編集/本番切替）
- 外部依存ゼロ（フレームワーク非依存）

## Key files

- `src/applyKerning.ts`: JSON適用ロジック
- `src/kerningEditor.ts`: 編集コア状態とイベント処理
- `src/kerningUI.ts`: 統合エディタUI
- `src/index.ts`: 公開エクスポート定義

## Development commands

```bash
npm install
npm test
npm run smoke
npm run smoke:ci
npm run e2e
npm run demo
```

## Test policy

- 変更時は最低でも `npm test` を実行
- UI/操作系の変更時は `npm run smoke` も実行
- CI想定の確認は `npm run smoke:ci`

## Editing guidelines

- 既存の日本語コメント/命名スタイルを尊重する
- 既存ショートカット挙動を壊さない（`Cmd/Ctrl+K`, `B`, `Esc` など）
- API追加時は `index.ts` と `README.md` を必ず更新する
- 仕様変更時は `tests/unit` または `tests/e2e` を追加/更新する

