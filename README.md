# typespacing

[English](./README.md) | [日本語](./README.ja.md)

[![Live Demo](https://img.shields.io/badge/demo-live-0a66ff?style=flat-square)](https://cyocun.github.io/typespacing/)
[![GitHub Pages](https://github.com/cyocun/typespacing/actions/workflows/deploy-demo-pages.yml/badge.svg)](https://github.com/cyocun/typespacing/actions/workflows/deploy-demo-pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2ea44f?style=flat-square)](./LICENSE)

**Make web typography more intuitive.**

Adjust kerning in the browser, export it as JSON,
and apply it to production DOM without tying yourself to a specific framework.

## Demo

**Start here:** [Open the live demo](https://cyocun.github.io/typespacing/)

![typespacing demo](.github/readme/demo.gif)

- Local demo: `npm run demo`
- Static build: `npm run demo:build`

> The editing UI is intended for development and staging.
> In production, use `createKerningEditor({ editable: false, kerning })`.

## Why typespacing

CSS `letter-spacing` is great when one value is enough.
It becomes limiting when you need pair-by-pair adjustments in real UI.

`typespacing` is built for teams who want a practical workflow like this:

1. Tune spacing visually in the browser during development or staging.
2. Export the result as JSON.
3. Apply the exported data in production.

Main strengths:

- **Per-gap control that CSS can't do**
  — `letter-spacing` is uniform; this adjusts each character pair independently
- **Illustrator-like editing**
  — Alt + Arrow keys for fine/coarse adjustment, directly in the browser
- **One API from editing to production**
  — edit in staging, export JSON, apply in production with the same library
- **Preserves inline markup**
  — `<em>`, `<strong>`, `<span>` and other inline elements survive the wrapping process
- **Zero dependencies, framework-agnostic**
  — works with any stack, no runtime overhead
- **Event-driven integration**
  — hook into `enable`, `disable`, `change` events to coordinate with your app

## Install

```bash
npm install typespacing
```

## The intended workflow

```ts
import { createKerningEditor } from 'typespacing'
```

**1. Edit** — mount the editor in development or staging.
Adjust kerning visually, then export JSON from the palette.

```ts
const editor = createKerningEditor({ editable: true })
editor.mount()
```

You can also pass exported JSON via the `kerning` option
to continue editing from a previous export.

**2. Apply** — mount with the exported JSON in production.

```ts
const editor = createKerningEditor({ editable: false, kerning: kerningData })
editor.mount()
```

## What it works well for

`typespacing` is aimed at text that matters visually on a normal website.

- Headings
- Hero copy
- Display typography
- Mixed-font titles
- Short editorial lines
- Short multiline text with `<br>`

It is practical for ordinary websites, landing pages,
marketing sites, portfolios, and editorial-style UI.

## Supported content

- Plain text in a single element
- Multiline text using `<br>`
- Inline formatting inside the target element
  — e.g. `<span>`, `<em>`, `<strong>`, `<b>`, `<i>`

When editing, `typespacing` wraps visible characters in spans
while trying to preserve useful inline structure.

To exclude an element from editing,
add `data-typespacing-ignore`:

```html
<div data-typespacing-ignore>This text will not be editable.</div>
```

## Public API

### `createKerningEditor(options?)`

The single entry point for both editing and production use.

```ts
const editor = createKerningEditor({
  locale: 'en',          // 'ja' | 'en' (default: 'en')
  editable: true,        // show editing UI (default: true)
  kerning: kerningData,  // apply KerningExport on mount
})
editor.mount()
```

- `editable: true` (default) — editing UI + keyboard shortcuts
- `editable: false` + `kerning` — production mode, applies kerning data only
- `mount()` / `unmount()` — attach / detach from the DOM

#### Events

Subscribe to lifecycle events. `on()` returns a dispose function.

```ts
editor.on('enable', () => { document.body.style.overflow = 'hidden' })
editor.on('disable', () => { document.body.style.overflow = '' })
editor.on('change', ({ selector, kerning, indent }) => { /* ... */ })
editor.on('select', ({ selector, gapIndex, gapIndexEnd }) => { /* ... */ })
editor.on('reset', () => { /* ... */ })
```

Unsubscribing:

```ts
const off = editor.on('change', handleChange)
off()
```

## Editor shortcuts

| Key | Action |
|-----|--------|
| `Cmd/Ctrl + K` | Toggle edit mode |
| Click | Select a text block and gap |
| `Shift + Click` | Extend selection to a range |
| `Tab` / `Shift+Tab` | Next / previous gap |
| `←` / `→` | Move cursor |
| `Shift + ←/→` | Extend selection |
| `↑` / `↓` | Move up / down within the same text block |
| `Alt + ←/→` | Adjust by ±10 |
| `Alt + Cmd/Ctrl + ←/→` | Adjust by ±100 |
| `Esc` | Clear selection |
| `B` | Toggle Before / After compare |

When multiple gaps are selected,
`Alt + ←/→` adjusts all selected gaps at once (tracking).

<details>
<summary>Is it Illustrator-like?</summary>

The kerning adjustment keys are intentionally close to Illustrator:

- `Alt/Option + ←/→`: fine adjustment
- `Alt/Option + Cmd/Ctrl + ←/→`: larger adjustment

The browsing and editing workflow itself is browser-specific:

- `Cmd/Ctrl + K`: toggle editor
- `Tab` / `Shift+Tab`: move between gaps
- `B`: Before / After compare
- `Esc`: clear selection
</details>

## Why `margin-left` instead of `letter-spacing`

typespacing wraps each visible character in a `<span>`
and controls spacing via `margin-left` on each span.
This is a deliberate choice over `letter-spacing`:

- **`letter-spacing` on single-char spans is unreliable.**
  The property adds space *between characters within an element*
  — but with only one character per span, there is no "between."
  Browser behavior varies.
- **`letter-spacing` bleeds at line breaks.**
  It widens the character's box itself,
  leaving unwanted trailing space at the end of wrapped lines.
- **`margin-left` is predictable across contexts.**
  It follows the box model spec: the gap sits between adjacent spans
  regardless of line breaks, inline wrappers (`<em>`, `<strong>`),
  or parent element styles.
- **No double-application with inherited `letter-spacing`.**
  If the parent element has `letter-spacing`, `margin-left` doesn't interfere.
  The library reads the inherited value
  and includes it in the margin calculation via `calc()`.

## Limitations

- It is not a general-purpose long-form typesetting system
- It focuses on text that matters visually,
  not every text node on a page
- It aims to be practical for ordinary websites,
  but does not promise perfect reconstruction of every possible
  HTML structure or heavily decorated inline markup

## Development

```bash
npm install
npm run build
npm test
npm run smoke
npm run demo
```

### Available scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build the package into `dist/` |
| `npm test` | Run Vitest |
| `npm run smoke` | Core smoke tests + demo E2E |
| `npm run smoke:ci` | CI-oriented smoke run |
| `npm run e2e` | Playwright E2E only |
| `npm run demo` | Local demo at `http://127.0.0.1:4173` |
| `npm run demo:build` | Static demo build into `demo-dist/` |

Before the first E2E run:

```bash
npx playwright install
```

## License

[MIT](./LICENSE)
