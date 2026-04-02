# visual-kerning

[English](./README.md) | [日本語](./README.ja.md)

[![npm](https://img.shields.io/npm/v/visual-kerning.svg)](https://www.npmjs.com/package/visual-kerning)
[![Live Demo](https://img.shields.io/badge/demo-live-0a66ff?style=flat-square)](https://ie3jp.github.io/visual-kerning/)
[![GitHub Pages](https://github.com/ie3jp/visual-kerning/actions/workflows/deploy-demo-pages.yml/badge.svg)](https://github.com/ie3jp/visual-kerning/actions/workflows/deploy-demo-pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2ea44f?style=flat-square)](./LICENSE)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-FF5E5B?style=flat-square&logo=ko-fi&logoColor=white)](https://ko-fi.com/cyocun)

**Webの文字組みを、もっと直感的に。**

ブラウザ上でカーニングを調整し、JSONとして書き出して、
本番DOMへフレームワーク非依存で適用できるツールです。

![visual-kerning demo](.github/readme/demo.gif)

## Demo

**まずはここから:** [ライブデモを開く](https://ie3jp.github.io/visual-kerning/)

- ローカルデモ: `npm run demo`
- 静的ビルド: `npm run demo:build`

> 編集UIは主に開発環境やステージング環境で使う想定です。
> 本番では `createKerningEditor({ editable: false, kerning })` で適用します。

## visual-kerning でできること

CSS の `letter-spacing` は1つの値で十分なときには便利ですが、
実際のUIで文字ペアごとの調整をしたくなると限界があります。

`visual-kerning` は次のような運用を想定しています。

1. 開発中またはステージング中にブラウザ上で視覚的に字間を調整する
2. 結果を JSON として書き出す
3. 本番で適用する

主な特徴:

- **CSSでは不可能なペア単位の字間制御**
  — `letter-spacing` は全文字一律。visual-kerning は1ギャップずつ個別に調整できる
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
npm install visual-kerning
```

## 基本的な使い方

```ts
import { createKerningEditor } from 'visual-kerning'
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

`visual-kerning` は、Webサイト上で見た目の印象が重要なテキストに向いています。

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
`data-visual-kerning-ignore` を付与します:

```html
<div data-visual-kerning-ignore>このテキストは編集対象外になります。</div>
```

## Public API

### `createKerningEditor(options?)`

編集と本番適用の両方をカバーする、唯一の公開API。

```ts
const editor = createKerningEditor({
  locale: 'en',          // 'ja' | 'en'（デフォルト: 'en'）
  editable: true,        // 編集UIを表示する（デフォルト: true）
  kerning: kerningData,  // mount 時に適用する KerningExport データ
  accessible: false,     // スクリーンリーダー対応（デフォルト: false）
})
editor.mount()
```

- `editable: true`（デフォルト）— 編集UI + キーボードショートカット
- `editable: false` + `kerning` — 本番モード。カーニングデータの適用のみ
- `accessible: true` — スクリーンリーダー対応を有効化（[アクセシビリティ](#アクセシビリティ)参照）
- `mount()` / `unmount()` — DOM への接続・切断

`kerning` に渡す `KerningExport` が、公開されているデータ型です。

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

visual-kerning は各文字を `<span>` で囲み、
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

## アクセシビリティ

visual-kerning は各文字を `<span>` で分割するため、
スクリーンリーダーがテキストを1文字ずつ読み上げてしまう可能性があります。

これを防ぐには、本番モードで `accessible` オプションを有効にしてください:

```ts
const editor = createKerningEditor({
  editable: false,
  kerning: kerningData,
  accessible: true,
})
editor.mount()
```

有効にすると、対象要素のDOM構造が以下のように変換されます:

```html
<!-- accessible なし -->
<h1>
  <span class="visual-kerning-char" style="margin-left:...">H</span>
  <span class="visual-kerning-char" style="margin-left:...">e</span>
  ...
</h1>

<!-- accessible: true -->
<h1>
  <span class="visual-kerning-sr-only">Hello</span>
  <span class="visual-kerning-visual" aria-hidden="true">
    <span class="visual-kerning-char" style="margin-left:...">H</span>
    <span class="visual-kerning-char" style="margin-left:...">e</span>
    ...
  </span>
</h1>
```

スクリーンリーダーは visually-hidden な元テキストを読み上げ、
カーニング済みのspan群は `aria-hidden` で無視されます。

> **注意:** DOM構造が変わるため、カーニング対象要素の子要素を直接参照する
> CSSやJSがある場合はセレクタの調整が必要になることがあります。

## CSSクラス

visual-kerning がDOMに付与するクラス一覧:

| クラス | 付与先 | 説明 |
|-------|--------|------|
| `visual-kerning-char` | 各文字の `<span>` | カーニング対象の文字に常に付与 |
| `visual-kerning-sr-only` | visually-hidden テキスト | `accessible: true` 時のみ — 元テキストを保持 |
| `visual-kerning-visual` | カーニング済みspanのラッパー | `accessible: true` 時のみ — `aria-hidden="true"` |
| `visual-kerning-active` | 対象要素 | 編集中のテキストブロックに付与 |
| `visual-kerning-modified` | 対象要素 | カーニングが適用されたブロックに付与 |

```css
/* 例: カーニング済み文字のスタイル */
.visual-kerning-char {
  /* 各文字span */
}

/* 例: accessible有効時のビジュアルラッパー */
.visual-kerning-visual {
  /* カーニング済みspan群を囲む。スクリーンリーダーからは隠される */
}
```

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

## Support

> [!TIP]
> このツールが役に立ったら、応援いただけると励みになります — [buy me a coffee!](https://ko-fi.com/cyocun)

## License

[MIT](./LICENSE)
