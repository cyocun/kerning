/**
 * Kerning Editor — ブラウザ上でペアカーニングを直接調整するツール。
 */
import {
  ACTIVE_CLASS,
  CHAR_CLASS,
  MODIFIED_CLASS,
  applyKerningToSpans,
  collectKerningText,
  extractKerningFromWrapped,
  getSingleCharSpans,
  KERNING_FORMAT_VERSION,
  normalizeKerning,
  normalizeKerningForText,
  wrapElementWithKerning,
  type KerningArea,
  type KerningExport,
} from './applyKerning'
import {
  LOG_PREFIX,
  TOOL_NAME,
  loadPersistedData,
  removePersistedData,
  savePersistedData,
} from './kerningEditorStorage'
import {
  findGapIndex,
  getGapRect,
  moveCursorVertically,
  type CursorRect,
} from './kerningEditorMath'
import { createTypedEventEmitter, type TypedEventEmitter } from './typedEventEmitter'
import type { PersistedKerningArea } from './validation'

export { LOG_PREFIX, STORAGE_KEY, TOOL_NAME, seedPersistedKerningData } from './kerningEditorStorage'

export interface ValueBox<T> {
  value: T
}

function valueBox<T>(initial: T): ValueBox<T> {
  return { value: initial }
}

function watchedValueBox<T>(initial: T, onChange: () => void): ValueBox<T> {
  let _v = initial
  return {
    get value() { return _v },
    set value(v: T) { _v = v; onChange() },
  }
}

export interface KerningChangeDetail {
  selector: string
  kerning: number[]
  indent: number
}

export interface KerningSelectDetail {
  selector: string | null
  gapIndex: number
  gapIndexEnd: number | null
}

export interface VisualKerningEventMap {
  enable: undefined
  disable: undefined
  change: KerningChangeDetail
  select: KerningSelectDetail
  reset: undefined
}

export interface VisualKerningEmitter extends TypedEventEmitter<VisualKerningEventMap> {}

export { ACTIVE_CLASS, CHAR_CLASS, MODIFIED_CLASS } from './applyKerning'
export const OVERLAY_CLASS = 'visual-kerning-overlay'

export interface VisualKerningArea {
  selector: string
  el: HTMLElement
  text: string
  originalHTML: string
  kerning: number[]
  indent: number
  font: KerningArea['font']
  brPositions: number[]
}

export interface SelectionRange {
  rects: CursorRect[]
}

export interface GapMarker {
  x: number
  y: number
  h: number
  value: number
}

export interface VisualKerningPlugin extends VisualKerningEmitter {
  name: string
  enabled: ValueBox<boolean>
  compareMode: ValueBox<boolean>
  showGapMarkers: ValueBox<boolean>
  mount(): void
  unmount(): void
  areas: ValueBox<Map<string, VisualKerningArea>>
  activeSelector: ValueBox<string | null>
  cursorGap: ValueBox<number>
  cursorGapEnd: ValueBox<number | null>
  cursorRect: ValueBox<CursorRect | null>
  selectionRange: ValueBox<SelectionRange | null>
  cursorValue: ValueBox<number>
  gapMarkers: ValueBox<GapMarker[]>
  modifiedCount: ValueBox<number>
  exportJSON(): KerningExport
  toggleCompareMode(): void
  resetAll(): void
}

function isAreaModified(area: Pick<VisualKerningArea, 'indent' | 'kerning'>): boolean {
  return area.indent !== 0 || area.kerning.some(k => k !== 0)
}

function toPersistedData(areas: Map<string, VisualKerningArea>): Record<string, PersistedKerningArea> {
  const data: Record<string, PersistedKerningArea> = {}
  areas.forEach((area, selector) => {
    if (isAreaModified(area)) {
      data[selector] = {
        text: area.text,
        kerning: [...area.kerning],
        indent: area.indent,
        font: area.font,
      }
    }
  })
  return data
}

function getFontInfo(el: Element): KerningArea['font'] {
  const cs = getComputedStyle(el)
  return {
    family: cs.fontFamily,
    weight: cs.fontWeight,
    size: cs.fontSize,
  }
}

function getCharSpans(el: Element): HTMLElement[] {
  return Array.from(el.querySelectorAll(`.${CHAR_CLASS}`)) as HTMLElement[]
}

function wrapText(el: HTMLElement, kerning: number[], indent = 0): { brPositions: number[] } {
  const { brPositions } = wrapElementWithKerning(el, kerning, {
    indent,
    spanClassName: CHAR_CLASS,
  })
  return { brPositions }
}

function collectBreakPositions(el: Element): number[] {
  const brPositions: number[] = []
  let spanIndex = 0

  function walk(node: Node) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType !== Node.ELEMENT_NODE) continue

      const childEl = child as HTMLElement
      if (childEl.tagName === 'BR') {
        brPositions.push(spanIndex)
        continue
      }

      if (childEl.tagName === 'SPAN' && childEl.classList.contains(CHAR_CLASS)) {
        spanIndex++
      }

      walk(childEl)
    }
  }

  walk(el)
  return brPositions
}

function restoreOriginalText(el: HTMLElement, originalHTML: string) {
  el.innerHTML = originalHTML
}

const INLINE_TAGS = new Set([
  'A', 'SPAN', 'EM', 'STRONG', 'B', 'I', 'SMALL',
  'MARK', 'ABBR', 'CODE', 'TIME', 'SUB', 'SUP',
])
const IGNORE_SELECTOR = '[data-visual-kerning-ignore], [data-typespacing-ignore]'

function isInlineContent(el: Element): boolean {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as Element).tagName
      if (tag === 'BR') continue
      if (INLINE_TAGS.has(tag) && isInlineContent(node as Element)) continue
      return false
    }
  }
  return true
}

function isTextLeaf(el: Element): boolean {
  const text = el.textContent || ''
  if (text.trim().length < 2) return false
  return isInlineContent(el)
}

function isOurWrapped(el: Element): boolean {
  const wrapped = getSingleCharSpans(el)
  if (!wrapped) return false
  return wrapped.every(span => span.classList.contains(CHAR_CLASS))
}

function generateSelector(el: Element): string {
  const parts: string[] = []
  let current: Element | null = el

  while (current && current !== document.documentElement) {
    if (current === document.body) {
      parts.unshift('body')
      break
    }
    if (current.id) {
      parts.unshift(`#${CSS.escape(current.id)}`)
      break
    }

    let part = current.tagName.toLowerCase()
    const classes = Array.from(current.classList).filter(c => !c.startsWith('visual-kerning-'))
    if (classes.length) {
      part += classes.map(c => `.${CSS.escape(c)}`).join('')
    }

    if (current.parentElement) {
      const sameTag = Array.from(current.parentElement.children).filter(s => s.tagName === current!.tagName)
      if (sameTag.length > 1) {
        const idx = Array.from(current.parentElement.children).indexOf(current) + 1
        part += `:nth-child(${idx})`
      }
    }

    parts.unshift(part)
    current = current.parentElement
  }

  const full = parts.join(' > ')
  for (let i = parts.length - 1; i >= 0; i--) {
    const short = parts.slice(i).join(' > ')
    try {
      if (document.querySelectorAll(short).length === 1) return short
    } catch {
      // ignore invalid selector candidates
    }
  }
  return full
}

export function createVisualKerningPlugin(): VisualKerningPlugin {
  const emitter = createTypedEventEmitter<VisualKerningEventMap>()
  let loadTimerId = 0
  const enabled = valueBox(false)
  const compareMode = valueBox(false)
  const showGapMarkers = watchedValueBox(false, () => updateGapMarkers())
  const areas = valueBox(new Map<string, VisualKerningArea>())
  const activeSelector = valueBox<string | null>(null)
  const cursorGap = valueBox(-2)
  const cursorGapEnd = valueBox<number | null>(null)
  const cursorRect = valueBox<CursorRect | null>(null)
  const selectionRange = valueBox<SelectionRange | null>(null)
  const cursorValue = valueBox(0)
  const gapMarkers = valueBox<GapMarker[]>([])
  const modifiedCount: ValueBox<number> = {
    get value() {
      return Array.from(areas.value.values()).filter(area => isAreaModified(area)).length
    },
    set value(_) { /* read-only */ },
  }

  function hasSelection(): boolean {
    return cursorGapEnd.value !== null && cursorGapEnd.value !== cursorGap.value
  }

  function getSelectionBounds(): [number, number] | null {
    if (cursorGapEnd.value === null) return null
    const a = cursorGap.value, b = cursorGapEnd.value
    return a <= b ? [a, b] : [b, a]
  }

  function collapseSelection(side: 'start' | 'end') {
    if (!hasSelection()) return
    const bounds = getSelectionBounds()
    if (!bounds) return
    cursorGap.value = side === 'start' ? bounds[0] : bounds[1]
    cursorGapEnd.value = null
  }

  function deactivate() {
    if (activeSelector.value) {
      const area = areas.value.get(activeSelector.value)
      if (area) area.el.classList.remove(ACTIVE_CLASS)
    }
    activeSelector.value = null
    cursorGap.value = -2
    cursorGapEnd.value = null
    cursorRect.value = null
    selectionRange.value = null
    cursorValue.value = 0
    updateGapMarkers()
  }

  function updateCursor() {
    const selector = activeSelector.value
    const gap = cursorGap.value
    if (!selector || gap < -1) {
      cursorRect.value = null
      selectionRange.value = null
      cursorValue.value = 0
      return
    }

    const area = areas.value.get(selector)
    if (!area) return
    const spans = getCharSpans(area.el)

    if (hasSelection()) {
      const bounds = getSelectionBounds()!
      const rects: CursorRect[] = []
      for (let i = bounds[0]; i <= bounds[1]; i++) {
        const r = getGapRect(spans, i)
        if (r) rects.push(r)
      }
      selectionRange.value = rects.length > 0 ? { rects } : null
      cursorRect.value = null
      // 範囲選択時の表示値: 各ギャップ値の平均
      let sum = 0
      let count = 0
      for (let i = bounds[0]; i <= bounds[1]; i++) {
        sum += i === -1 ? area.indent : (area.kerning[i] ?? 0)
        count++
      }
      cursorValue.value = count > 0 ? Math.round(sum / count) : 0
    } else {
      selectionRange.value = null
      cursorRect.value = getGapRect(spans, gap)
      cursorValue.value = gap === -1 ? area.indent : (area.kerning[gap] ?? 0)
    }
    updateGapMarkers()
  }

  function updateGapMarkers() {
    if (!showGapMarkers.value) {
      gapMarkers.value = []
      return
    }
    const markers: GapMarker[] = []
    areas.value.forEach((area) => {
      if (!isAreaModified(area)) return
      const spans = getCharSpans(area.el)
      if (area.indent !== 0) {
        const r = getGapRect(spans, -1)
        if (r) markers.push({ ...r, value: area.indent })
      }
      area.kerning.forEach((k, i) => {
        if (k === 0) return
        const r = getGapRect(spans, i)
        if (r) markers.push({ ...r, value: k })
      })
    })
    gapMarkers.value = markers
  }

  function applyAreaPreview(area: VisualKerningArea) {
    const spans = getCharSpans(area.el)
    if (compareMode.value) {
      applyKerningToSpans(spans, new Array(area.kerning.length).fill(0), 0)
      return
    }
    applyKerningToSpans(spans, area.kerning, area.indent)
  }

  function applyPreviewToAllAreas() {
    areas.value.forEach((area) => applyAreaPreview(area))
  }

  function setCompareMode(next: boolean) {
    if (compareMode.value === next) return
    compareMode.value = next
    applyPreviewToAllAreas()
    updateCursor()
  }

  function toggleCompareMode() {
    setCompareMode(!compareMode.value)
  }

  function ensureEditableArea(textEl: HTMLElement, selector: string) {
    if (textEl.tagName === 'SPAN') {
      console.warn(
        `${LOG_PREFIX} Target element is a <span>: "${selector}". `
        + 'Wrapping may produce nested spans. Consider using a block-level element (e.g. <p>, <div>, <h1>) as the kerning target.',
      )
    }

    if (getSingleCharSpans(textEl) && !isOurWrapped(textEl)) {
      const imported = extractKerningFromWrapped(textEl)
      if (!imported) return
      const font = getFontInfo(textEl)
      const originalHTML = textEl.innerHTML
      const kerning = normalizeKerningForText(imported.kerning, imported.text)
      const { brPositions } = wrapText(textEl, kerning, imported.indent)
      textEl.classList.add(MODIFIED_CLASS)
      areas.value.set(selector, {
        selector,
        el: textEl,
        text: imported.text,
        originalHTML,
        kerning,
        indent: imported.indent,
        font,
        brPositions,
      })
    }

    if (!isOurWrapped(textEl)) {
      const text = collectKerningText(textEl)
      const originalHTML = textEl.innerHTML
      const kerning = normalizeKerningForText([], text)
      const font = getFontInfo(textEl)
      const { brPositions } = wrapText(textEl, kerning)
      areas.value.set(selector, {
        selector,
        el: textEl,
        text,
        originalHTML,
        kerning,
        indent: 0,
        font,
        brPositions,
      })
    }
  }

  function findTextElement(target: Element): HTMLElement | null {
    const isIgnored = (el: Element) => !!el.closest(IGNORE_SELECTOR)

    const charSpan = target.closest(`.${CHAR_CLASS}`)
    if (charSpan) {
      // visual-kerning-char からインラインラッパーを越えて実際のテキストコンテナまで遡る
      let container = charSpan.parentElement
      while (container && INLINE_TAGS.has(container.tagName)) {
        container = container.parentElement
      }
      if (container) return container as HTMLElement
    }

    if (isTextLeaf(target) && !isIgnored(target)) {
      return target as HTMLElement
    }

    let current: Element | null = target
    while (current && current !== document.body) {
      if (!isIgnored(current) && (isTextLeaf(current) || isOurWrapped(current))) {
        return current as HTMLElement
      }
      current = current.parentElement
    }
    return null
  }

  function onClick(e: MouseEvent) {
    if (!enabled.value) return

    const rawTarget = e.target as Node
    const target = rawTarget.nodeType === Node.TEXT_NODE ? rawTarget.parentElement : rawTarget as Element
    if (!target) return
    if (target.closest(`.${OVERLAY_CLASS}`) || target.closest('svg')) return
    if (target.closest(IGNORE_SELECTOR)) return

    e.preventDefault()
    e.stopPropagation()

    const textEl = findTextElement(target)
    if (!textEl) {
      deactivate()
      return
    }

    const selector = generateSelector(textEl)
    ensureEditableArea(textEl, selector)
    const currentArea = areas.value.get(selector)
    if (currentArea) applyAreaPreview(currentArea)

    if (activeSelector.value && activeSelector.value !== selector) {
      const prev = areas.value.get(activeSelector.value)
      if (prev) prev.el.classList.remove(ACTIVE_CLASS)
    }

    textEl.classList.add(ACTIVE_CLASS)
    const clickedGap = findGapIndex(getCharSpans(textEl), e.clientX, e.clientY)

    if (e.shiftKey && activeSelector.value === selector && cursorGap.value >= -1) {
      // Shift+クリック: 現在位置から範囲拡張
      cursorGapEnd.value = clickedGap
    } else {
      activeSelector.value = selector
      cursorGap.value = clickedGap
      cursorGapEnd.value = null
    }
    updateCursor()
    emitter.emit('select', {
      selector: activeSelector.value,
      gapIndex: cursorGap.value,
      gapIndexEnd: cursorGapEnd.value,
    })
  }

  function onKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      enabled.value = !enabled.value
      if (enabled.value) {
        emitter.emit('enable', undefined)
      } else {
        setCompareMode(false)
        deactivate()
        emitter.emit('disable', undefined)
      }
      return
    }

    if (!enabled.value) return
    if (e.key === 'Escape') {
      deactivate()
      return
    }

    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const selector = activeSelector.value
      if (!selector || cursorGap.value < -1) return

      e.preventDefault()
      e.stopPropagation()

      const area = areas.value.get(selector)
      if (!area) return

      const step = (e.metaKey || e.ctrlKey) ? 100 : e.shiftKey ? 1 : 10
      const delta = e.key === 'ArrowRight' ? step : -step
      const spans = getCharSpans(area.el)

      const bounds = getSelectionBounds()
      if (bounds) {
        // 範囲選択: 内側ギャップのみ同量調整（トラッキング）
        // bounds[0] は選択外との左端エッジなのでスキップ
        for (let i = bounds[0] + 1; i <= bounds[1]; i++) {
          if (i === -1) {
            area.indent += delta
          } else {
            area.kerning[i] = (area.kerning[i] ?? 0) + delta
          }
        }
      } else {
        // 単一ギャップ: カーニング
        const idx = cursorGap.value
        if (idx === -1) {
          area.indent += delta
        } else {
          area.kerning[idx] = (area.kerning[idx] ?? 0) + delta
        }
      }

      applyKerningToSpans(spans, area.kerning, area.indent)
      if (compareMode.value) {
        applyKerningToSpans(spans, new Array(area.kerning.length).fill(0), 0)
      }
      area.el.classList.add(MODIFIED_CLASS)
      updateCursor()
      savePersistedData(toPersistedData(areas.value))
      emitter.emit('change', { selector, kerning: [...area.kerning], indent: area.indent })
      return
    }

    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Tab')
      && activeSelector.value && cursorGap.value >= -1) {
      e.preventDefault()
      const area = areas.value.get(activeSelector.value)
      if (!area) return
      const minGap = -1
      const maxGap = area.kerning.length - 1
      const back = e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)

      if (e.shiftKey && e.key !== 'Tab') {
        // Shift+矢印: 範囲拡張
        const end = cursorGapEnd.value ?? cursorGap.value
        const next = back
          ? (end > minGap ? end - 1 : end)
          : (end < maxGap ? end + 1 : end)
        cursorGapEnd.value = next
      } else if (hasSelection() && !e.shiftKey) {
        // 範囲選択中に矢印（Shiftなし）: 範囲を解除してその端にカーソルを置く
        collapseSelection(back ? 'start' : 'end')
      } else {
        cursorGap.value = back
          ? (cursorGap.value > minGap ? cursorGap.value - 1 : maxGap)
          : (cursorGap.value < maxGap ? cursorGap.value + 1 : minGap)
      }
      updateCursor()
      return
    }

    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown')
      && activeSelector.value && cursorGap.value >= -1 && !e.altKey) {
      e.preventDefault()
      const area = areas.value.get(activeSelector.value)
      if (!area) return
      const spans = getCharSpans(area.el)
      cursorGap.value = moveCursorVertically(spans, cursorGap.value, e.key === 'ArrowUp' ? 'up' : 'down')
      updateCursor()
      return
    }

    if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'b') {
      e.preventDefault()
      toggleCompareMode()
    }
  }

  function onScrollOrResize() {
    if (cursorRect.value || selectionRange.value) updateCursor()
    else updateGapMarkers()
  }

  function exportJSON(): KerningExport {
    const exportAreas: KerningArea[] = []
    areas.value.forEach((area) => {
      if (!isAreaModified(area)) return
      exportAreas.push({
        selector: area.selector,
        text: area.text,
        font: area.font,
        indent: area.indent,
        kerning: [...area.kerning],
      })
    })

    return {
      version: KERNING_FORMAT_VERSION,
      exported: new Date().toISOString(),
      page: location.pathname,
      areas: exportAreas,
    }
  }

  function resetAll() {
    areas.value.forEach((area) => {
      area.el.classList.remove(ACTIVE_CLASS, MODIFIED_CLASS)
      restoreOriginalText(area.el, area.originalHTML)
    })
    areas.value.clear()
    setCompareMode(false)
    deactivate()
    removePersistedData()
    emitter.emit('reset', undefined)
  }

  function load() {
    const data = loadPersistedData()
    for (const [selector, info] of Object.entries(data)) {
      const el = document.querySelector(selector) as HTMLElement | null
      if (!el) continue

      const indent = info.indent ?? 0
      const existingSpans = getSingleCharSpans(el)
      const isOurs = existingSpans?.every(s => s.classList.contains(CHAR_CLASS))

      if (existingSpans && isOurs) {
        const originalHTML = el.innerHTML
        const kerning = normalizeKerning(info.kerning, existingSpans.length)
        applyKerningToSpans(existingSpans, kerning, indent)
        el.classList.add(MODIFIED_CLASS)
        const brPositions = collectBreakPositions(el)

        areas.value.set(selector, {
          selector,
          el,
          text: info.text,
          originalHTML,
          kerning,
          indent,
          font: info.font,
          brPositions,
        })
      } else {
        const text = collectKerningText(el)
        if (text !== info.text) continue

        const originalHTML = el.innerHTML
        const kerning = normalizeKerningForText(info.kerning, text)
        const { brPositions } = wrapText(el, kerning, indent)
        el.classList.add(MODIFIED_CLASS)

        areas.value.set(selector, {
          selector,
          el,
          text,
          originalHTML,
          kerning,
          indent,
          font: info.font,
          brPositions,
        })
      }
    }
  }

  return {
    name: TOOL_NAME,
    on: emitter.on,
    enabled,
    compareMode,
    areas,
    activeSelector,
    cursorGap,
    cursorGapEnd,
    cursorRect,
    selectionRange,
    cursorValue,
    showGapMarkers,
    gapMarkers,
    modifiedCount,
    exportJSON,
    toggleCompareMode,
    resetAll,
    mount() {
      loadTimerId = window.setTimeout(load, 0)
      window.addEventListener('click', onClick, true)
      window.addEventListener('keydown', onKeydown, true)
      window.addEventListener('scroll', onScrollOrResize, true)
      window.addEventListener('resize', onScrollOrResize)
    },
    unmount() {
      window.clearTimeout(loadTimerId)
      deactivate()
      window.removeEventListener('click', onClick, true)
      window.removeEventListener('keydown', onKeydown, true)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
      const wasEnabled = enabled.value
      enabled.value = false
      setCompareMode(false)
      if (wasEnabled) emitter.emit('disable', undefined)
    },
  }
}
