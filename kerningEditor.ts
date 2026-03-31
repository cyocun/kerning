/**
 * Kerning Editor — ブラウザ上でペアカーニングを直接調整するツール。
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import {
  applyKerningToSpans,
  extractKerningFromWrapped,
  getSingleCharSpans,
  wrapTextWithKerning,
  type KerningArea,
  type KerningExport,
} from './applyKerning'

const STORAGE_KEY = 'kern-edit-data'
const CHAR_CLASS = 'kern-edit-char'
const ACTIVE_CLASS = 'kern-edit-active'
const MODIFIED_CLASS = 'kern-edit-modified'

interface CursorRect {
  x: number
  y: number
  h: number
}

export interface KerningEditorArea {
  selector: string
  el: HTMLElement
  text: string
  kerning: number[]
  indent: number
  font: KerningArea['font']
  brPositions: number[]
}

interface KerningPersistedArea {
  text: string
  kerning: number[]
  indent?: number
  font: KerningArea['font']
}

export interface KerningEditorPlugin {
  name: string
  enabled: Ref<boolean>
  install(): void
  uninstall(): void
  areas: Ref<Map<string, KerningEditorArea>>
  activeSelector: Ref<string | null>
  cursorGap: Ref<number>
  cursorRect: Ref<CursorRect | null>
  cursorValue: Ref<number>
  modifiedCount: ComputedRef<number>
  exportJSON(): KerningExport
  resetAll(): void
}

function isAreaModified(area: Pick<KerningEditorArea, 'indent' | 'kerning'>): boolean {
  return area.indent !== 0 || area.kerning.some(k => k !== 0)
}

function toPersistedData(areas: Map<string, KerningEditorArea>): Record<string, KerningPersistedArea> {
  const data: Record<string, KerningPersistedArea> = {}
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

function loadPersistedData(): Record<string, KerningPersistedArea> {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, KerningPersistedArea>
  } catch (error) {
    console.warn('[kerning] Failed to parse localStorage data.', error)
    localStorage.removeItem(STORAGE_KEY)
    return {}
  }
}

function savePersistedData(areas: Map<string, KerningEditorArea>) {
  const data = toPersistedData(areas)
  if (Object.keys(data).length) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
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
  const text = collectText(el)
  const { brPositions } = wrapTextWithKerning(el, text, kerning, {
    indent,
    spanClassName: CHAR_CLASS,
  })
  return { brPositions }
}

function restoreOriginalText(el: HTMLElement, text: string, brPositions: number[]) {
  while (el.firstChild) el.removeChild(el.firstChild)
  if (brPositions.length === 0) {
    el.textContent = text
    return
  }

  let textIdx = 0
  for (let i = 0; i <= brPositions.length; i++) {
    const brPos = i < brPositions.length ? brPositions[i]! : text.length
    const chunk = text.slice(textIdx, brPos)
    if (chunk) el.appendChild(document.createTextNode(chunk))
    if (i < brPositions.length) el.appendChild(document.createElement('br'))
    textIdx = brPos
  }
}

function collectText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || ''
  if (node.nodeType === Node.ELEMENT_NODE) {
    if ((node as Element).tagName === 'BR') return '\n'
    return Array.from(node.childNodes).map(collectText).join('')
  }
  return ''
}

const INLINE_TAGS = new Set([
  'A', 'SPAN', 'EM', 'STRONG', 'B', 'I', 'SMALL',
  'MARK', 'ABBR', 'CODE', 'TIME', 'SUB', 'SUP',
])

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
  const children = Array.from(el.children)
  if (children.length < 2) return false
  const nonBr = children.filter(c => c.tagName !== 'BR')
  return nonBr.length >= 1 && nonBr.every(c =>
    c.tagName === 'SPAN' && c.classList.contains(CHAR_CLASS),
  )
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
    const classes = Array.from(current.classList).filter(c => !c.startsWith('kern-edit'))
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

function findGapIndex(spans: HTMLElement[], clientX: number): number {
  if (spans.length < 1) return -1
  let closest = -1
  let minDist = Infinity

  const firstRect = spans[0]!.getBoundingClientRect()
  const leftDist = Math.abs(clientX - firstRect.left)
  if (leftDist < minDist) {
    minDist = leftDist
    closest = -1
  }

  for (let i = 0; i < spans.length - 1; i++) {
    const rect = spans[i]!.getBoundingClientRect()
    const nextRect = spans[i + 1]!.getBoundingClientRect()
    const gapX = (rect.right + nextRect.left) / 2
    const dist = Math.abs(clientX - gapX)
    if (dist < minDist) {
      minDist = dist
      closest = i
    }
  }

  const lastRect = spans[spans.length - 1]!.getBoundingClientRect()
  const rightDist = Math.abs(clientX - lastRect.right)
  if (rightDist < minDist) closest = spans.length - 1

  return closest
}

function getGapRect(spans: HTMLElement[], gapIndex: number): CursorRect | null {
  if (spans.length === 0) return null
  if (gapIndex === -1) {
    const r = spans[0]!.getBoundingClientRect()
    return { x: r.left, y: r.top, h: r.height }
  }
  if (gapIndex === spans.length - 1) {
    const r = spans[spans.length - 1]!.getBoundingClientRect()
    return { x: r.right, y: r.top, h: r.height }
  }

  const left = spans[gapIndex]!.getBoundingClientRect()
  const right = spans[gapIndex + 1]!.getBoundingClientRect()
  return {
    x: (left.right + right.left) / 2,
    y: Math.min(left.top, right.top),
    h: Math.max(left.bottom, right.bottom) - Math.min(left.top, right.top),
  }
}

export function createKerningPlugin(): KerningEditorPlugin {
  const enabled = ref(false)
  const areas = ref(new Map<string, KerningEditorArea>())
  const activeSelector = ref<string | null>(null)
  const cursorGap = ref(-2)
  const cursorRect = ref<CursorRect | null>(null)
  const cursorValue = ref(0)
  const modifiedCount = computed(() =>
    Array.from(areas.value.values()).filter(area => isAreaModified(area)).length,
  )

  function deactivate() {
    if (activeSelector.value) {
      const area = areas.value.get(activeSelector.value)
      if (area) area.el.classList.remove(ACTIVE_CLASS)
    }
    activeSelector.value = null
    cursorGap.value = -2
    cursorRect.value = null
    cursorValue.value = 0
  }

  function updateCursor() {
    const selector = activeSelector.value
    const gap = cursorGap.value
    if (!selector || gap < -1) {
      cursorRect.value = null
      cursorValue.value = 0
      return
    }

    const area = areas.value.get(selector)
    if (!area) return
    const spans = getCharSpans(area.el)
    cursorRect.value = getGapRect(spans, gap)
    cursorValue.value = gap === -1 ? area.indent : (area.kerning[gap] ?? 0)
  }

  function ensureEditableArea(textEl: HTMLElement, selector: string) {
    if (getSingleCharSpans(textEl) && !isOurWrapped(textEl)) {
      const imported = extractKerningFromWrapped(textEl)
      if (!imported) return
      const font = getFontInfo(textEl)
      const { brPositions } = wrapText(textEl, imported.kerning, imported.indent)
      textEl.classList.add(MODIFIED_CLASS)
      areas.value.set(selector, {
        selector,
        el: textEl,
        text: imported.text,
        kerning: imported.kerning,
        indent: imported.indent,
        font,
        brPositions,
      })
    }

    if (!isOurWrapped(textEl)) {
      const text = textEl.textContent || ''
      const kerning = new Array(text.length).fill(0) as number[]
      const font = getFontInfo(textEl)
      const { brPositions } = wrapText(textEl, kerning)
      areas.value.set(selector, { selector, el: textEl, text, kerning, indent: 0, font, brPositions })
    }
  }

  function findTextElement(target: Element): HTMLElement | null {
    const isIgnored = (el: Element) => el.hasAttribute('data-kern-ignore')

    const charSpan = target.closest(`.${CHAR_CLASS}`)
    if (charSpan && charSpan.parentElement) return charSpan.parentElement

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
    if (target.closest('.kern-edit-overlay') || target.closest('svg')) return

    e.preventDefault()
    e.stopPropagation()

    const textEl = findTextElement(target)
    if (!textEl) {
      deactivate()
      return
    }

    const selector = generateSelector(textEl)
    ensureEditableArea(textEl, selector)

    if (activeSelector.value && activeSelector.value !== selector) {
      const prev = areas.value.get(activeSelector.value)
      if (prev) prev.el.classList.remove(ACTIVE_CLASS)
    }

    textEl.classList.add(ACTIVE_CLASS)
    activeSelector.value = selector
    cursorGap.value = findGapIndex(getCharSpans(textEl), e.clientX)
    updateCursor()
  }

  function onKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      enabled.value = !enabled.value
      if (!enabled.value) deactivate()
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

      const step = (e.metaKey || e.ctrlKey) ? 100 : 10
      const delta = e.key === 'ArrowRight' ? step : -step
      const idx = cursorGap.value
      const spans = getCharSpans(area.el)

      if (idx === -1) {
        area.indent += delta
      } else {
        area.kerning[idx] = (area.kerning[idx] ?? 0) + delta
      }

      applyKerningToSpans(spans, area.kerning, area.indent)
      area.el.classList.add(MODIFIED_CLASS)
      updateCursor()
      savePersistedData(areas.value)
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
      cursorGap.value = back
        ? (cursorGap.value > minGap ? cursorGap.value - 1 : maxGap)
        : (cursorGap.value < maxGap ? cursorGap.value + 1 : minGap)
      updateCursor()
    }
  }

  function onScrollOrResize() {
    if (cursorRect.value) updateCursor()
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
      exported: new Date().toISOString(),
      page: location.pathname,
      areas: exportAreas,
    }
  }

  function resetAll() {
    areas.value.forEach((area) => {
      area.el.classList.remove(ACTIVE_CLASS, MODIFIED_CLASS)
      restoreOriginalText(area.el, area.text, area.brPositions)
    })
    areas.value.clear()
    deactivate()
    localStorage.removeItem(STORAGE_KEY)
  }

  function load() {
    const data = loadPersistedData()
    for (const [selector, info] of Object.entries(data)) {
      const el = document.querySelector(selector) as HTMLElement | null
      if (!el || getSingleCharSpans(el)) continue
      if ((el.textContent || '') !== info.text) continue

      const indent = info.indent ?? 0
      const { brPositions } = wrapText(el, info.kerning, indent)
      el.classList.add(MODIFIED_CLASS)

      areas.value.set(selector, {
        selector,
        el,
        text: info.text,
        kerning: [...info.kerning],
        indent,
        font: info.font,
        brPositions,
      })
    }
  }

  return {
    name: 'kerning',
    enabled,
    areas,
    activeSelector,
    cursorGap,
    cursorRect,
    cursorValue,
    modifiedCount,
    exportJSON,
    resetAll,
    install() {
      setTimeout(load, 0)
      window.addEventListener('click', onClick, true)
      window.addEventListener('keydown', onKeydown, true)
      window.addEventListener('scroll', onScrollOrResize, true)
      window.addEventListener('resize', onScrollOrResize)
    },
    uninstall() {
      deactivate()
      window.removeEventListener('click', onClick, true)
      window.removeEventListener('keydown', onKeydown, true)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
      enabled.value = false
    },
  }
}
