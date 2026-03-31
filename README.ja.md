# typespacing

[English](./README.md) | [日本語](./README.ja.md)

[![Live Demo](https://img.shields.io/badge/demo-live-0a66ff?style=flat-square)](https://cyocun.github.io/typespacing/)
[![GitHub Pages](https://github.com/cyocun/typespacing/actions/workflows/deploy-demo-pages.yml/badge.svg)](https://github.com/cyocun/typespacing/actions/workflows/deploy-demo-pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2ea44f?style=flat-square)](./LICENSE)

**Webの文字組みを、もっと直感的に。**

ブラウザ上でカーニングを調整し、JSONとして書き出して、
本番DOMへフレームワーク非依存で適用できるツールです。

## Demo

**まずはここから:** [ライブデモを開く](https://cyocun.github.io/typespacing/)

![typespacing demo](.github/readme/demo.gif)

- ローカルデモ: `npm run demo`
- 静的ビルド: `npm run demo:build`

> 編集UIは主に開発環境やステージング環境で使う想定です。
> 本番では `createKerningEditor({ editable: false, kerning })` で適用します。

## typespacing でできること

CSS の `letter-spacing` は1つの値で十分なときには便利ですが、
実際のUIで文字ペアごとの調整をしたくなると限界があります。

`typespacing` は次のような運用を想定しています。

1. 開発中またはステージング中にブラウザ上で視覚的に字間を調整する
2. 結果を JSON として書き出す
3. 本番で適用する

主な特徴:

- **CSSでは不可能なペア単位の字間制御**
  — `letter-spacing` は全文字一律。typespacing は1ギャップずつ個別に調整できる
- **Illustratorライクな操作**
  — Alt + 矢印キーで微調整/粗調整、ブラウザ上で直接編集
- **編集から本番まで1つのAPI**
  — ステージングで編集・JSON書き出し → 本番で同じライブラリで適用
- **インライン装飾を破壊しない**
  — `<em>`, `<strong>`, `<span>` 等の構造を保ったまま文字をラップ
- **依存ゼロ、フレームワーク非依存**
  — どのスタックでも動作し、ランタイムオーバーヘッドなし
- **イベント駆動で既存サイトに統合**
  — `enable`, `disable`, `change` 等のイベントでアプリと連携

## Install

```bash
npm install typespacing
```

## 基本的な使い方

```ts
import { createKerningEditor } from 'typespacing'
```

**1. 編集** — 開発環境やステージングでエディタをマウント。
ブラウザ上でカーニングを調整し、パレットからJSONを書き出す。

```ts
const editor = createKerningEditor({ editable: true })
editor.mount()
```

`kerning` オプションに書き出し済みの JSON を渡せば、
前回のエクスポートから編集を再開できます。

**2. 適用** — 書き出したJSONを本番でマウント。

```ts
const editor = createKerningEditor({ editable: false, kerning: kerningData })
editor.mount()
```

## 向いている用途

`typespacing` は、Webサイト上で見た目の印象が重要なテキストに向いています。

- 見出し
- ヒーローコピー
- ディスプレイタイポグラフィ
- 複数フォントを混在させたタイトル
- 短いエディトリアル見出し
- `<br>` を含む短い複数行テキスト

ランディングページ、ブランドサイト、ポートフォリオ、
エディトリアル寄りのUIなどで実用的です。

## 対応コンテンツ

- 単一要素内のプレーンテキスト
- `<br>` を使った複数行テキスト
- 対象要素内のインライン装飾
  — 例: `<span>`, `<em>`, `<strong>`, `<b>`, `<i>`

編集時は、インライン構造をできるだけ保ちながら
可視文字を `span` 化して処理します。

特定の要素を編集対象から除外するには
`data-typespacing-ignore` を付与します:

```html
<div data-typespacing-ignore>このテキストは編集対象外になります。</div>
```

## Public API

### `createKerningEditor(options?)`

編集と本番適用の両方をカバーする統合API。

```ts
const editor = createKerningEditor({
  locale: 'en',          // 'ja' | 'en'（デフォルト: 'en'）
  editable: true,        // 編集UIを表示する（デフォルト: true）
  kerning: kerningData,  // mount 時に適用する KerningExport データ
})
editor.mount()
```

- `editable: true`（デフォルト）— 編集UI + キーボードショートカット
- `editable: false` + `kerning` — 本番モード。カーニングデータの適用のみ
- `mount()` / `unmount()` — DOM への接続・切断

#### Events

ライフサイクルイベントを購読できます。`on()` は解除関数を返します。

```ts
editor.on('enable', () => { document.body.style.overflow = 'hidden' })
editor.on('disable', () => { document.body.style.overflow = '' })
editor.on('change', ({ selector, kerning, indent }) => { /* ... */ })
editor.on('select', ({ selector, gapIndex, gapIndexEnd }) => { /* ... */ })
editor.on('reset', () => { /* ... */ })
```

購読解除:

```ts
const off = editor.on('change', handleChange)
off()
```

## ショートカット

| キー | 操作 |
|------|------|
| `Cmd/Ctrl + K` | 編集モード切り替え |
| クリック | テキストブロックとギャップを選択 |
| `Shift + クリック` | 範囲選択に拡張 |
| `Tab` / `Shift+Tab` | 次 / 前のギャップへ移動 |
| `←` / `→` | カーソル移動 |
| `Shift + ←/→` | 範囲選択を拡張 |
| `↑` / `↓` | 同じテキストブロック内で上下移動 |
| `Alt + ←/→` | ±10 調整 |
| `Alt + Cmd/Ctrl + ←/→` | ±100 調整 |
| `Esc` | 選択解除 |
| `B` | Before / After 比較切り替え |

複数ギャップを選択した状態で `Alt + ←/→` を押すと、
選択範囲内の全ギャップを一括調整できます（トラッキング）。

<details>
<summary>Illustrator ライク？</summary>

カーニング調整キーは Illustrator に近い操作感を意識しています。

- `Alt/Option + ←/→`: 細かく調整
- `Alt/Option + Cmd/Ctrl + ←/→`: 大きく調整

一方で、閲覧・編集フロー自体はブラウザ向けです。

- `Cmd/Ctrl + K`: エディタ切り替え
- `Tab` / `Shift+Tab`: ギャップ移動
- `B`: Before / After 比較
- `Esc`: 選択解除
</details>

## なぜ `letter-spacing` ではなく `margin-left` か

typespacing は各文字を `<span>` で囲み、
`margin-left` で字間を制御します。
`letter-spacing` を使わないのは意図的な設計です。

- **1文字 span に `letter-spacing` は不安定。**
  `letter-spacing` は要素内の文字間に作用するプロパティだが、
  span 内に1文字しかなければ「間」が存在しない。
  ブラウザによって挙動が異なる。
- **`letter-spacing` は行末に余白が漏れる。**
  文字ボックス自体の幅が広がるため、
  折り返し時に行末へ意図しない空白が出る。
- **`margin-left` はどの文脈でも予測どおりに動く。**
  ボックスモデルの仕様に従い、
  改行やインラインラッパー（`<em>`, `<strong>`）を跨いでも
  隣接 span 間の距離として正しく機能する。
- **親要素の `letter-spacing` と干渉しない。**
  `margin` は `letter-spacing` と独立している。
  親に指定された `letter-spacing` はライブラリ側が読み取り、
  `calc()` で margin に加算して継承する。

## 制限事項

- 長文組版向けの汎用システムではありません
- すべてのテキストノードではなく、
  見た目の重要なテキストに向いています
- 一般的なWeb用途では実用的ですが、
  あらゆるHTML構造や複雑な装飾を完全再現することは目的にしていません

## Development

```bash
npm install
npm run build
npm test
npm run smoke
npm run demo
```

### 利用可能な scripts

| Script | 説明 |
|--------|------|
| `npm run build` | パッケージを `dist/` にビルド |
| `npm test` | Vitest 実行 |
| `npm run smoke` | コア smoke テスト + demo E2E |
| `npm run smoke:ci` | CI 向け smoke 実行 |
| `npm run e2e` | Playwright E2E のみ |
| `npm run demo` | ローカルデモを `http://127.0.0.1:4173` で起動 |
| `npm run demo:build` | 静的デモを `demo-dist/` にビルド |

初回の E2E 実行前:

```bash
npx playwright install
```

## License

[MIT](./LICENSE)
