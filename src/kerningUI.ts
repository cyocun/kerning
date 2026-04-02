import { applyKerning, type KerningExport } from './applyKerning'
import { editorMessages, type EditorLocale } from './editorMessages'
import {
  ACTIVE_CLASS,
  CHAR_CLASS,
  createVisualKerningPlugin,
  MODIFIED_CLASS,
  OVERLAY_CLASS,
  seedPersistedKerningData,
  type VisualKerningPlugin,
} from './kerningEditor'
import { createKerningUIPanelController } from './kerningUIPanelController'
import { createKerningUIRoot } from './kerningUIRoot'

interface MergedRect { x: number; y: number; w: number; h: number }

const EDITOR_CLASS_PREFIX = 'visual-kerning'

function editorClass(name: string) {
  return `${EDITOR_CLASS_PREFIX}-${name}`
}

function mergeSelectionRects(rects: { x: number; y: number; h: number }[]): MergedRect[] {
  if (rects.length === 0) return []
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x)
  const rows: MergedRect[] = []
  let cur = { x: sorted[0]!.x, y: sorted[0]!.y, w: 0, h: sorted[0]!.h }

  for (const r of sorted) {
    if (Math.abs(r.y - cur.y) > cur.h * 0.5) {
      // 別の行
      if (cur.w > 0) rows.push(cur)
      cur = { x: r.x, y: r.y, w: 0, h: r.h }
    }
    const right = Math.max(cur.x + cur.w, r.x)
    cur.x = Math.min(cur.x, r.x)
    cur.w = right - cur.x
    cur.h = Math.max(cur.h, r.h)
  }
  if (cur.w > 0) rows.push(cur)
  return rows
}

export interface VisualKerningOptions {
  /** UI language for the editor palette (default: `'en'`). */
  locale?: EditorLocale
  /**
   * Show the editing UI with keyboard shortcuts (default: `true`).
   *
   * - `true` — editing mode (development / staging).
   * - `false` — production mode, applies kerning data only.
   */
  editable?: boolean
  /**
   * Kerning data to apply on mount.
   *
   * In editing mode (`editable: true`), the data seeds the editor state
   * so you can continue editing from a previous export.
   * In production mode (`editable: false`), the data is applied to the DOM directly.
   */
  kerning?: KerningExport
  /**
   * Add screen reader support (default: `false`).
   *
   * When enabled, each target element is restructured into:
   * ```html
   * <h1>
   *   <span class="visual-kerning-sr-only">original text</span>
   *   <span class="visual-kerning-visual" aria-hidden="true">
   *     ...kerned spans...
   *   </span>
   * </h1>
   * ```
   * Screen readers read the visually-hidden original text;
   * the per-character spans are hidden via `aria-hidden`.
   *
   * **Note:** This changes the DOM structure. CSS or JS that references
   * child elements of kerning targets directly may need selector adjustments.
   *
   * Only applies in production mode (`editable: false`).
   * Ignored when editing.
   */
  accessible?: boolean
}

export interface VisualKerning extends VisualKerningPlugin {
  plugin: VisualKerningPlugin
}

export function visualKerning(options: VisualKerningOptions = {}): VisualKerning {
  const plugin = createVisualKerningPlugin()
  const locale = options.locale ?? 'en'
  const editable = options.editable ?? true
  const t = editorMessages[locale]
  const rootClass = editorClass('root')
  const cursorClass = editorClass('cursor')
  const valueClass = editorClass('value')
  const selectionClass = editorClass('selection')
  const selectionHighlightClass = editorClass('selection-highlight')
  const areaGuidesClass = editorClass('area-guides')
  const areaGuideClass = editorClass('area-guide')
  const markersClass = editorClass('markers')
  const gapMarkerClass = editorClass('gap-marker')
  const overlayClass = OVERLAY_CLASS
  const panelClass = editorClass('panel')
  const headerClass = editorClass('header')
  const headingClass = editorClass('heading')
  const bodyClass = editorClass('body')
  const rowClass = editorClass('row')
  const actionsClass = editorClass('actions')
  const buttonClass = editorClass('btn')
  const iconButtonClass = editorClass('icon-btn')
  const helpClass = editorClass('help')
  const toastClass = editorClass('toast')

  let mounted = false
  let pendingDomReady: (() => void) | null = null
  let rafId = 0
  let copiedTimer = 0
  let lastAreaGuidesKey = ''
  let lastMarkersKey = ''
  let lastSelectionKey = ''

  const warnClass = editorClass('warn')
  const {
    root,
    cursorEl,
    valueEl,
    selectionContainer,
    areaGuidesContainer,
    markersContainer,
    panelEl,
    panelBodyEl,
    dragHandleEl,
    collapseBtn,
    compareBtn,
    gapsBtn,
    exportBtn,
    resetBtn,
    toastEl,
    warnEl,
  } = createKerningUIRoot({
    overlayClass,
    rootClass,
    cursorClass,
    valueClass,
    selectionClass,
    selectionHighlightClass,
    areaGuidesClass,
    areaGuideClass,
    markersClass,
    gapMarkerClass,
    panelClass,
    headerClass,
    headingClass,
    bodyClass,
    rowClass,
    actionsClass,
    buttonClass,
    iconButtonClass,
    helpClass,
    toastClass,
    warnClass,
    charClass: CHAR_CLASS,
    activeClass: ACTIVE_CLASS,
    pluginName: plugin.name,
    collapseLabel: t.collapse,
    compareLabel: t.compare,
    guidesLabel: t.guides,
    exportLabel: t.export,
    resetLabel: t.reset,
    helpText: t.helpText,
    copiedLabel: t.copied,
  })
  const panelController = createKerningUIPanelController({
    panelEl,
    panelBodyEl,
    collapseBtn,
    getCollapseLabel: () => t.collapse,
    getExpandLabel: () => t.expand,
  })
  let warnTimer = 0
  let warnDispose: (() => void) | null = null

  function serializeMarkers() {
    return plugin.gapMarkers.value.map(marker => `${marker.x},${marker.y},${marker.h},${marker.value}`).join('|')
  }

  function serializeAreaGuides() {
    if (!plugin.showGapMarkers.value) return ''
    const guides: string[] = []
    plugin.areas.value.forEach((area) => {
      if (!area.el.classList.contains(MODIFIED_CLASS)) return
      const rect = area.el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      guides.push(`${rect.left},${rect.top},${rect.width},${rect.height}`)
    })
    return guides.join('|')
  }

  function serializeSelection() {
    const selection = plugin.selectionRange.value
    if (!selection) return ''
    const rows = mergeSelectionRects(selection.rects)
    return rows.map(row => `${row.x},${row.y},${row.w},${row.h}`).join('|')
  }

  function syncGapMarkers() {
    const nextKey = serializeMarkers()
    if (nextKey === lastMarkersKey) return
    lastMarkersKey = nextKey
    markersContainer.replaceChildren()
    for (const marker of plugin.gapMarkers.value) {
      const el = document.createElement('div')
      el.className = `${gapMarkerClass} ${marker.value > 0 ? 'is-positive' : 'is-negative'}`
      el.style.left = `${marker.x}px`
      el.style.top = `${marker.y}px`
      el.style.height = `${marker.h}px`
      markersContainer.appendChild(el)
    }
  }

  function syncAreaGuides() {
    const nextKey = serializeAreaGuides()
    if (nextKey === lastAreaGuidesKey) return
    lastAreaGuidesKey = nextKey
    areaGuidesContainer.replaceChildren()
    if (!nextKey) return
    for (const part of nextKey.split('|')) {
      const [left, top, width, height] = part.split(',').map(Number)
      const el = document.createElement('div')
      el.className = areaGuideClass
      el.style.left = `${left - 6}px`
      el.style.top = `${top - 4}px`
      el.style.width = `${width + 12}px`
      el.style.height = `${height + 8}px`
      areaGuidesContainer.appendChild(el)
    }
  }

  function syncSelectionHighlights() {
    const selection = plugin.selectionRange.value
    const nextKey = serializeSelection()
    if (nextKey === lastSelectionKey) return
    lastSelectionKey = nextKey
    selectionContainer.replaceChildren()
    if (!selection) return
    for (const row of mergeSelectionRects(selection.rects)) {
      const el = document.createElement('div')
      el.className = selectionHighlightClass
      el.style.left = `${row.x}px`
      el.style.top = `${row.y}px`
      el.style.width = `${row.w}px`
      el.style.height = `${row.h}px`
      selectionContainer.appendChild(el)
    }
  }

  function showWarn(message: string) {
    warnEl.textContent = message
    warnEl.style.display = 'block'
    clearTimeout(warnTimer)
    warnTimer = window.setTimeout(() => {
      warnEl.style.display = 'none'
    }, 5000)
  }

  function downloadJSON() {
    const data = plugin.exportJSON()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'kerning-export.json'
    a.click()
    URL.revokeObjectURL(a.href)
    toastEl.style.display = 'block'
    clearTimeout(copiedTimer)
    copiedTimer = window.setTimeout(() => {
      toastEl.style.display = 'none'
    }, 1500)
  }

  function render() {
    const enabled = plugin.enabled.value
    root.style.display = enabled ? 'block' : 'none'
    if (!enabled) return

    const count = plugin.modifiedCount.value
    compareBtn.style.borderColor = plugin.compareMode.value ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.25)'
    compareBtn.style.color = plugin.compareMode.value ? '#fff' : 'rgba(255,255,255,.75)'
    gapsBtn.style.borderColor = plugin.showGapMarkers.value ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.25)'
    gapsBtn.style.color = plugin.showGapMarkers.value ? '#fff' : 'rgba(255,255,255,.75)'
    exportBtn.disabled = count === 0
    resetBtn.disabled = count === 0

    // ギャップマーカー
    syncAreaGuides()
    syncGapMarkers()

    // 選択範囲ハイライト
    const sel = plugin.selectionRange.value
    syncSelectionHighlights()

    const cursor = plugin.cursorRect.value
    if (!cursor && !sel) {
      cursorEl.style.display = 'none'
      valueEl.style.display = 'none'
      return
    }

    if (cursor) {
      cursorEl.style.display = 'block'
      cursorEl.style.left = `${cursor.x}px`
      cursorEl.style.top = `${cursor.y}px`
      cursorEl.style.height = `${cursor.h}px`
    } else {
      cursorEl.style.display = 'none'
    }

    if (cursor || sel) {
      valueEl.style.display = 'block'
      const anchor = cursor ?? (sel ? sel.rects[0] : null)
      if (anchor) {
        valueEl.style.left = `${anchor.x}px`
        valueEl.style.top = `${anchor.y}px`
      }
      const v = plugin.cursorValue.value
      valueEl.textContent = v > 0 ? `+${v}` : String(v)
    } else {
      valueEl.style.display = 'none'
    }
  }

  function loop() {
    render()
    rafId = window.requestAnimationFrame(loop)
  }

  function onResetClick() {
    if (window.confirm(t.confirmReset)) plugin.resetAll()
  }

  function onCompareClick() {
    plugin.toggleCompareMode()
  }

  function onGapsClick() {
    plugin.showGapMarkers.value = !plugin.showGapMarkers.value
  }

  function onCollapseClick() {
    panelController.toggleCollapsed()
  }

  function onDragStart(e: PointerEvent) {
    panelController.startDrag(e)
  }

  function onResize() {
    if (mounted) panelController.onResize()
  }

  const editor: VisualKerning = {
    ...plugin,
    plugin,
    mount() {
      if (document.readyState === 'loading') {
        if (!pendingDomReady) {
          pendingDomReady = () => editor.mount()
          document.addEventListener('DOMContentLoaded', pendingDomReady, { once: true })
        }
        return
      }
      pendingDomReady = null
      if (!editable) {
        if (options.kerning) applyKerning(options.kerning, { accessible: options.accessible })
        return
      }
      if (mounted) return
      mounted = true
      if (options.kerning) seedPersistedKerningData(options.kerning)
      lastAreaGuidesKey = ''
      lastMarkersKey = ''
      lastSelectionKey = ''
      document.body.appendChild(root)
      panelController.setCollapsed(false)
      panelController.positionDefault()
      dragHandleEl.addEventListener('pointerdown', onDragStart)
      collapseBtn.addEventListener('click', onCollapseClick)
      compareBtn.addEventListener('click', onCompareClick)
      gapsBtn.addEventListener('click', onGapsClick)
      exportBtn.addEventListener('click', downloadJSON)
      resetBtn.addEventListener('click', onResetClick)
      window.addEventListener('resize', onResize)
      warnDispose = plugin.on('select', ({ selector }) => {
        if (!selector) return
        const el = document.querySelector(selector)
        if (el?.tagName === 'SPAN') showWarn(t.warnSpanTarget)
      })
      plugin.mount()
      rafId = window.requestAnimationFrame(loop)
    },
    unmount() {
      if (pendingDomReady) {
        document.removeEventListener('DOMContentLoaded', pendingDomReady)
        pendingDomReady = null
      }
      if (!editable) {
        return
      }
      if (!mounted) return
      mounted = false
      window.cancelAnimationFrame(rafId)
      clearTimeout(copiedTimer)
      clearTimeout(warnTimer)
      if (warnDispose) { warnDispose(); warnDispose = null }
      plugin.unmount()
      dragHandleEl.removeEventListener('pointerdown', onDragStart)
      collapseBtn.removeEventListener('click', onCollapseClick)
      compareBtn.removeEventListener('click', onCompareClick)
      gapsBtn.removeEventListener('click', onGapsClick)
      exportBtn.removeEventListener('click', downloadJSON)
      resetBtn.removeEventListener('click', onResetClick)
      window.removeEventListener('resize', onResize)
      panelController.dispose()
      root.remove()
    },
  }

  return editor
}
