/**
 * カーニングJSON適用ユーティリティ
 *
 * デザイナーがブラウザ上で調整・書き出したカーニングJSONを
 * エンジニアがDOMに適用するための関数。
 * フレームワーク非依存（Vanilla JS）で動作する。
 *
 * @example
 * import { applyKerning } from 'kerning'
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
  /** 各文字のletter-spacing（1/1000em単位）。配列長 = text.length */
  kerning: number[]
}

export interface KerningExport {
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

/**
 * 1文字span群にカーニングとindentを反映する。
 */
export function applyKerningToSpans(spans: HTMLElement[], kerning: number[], indent = 0) {
  spans.forEach((span, i) => {
    const k = kerning[i] ?? 0
    if (k !== 0) {
      span.style.letterSpacing = `${k / 1000}em`
    } else {
      span.style.removeProperty('letter-spacing')
    }
    if (i === 0) {
      if (indent !== 0) {
        span.style.marginLeft = `${indent / 1000}em`
      } else {
        span.style.removeProperty('margin-left')
      }
    }
  })
}

/**
 * 要素内の子ノードから、1文字spanで構成された並びを取得する。
 * BR要素と空白テキストノードは許容する。
 */
export function getSingleCharSpans(el: Element): HTMLElement[] | null {
  const nodes = Array.from(el.childNodes)
  if (nodes.length < 2) return null
  const spans: HTMLElement[] = []

  for (const node of nodes) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const child = node as HTMLElement
      if (child.tagName === 'BR') continue
      if (child.tagName === 'SPAN' && (child.textContent?.length ?? 0) === 1) {
        spans.push(child)
        continue
      }
      return null
    }
    if (node.nodeType === Node.TEXT_NODE && (node.textContent?.trim() ?? '') !== '') {
      return null
    }
  }
  return spans.length >= 2 ? spans : null
}

/**
 * 既存の1文字spanラップからカーニング値を抽出する。
 */
export function extractKerningFromWrapped(el: Element): { text: string; kerning: number[]; indent: number } | null {
  const spans = getSingleCharSpans(el)
  if (!spans) return null

  const text = spans.map(s => s.textContent).join('')
  const kerning = spans.map((span) => {
    const ls = span.style.letterSpacing
    if (!ls) return 0
    return Math.round(parseFloat(ls) * 1000)
  })
  const firstMargin = spans[0]?.style.marginLeft
  const indent = firstMargin ? Math.round(parseFloat(firstMargin) * 1000) : 0

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

  while (el.firstChild) el.removeChild(el.firstChild)

  const spans: HTMLElement[] = []
  const brPositions: number[] = []
  let spanIndex = 0

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
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

  applyKerningToSpans(spans, kerning, indent)
  return { spans, brPositions }
}

/**
 * カーニングJSONをDOMに適用する。
 *
 * 対象要素のテキストを1文字ずつspanで分割し、
 * 各spanにletter-spacingを設定する。
 * 既に1文字spanで分割済みの要素はそのまま値を適用する。
 *
 * @param data - カーニングJSON
 * @param options.warnMissing - セレクタ不一致時にconsole.warnを出す（default: true）
 */
export function applyKerning(
  data: KerningExport,
  options: { warnMissing?: boolean } = {},
) {
  const { warnMissing = true } = options

  for (const area of data.areas) {
    const el = document.querySelector(area.selector) as HTMLElement | null
    if (!el) {
      if (warnMissing) console.warn(`[kerning] Element not found: ${area.selector}`)
      continue
    }

    // 既に1文字spanで分割済みか判定
    const wrappedSpans = getSingleCharSpans(el)

    if (wrappedSpans) {
      applyKerningToSpans(wrappedSpans, area.kerning, area.indent ?? 0)
    } else {
      const text = el.textContent || ''
      if (text !== area.text && warnMissing) {
        console.warn(`[kerning] Text mismatch for ${area.selector}: expected "${area.text}", got "${text}"`)
      }
      wrapTextWithKerning(el, text, area.kerning, { indent: area.indent ?? 0 })
    }
  }
}
