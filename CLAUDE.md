# CLAUDE.md

このファイルは、このリポジトリでAIアシスタント（Claude/Copilot等）が作業する際のガイドラインです。

## Project summary

- ライブラリ名: `visual-kerning`
- 目的: ブラウザ上で調整したカーニングをJSON化し、DOMに適用する
- 主要公開API:
  - `visualKerning` — 統合API（editable オプションで編集/本番切替）
- 外部依存ゼロ（フレームワーク非依存）

## Key files

- `src/index.ts`: 公開エクスポート定義
- `src/applyKerning.ts`: JSON適用ロジック
- `src/kerningEditor.ts`: 編集コア状態とイベント処理
- `src/kerningUI.ts`: 統合エディタUI
- `demo/tour.ts`: デモ用ツアー機能
- `src/validation.ts`: バリデーション
- `src/editorMessages.ts`: i18nメッセージ定義
- `llms.txt`: LLM向けAPI仕様（npmパッケージに同梱）

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
- API追加時は `index.ts`、`README.md`、`llms.txt` を必ず更新する
- 仕様変更時は `tests/unit` または `tests/e2e` を追加/更新する
