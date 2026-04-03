# Visual Kerning

[English](./README.md) | [日本語](./README.ja.md)

[![npm](https://img.shields.io/npm/v/visual-kerning.svg)](https://www.npmjs.com/package/visual-kerning)
[![Playground](https://img.shields.io/badge/playground-live-0a66ff?style=flat-square)](https://ie3jp.github.io/visual-kerning/)
[![GitHub Pages](https://github.com/ie3jp/visual-kerning/actions/workflows/deploy-demo-pages.yml/badge.svg)](https://github.com/ie3jp/visual-kerning/actions/workflows/deploy-demo-pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2ea44f?style=flat-square)](./LICENSE)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-FF5E5B?style=flat-square&logo=ko-fi&logoColor=white)](https://ko-fi.com/cyocun)

**Make web typography more intuitive.**

Adjust kerning in the browser, export it as JSON,
and apply it to production DOM without tying yourself to a specific framework.

![Visual Kerning demo](.github/readme/ogp.gif)

## Playground

**Start here:** [Open the playground](https://ie3jp.github.io/visual-kerning/)

- Local demo: `npm run demo`
- Static build: `npm run demo:build`

> The editing UI is intended for development and staging.
> In production, use `visualKerning({ editable: false, kerning })`.

## Why Visual Kerning

CSS `letter-spacing` is great when one value is enough.
It becomes limiting when you need pair-by-pair adjustments in real UI.

Visual Kerning is built for teams who want a practical workflow like this:

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
npm install visual-kerning
```

## The intended workflow

```ts
import { visualKerning } from 'visual-kerning'
```

**1. Edit** — mount the editor in development or staging.
Adjust kerning visually, then export JSON from the palette.

```ts
const editor = visualKerning({ editable: true })
editor.mount()
```

You can also pass exported JSON via the `kerning` option
to continue editing from a previous export.

**2. Apply** — mount with the exported JSON in production.

```ts
const editor = visualKerning({ editable: false, kerning: kerningData })
await editor.mount()
```

`mount()` returns a `Promise` that resolves once kerning is applied.
Use `await` to defer rendering (e.g. removing `visibility: hidden`)
until text is properly kerned.

In editing mode, you can also drag & drop the exported JSON file
onto the editor panel to re-import it.

## What it works well for

Visual Kerning is aimed at text that matters visually on a normal website.

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

When editing, Visual Kerning wraps visible characters in spans
while trying to preserve useful inline structure.

To exclude an element from editing,
add `data-visual-kerning-ignore`:

```html
<div data-visual-kerning-ignore>This text will not be editable.</div>
```

## Public API

### `visualKerning(options?)`

The single public entry point for both editing and production use.

```ts
const editor = visualKerning({
  locale: 'en',          // 'ja' | 'en' (default: 'en')
  editable: true,        // show editing UI (default: true)
  kerning: kerningData,  // apply KerningExport on mount
  accessible: false,     // screen reader support (default: false)
})
editor.mount()
```

- `editable: true` (default) — editing UI + keyboard shortcuts
- `editable: false` + `kerning` — production mode, applies kerning data only
- `accessible: true` — adds screen reader support (see [Accessibility](#accessibility))
- `mount()` / `unmount()` — attach / detach from the DOM. `mount()` returns a `Promise<void>` that resolves once kerning is applied

`KerningExport` is the public data shape used by the `kerning` option.

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
| `Alt + Shift + ←/→` | Adjust by ±1 |
| `Alt + ←/→` | Adjust by ±10 |
| `Alt + Cmd/Ctrl + ←/→` | Adjust by ±100 |
| `Esc` | Clear selection |
| `B` | Toggle Before / After compare |

When multiple gaps are selected,
`Alt + ←/→` adjusts all selected gaps at once (tracking).

<details>
<summary>Is it Illustrator-like?</summary>

The kerning adjustment keys are intentionally close to Illustrator:

- `Alt/Option + Shift + ←/→`: fine adjustment (±1)
- `Alt/Option + ←/→`: standard adjustment (±10)
- `Alt/Option + Cmd/Ctrl + ←/→`: coarse adjustment (±100)

The browsing and editing workflow itself is browser-specific:

- `Cmd/Ctrl + K`: toggle editor
- `Tab` / `Shift+Tab`: move between gaps
- `B`: Before / After compare
- `Esc`: clear selection
</details>

## Why `margin-left` instead of `letter-spacing`

Visual Kerning wraps each visible character in a `<span>`
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

## Accessibility

Visual Kerning wraps each character in a `<span>`,
which can cause screen readers to read text one character at a time.

To prevent this, enable the `accessible` option in production mode:

```ts
const editor = visualKerning({
  editable: false,
  kerning: kerningData,
  accessible: true,
})
editor.mount()
```

When enabled, each target element is restructured:

```html
<!-- Before (without accessible) -->
<h1>
  <span class="visual-kerning-char" style="margin-left:...">H</span>
  <span class="visual-kerning-char" style="margin-left:...">e</span>
  ...
</h1>

<!-- After (with accessible: true) -->
<h1>
  <span class="visual-kerning-sr-only">Hello</span>
  <span class="visual-kerning-presentation" aria-hidden="true">
    <span class="visual-kerning-char" style="margin-left:...">H</span>
    <span class="visual-kerning-char" style="margin-left:...">e</span>
    ...
  </span>
</h1>
```

Screen readers read the visually-hidden original text,
while the kerned spans are hidden via `aria-hidden`.

> **Note:** This changes the DOM structure.
> If your CSS or JS references child elements of kerning targets directly,
> selectors may need adjustment.

## CSS classes

Visual Kerning adds these classes to the DOM for styling and selection:

| Class | Applied to | Description |
|-------|-----------|-------------|
| `visual-kerning-char` | Each character `<span>` | Always present on kerned characters |
| `visual-kerning-sr-only` | Visually-hidden text | Only with `accessible: true` — contains the original readable text |
| `visual-kerning-presentation` | Wrapper around kerned spans | Only with `accessible: true` — has `aria-hidden="true"` |
| `visual-kerning-active` | Target element | Added while the element is being edited |
| `visual-kerning-modified` | Target element | Added when kerning has been applied |

```css
/* Example: style kerned characters */
.visual-kerning-char {
  /* each character span */
}

/* Example: target the visual wrapper when accessible is enabled */
.visual-kerning-presentation {
  /* wraps all kerned spans, hidden from screen readers */
}
```

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

## Support

> [!TIP]
> If this tool helps your workflow, your support means a lot — [buy me a coffee!](https://ko-fi.com/cyocun)

## License

[MIT](./LICENSE)
