import { assertValidKerningExport } from './validation'

/**
 * カーニングJSON適用ユーティリティ
 *
 * デザイナーがブラウザ上で調整・書き出したカーニングJSONを
 * エンジニアがDOMに適用するための関数。
 * フレームワーク非依存（Vanilla JS）で動作する。
 *
 * @example
 * import { applyKerning } from 'typespacing'
 * import data from './kerning-export.json'
 * document.addEventListener('DOMContentLoaded', () => applyKerning(data))
 */

export interface KerningArea {
  /** 対象要素を特定するCSSセレクタ */
  selector: string
  /** 元のテキスト内容（検証用） */
  text: string
  /** フォント情報（参考用） */
  font: { family: string; weight: string; size: string }
  /** 1文字目の左のスペース（1/1000em単位） */
  indent?: number
  /** 各文字の後ろ側ギャップ量（1/1000em単位）。配列長 = 改行を除く表示文字数 */
  kerning: number[]
}

/** 現行フォーマットバージョン */
export const KERNING_FORMAT_VERSION = 1

export interface KerningExport {
  /** フォーマットバージョン */
  version?: number
  /** 書き出し日時（ISO 8601） */
  exported: string
  /** 対象ページのパス */
  page: string
  /** カーニング対象テキストエリア一覧 */
  areas: KerningArea[]
}

export interface WrappedTextResult {
  spans: HTMLElement[]
  brPositions: number[]
}

function readKerningLength(value?: string): number | null {
  const raw = value?.trim()
  if (!raw) return null

  if (!raw.startsWith('calc(')) {
    if (!raw.endsWith('em')) return null
    const parsed = Number.parseFloat(raw)
    return Number.isFinite(parsed) ? Math.round(parsed * 1000) : null
  }

  const inner = raw.slice(5, -1).replace(/\s+/g, '')
  let total = 0
  let found = false

  for (const match of inner.matchAll(/([+-]?\d*\.?\d+)em/g)) {
    total += Number.parseFloat(match[1]!)
    found = true
  }

  return found ? Math.round(total * 1000) : null
}

export function getKerningCharCount(text: string): number {
  let count = 0
  for (const char of text) {
    if (char !== '\n') count++
  }
  return count
}

export function normalizeKerning(kerning: number[], charCount: number): number[] {
  if (kerning.length === charCount) return [...kerning]

  const normalized = kerning.slice(0, charCount)
  while (normalized.length < charCount) normalized.push(0)
  return normalized
}

export function normalizeKerningForText(kerning: number[], text: string): number[] {
  return normalizeKerning(kerning, getKerningCharCount(text))
}

function warnKerningLengthMismatch(selector: string, expected: number, actual: number) {
  console.warn(
    `[typespacing] Kerning length mismatch for ${selector}: expected ${expected}, got ${actual}. Padding/truncating to match visible characters.`,
  )
}

function createKerningSpan(
  char: string,
  spanClassName?: string,
): HTMLElement {
  const span = document.createElement('span')
  if (spanClassName) span.className = spanClassName
  span.textContent = char
  return span
}

function appendKerningSpan(
  container: Node,
  char: string,
  spans: HTMLElement[],
  spanClassName?: string,
) {
  const span = createKerningSpan(char, spanClassName)
  container.appendChild(span)
  spans.push(span)
}

/**
 * 1文字span群にカーニングとindentを反映する。
 * kerning[i] のギャップは span[i+1] の margin-left で表現する。
 * indent は span[0] の margin-left で表現する。
 */
export function applyKerningToSpans(spans: HTMLElement[], kerning: number[], indent = 0) {
  // 親要素の letter-spacing を継承する（1文字spanでは letter-spacing が効かないため margin で代替）
  const parentEl = spans[0]?.parentElement
  const inheritedLS = parentEl ? getComputedStyle(parentEl).letterSpacing : '0px'
  const inheritedPx = inheritedLS === 'normal' ? 0 : parseFloat(inheritedLS) || 0

  spans.forEach((span, i) => {
    span.style.letterSpacing = '0em'
    span.style.removeProperty('margin-right')

    // margin-left = 前のギャップ（kerning[i-1]）+ 継承 letter-spacing
    const gap = i === 0 ? indent : (kerning[i - 1] ?? 0)
    const lsMargin = i > 0 ? inheritedPx : 0
    if (gap !== 0 || lsMargin !== 0) {
      span.style.marginLeft = lsMargin !== 0
        ? `calc(${gap / 1000}em + ${lsMargin}px)`
        : `${gap / 1000}em`
    } else {
      span.style.removeProperty('margin-left')
    }
  })
}

/**
 * 要素内の子ノードから、1文字spanで構成された並びを取得する。
 * BR要素と空白テキストノードは許容する。
 */
export function getSingleCharSpans(el: Element): HTMLElement[] | null {
  const spans: HTMLElement[] = []

  function visit(node: Node): boolean {
    for (const childNode of Array.from(node.childNodes)) {
      if (childNode.nodeType === Node.TEXT_NODE) {
        if ((childNode.textContent?.trim() ?? '') !== '') return false
        continue
      }

      if (childNode.nodeType !== Node.ELEMENT_NODE) continue
      const child = childNode as HTMLElement
      if (child.tagName === 'BR') continue

      if (child.tagName === 'SPAN' && child.children.length === 0 && (child.textContent?.length ?? 0) === 1) {
        spans.push(child)
        continue
      }

      if (!visit(child)) return false
    }
    return true
  }

  if (!visit(el)) return null
  return spans.length >= 2 ? spans : null
}

/**
 * 既存の1文字spanラップからカーニング値を抽出する。
 * 現行の margin-right と旧来の letter-spacing の両方を読める。
 */
export function extractKerningFromWrapped(
  el: Element,
): { text: string; kerning: number[]; indent: number } | null {
  const spans = getSingleCharSpans(el)
  if (!spans) return null

  const text = spans.map(s => s.textContent).join('')

  // kerning[i] = span[i] と span[i+1] の間のギャップ
  // 新方式: span[i+1].marginLeft / 旧方式: span[i].marginRight or letterSpacing
  const kerning = spans.map((span, i) => {
    const next = spans[i + 1]
    const marginLeft = readKerningLength(next?.style.marginLeft)
    if (marginLeft !== null) return marginLeft

    const marginRight = readKerningLength(span.style.marginRight)
    if (marginRight !== null) return marginRight

    const letterSpacing = readKerningLength(span.style.letterSpacing)
    if (letterSpacing !== null) return letterSpacing

    return 0
  })

  const indent = readKerningLength(spans[0]?.style.marginLeft) ?? 0

  return { text, kerning, indent }
}

/**
 * テキストを1文字ずつspanに分割してカーニングを適用する。
 * DOM APIのみ使用（innerHTML不使用）。
 */
export function wrapTextWithKerning(
  el: HTMLElement,
  text: string,
  kerning: number[],
  options: { indent?: number; spanClassName?: string } = {},
): WrappedTextResult {
  const { indent = 0, spanClassName } = options
  const normalizedKerning = normalizeKerningForText(kerning, text)

  while (el.firstChild) el.removeChild(el.firstChild)

  const spans: HTMLElement[] = []
  const brPositions: number[] = []
  let spanIndex = 0

  for (const char of text) {
    if (char === '\n') {
      el.appendChild(document.createElement('br'))
      brPositions.push(spanIndex)
      continue
    }

    const span = document.createElement('span')
    if (spanClassName) span.className = spanClassName
    span.textContent = char
    el.appendChild(span)
    spans.push(span)
    spanIndex++
  }

  applyKerningToSpans(spans, normalizedKerning, indent)
  return { spans, brPositions }
}

/**
 * 既存のインライン構造を保ちながら、各文字だけをspan化してカーニングを適用する。
 * 見出し内の複数フォント・強調などのインライン装飾を保持したいときに使う。
 */
export function wrapElementWithKerning(
  el: HTMLElement,
  kerning: number[],
  options: { indent?: number; spanClassName?: string } = {},
): WrappedTextResult {
  const { indent = 0, spanClassName } = options
  const spans: HTMLElement[] = []
  const brPositions: number[] = []
  let pendingSpace = false
  let hasVisibleChar = false

  function insertPendingSpaceBefore(nextNode: ChildNode) {
    if (!pendingSpace || !hasVisibleChar) return
    const span = createKerningSpan(' ', spanClassName)
    nextNode.parentNode?.insertBefore(span, nextNode)
    spans.push(span)
    pendingSpace = false
  }

  function flushPendingSpace(container: Node) {
    if (!pendingSpace || !hasVisibleChar) return
    appendKerningSpan(container, ' ', spans, spanClassName)
    pendingSpace = false
  }

  function wrapChildren(node: Node) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const original = child.textContent ?? ''
        const fragment = document.createDocumentFragment()

        for (const rawChar of original) {
          if (/\s/.test(rawChar)) {
            pendingSpace = hasVisibleChar || pendingSpace
            continue
          }
          flushPendingSpace(fragment)
          appendKerningSpan(fragment, rawChar, spans, spanClassName)
          hasVisibleChar = true
        }

        child.replaceWith(fragment)
        continue
      }

      if (child.nodeType !== Node.ELEMENT_NODE) continue
      const childEl = child as HTMLElement
      if (childEl.tagName === 'BR') {
        pendingSpace = false
        if (hasVisibleChar) brPositions.push(spans.length)
        continue
      }
      insertPendingSpaceBefore(childEl)
      wrapChildren(childEl)
    }
  }

  wrapChildren(el)
  applyKerningToSpans(spans, normalizeKerning(kerning, spans.length), indent)
  return { spans, brPositions }
}

/**
 * 要素内の可視テキストを取得し、<br>を\nとして保持する。
 * HTML整形由来の改行/インデントは単一スペースへ正規化する。
 */
export function collectKerningText(node: Node): string {
  const BREAK_TOKEN = '\u0000'

  function walk(current: Node): string {
    if (current.nodeType === Node.TEXT_NODE) {
      return (current.textContent ?? '').replace(/\s+/g, ' ')
    }

    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as HTMLElement
      if (el.tagName === 'BR') return BREAK_TOKEN
      return Array.from(el.childNodes).map(walk).join('')
    }

    return ''
  }

  return walk(node)
    .replace(/ {2,}/g, ' ')
    .replace(new RegExp(` *${BREAK_TOKEN} *`, 'g'), '\n')
    .trim()
}

/**
 * カーニングJSONをDOMに適用する。
 *
 * 対象要素のテキストを1文字ずつspanで分割し、
 * 各spanの margin-right / margin-left にギャップ量を設定する。
 * 既に1文字spanで分割済みの要素はそのまま値を適用する。
 *
 * @param data - カーニングJSON
 * @param options.warnMissing - セレクタ不一致時にconsole.warnを出す（default: true）
 */
export function applyKerning(
  data: KerningExport,
  options: { warnMissing?: boolean } = {},
) {
  assertValidKerningExport(data)
  const { warnMissing = true } = options

  if (warnMissing && data.version !== undefined && data.version > KERNING_FORMAT_VERSION) {
    console.warn(
      `[typespacing] Data format version ${data.version} is newer than supported version ${KERNING_FORMAT_VERSION}. Some features may not work correctly.`,
    )
  }

  for (const area of data.areas) {
    const el = document.querySelector(area.selector) as HTMLElement | null
    if (!el) {
      if (warnMissing) console.warn(`[typespacing] Element not found: ${area.selector}`)
      continue
    }

    if (warnMissing && el.tagName === 'SPAN') {
      console.warn(
        `[typespacing] Target element is a <span>: "${area.selector}". `
        + 'Wrapping may produce nested spans. Consider using a block-level element (e.g. <p>, <div>, <h1>) as the kerning target.',
      )
    }

    // 既に1文字spanで分割済みか判定
    const wrappedSpans = getSingleCharSpans(el)

    if (wrappedSpans) {
      if (warnMissing && area.kerning.length !== wrappedSpans.length) {
        warnKerningLengthMismatch(area.selector, wrappedSpans.length, area.kerning.length)
      }
      applyKerningToSpans(
        wrappedSpans,
        normalizeKerning(area.kerning, wrappedSpans.length),
        area.indent ?? 0,
      )
    } else {
      const text = collectKerningText(el)
      if (text !== area.text && warnMissing) {
        console.warn(`[typespacing] Text mismatch for ${area.selector}: expected "${area.text}", got "${text}"`)
      }
      const normalizedKerning = normalizeKerningForText(area.kerning, text)
      if (warnMissing && area.kerning.length !== normalizedKerning.length) {
        warnKerningLengthMismatch(area.selector, normalizedKerning.length, area.kerning.length)
      }
      wrapElementWithKerning(el, normalizedKerning, { indent: area.indent ?? 0 })
    }
  }
}
