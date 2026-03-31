import { applyKerning, type KerningExport } from './applyKerning'
import { editorMessages, type EditorLocale } from './editorMessages'
import {
  ACTIVE_CLASS,
  CHAR_CLASS,
  createKerningPlugin,
  MODIFIED_CLASS,
  OVERLAY_CLASS,
  type KerningEditorPlugin,
} from './kerningEditor'

interface MergedRect { x: number; y: number; w: number; h: number }

const EDITOR_CLASS_PREFIX = 'typespacing'

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

export interface KerningEditorOptions {
  locale?: EditorLocale
  editable?: boolean
  kerning?: KerningExport
}

export interface KerningEditor extends KerningEditorPlugin {
  plugin: KerningEditorPlugin
}

export function createKerningEditor(options: KerningEditorOptions = {}): KerningEditor {
  const plugin = createKerningPlugin()
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
  let collapsed = false
  let panelPositioned = false
  let panelX = 0
  let panelY = 0
  let dragPointerId: number | null = null
  let dragOffsetX = 0
  let dragOffsetY = 0
  let lastAreaGuidesKey = ''
  let lastMarkersKey = ''
  let lastSelectionKey = ''

  const root = document.createElement('div')
  root.className = overlayClass
  root.setAttribute('data-typespacing-ignore', 'true')
  root.innerHTML = `
    <style>
      .${rootClass} { position: fixed; inset: 0; pointer-events: none; z-index: 100000; }
      .${cursorClass} {
        position: fixed;
        width: 2px;
        background: rgba(15,15,15,.95);
        box-shadow: 0 0 0 1px rgba(255,255,255,.85);
        pointer-events: none;
        display: none;
      }
      .${valueClass} {
        position: fixed; transform: translate(-50%, -100%); margin-top: -8px;
        background: #000; color: #fff; border-radius: 4px; padding: 4px 7px;
        font: 500 12px/1 sans-serif; pointer-events: none; white-space: nowrap; display: none;
      }
      .${selectionHighlightClass} {
        position: fixed;
        background: rgba(38, 118, 230, .35);
        pointer-events: none;
      }
      .${areaGuideClass} {
        position: fixed;
        border: 1px solid rgba(255,214,102,.45);
        background: rgba(255,214,102,.08);
        border-radius: 8px;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.06);
        pointer-events: none;
      }
      .${gapMarkerClass} {
        position: fixed;
        width: 3px;
        border-radius: 1px;
        pointer-events: none;
        opacity: .7;
        transform: translateX(-1px);
      }
      .${gapMarkerClass}.is-positive { background: #2676e6; }
      .${gapMarkerClass}.is-negative { background: #e05050; }
      .${panelClass} {
        position: fixed;
        min-width: 312px;
        max-width: min(360px, calc(100vw - 24px));
        pointer-events: auto;
        background: rgba(28,28,30,.96);
        color: rgba(255,255,255,.82);
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 14px;
        box-shadow: 0 18px 56px rgba(0,0,0,.34);
        font: 500 12px/1.4 sans-serif;
        overflow: hidden;
        user-select: none;
        backdrop-filter: blur(14px);
      }
      .${panelClass}.is-dragging { box-shadow: 0 22px 68px rgba(0,0,0,.4); }
      .${headerClass} {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 16px 12px;
        background: none;
        cursor: grab;
      }
      .${panelClass}.is-dragging .${headerClass} { cursor: grabbing; }
      .${headingClass} {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex: 1;
      }
      .${headingClass} strong {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: .01em;
        color: #fff;
      }
      .${bodyClass} {
        padding: 4px 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .${bodyClass}[hidden] { display: none; }
      .${rowClass} { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
      .${rowClass} + .${rowClass} { margin-top: 0; }
      .${actionsClass} {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        width: 100%;
      }
      .${buttonClass} {
        min-height: 34px;
        width: 100%;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 9px;
        background: rgba(255,255,255,.03);
        color: rgba(255,255,255,.84);
        padding: 8px 10px;
        cursor: pointer;
        font: inherit;
        font-weight: 600;
        text-align: center;
      }
      .${iconButtonClass} {
        width: 24px; height: 24px; padding: 0; border: 1px solid rgba(255,255,255,.18); border-radius: 999px;
        background: rgba(255,255,255,.03); color: rgba(255,255,255,.76); cursor: pointer; font: inherit; line-height: 1;
        flex: none;
      }
      .${iconButtonClass}:hover,
      .${buttonClass}:hover:not(:disabled) {
        color: #fff;
        border-color: rgba(255,255,255,.3);
        background: rgba(255,255,255,.08);
      }
      .${buttonClass}:disabled { opacity: .2; cursor: default; }
      .${helpClass} {
        display: block;
        font-size: 11px;
        line-height: 1.55;
        color: rgba(255,255,255,.6);
      }
      .${toastClass} {
        display: none;
        font-size: 11px;
        color: rgba(255,255,255,.72);
        padding-top: 2px;
      }
      .${editorClass('warn')} {
        display: none;
        font-size: 11px;
        line-height: 1.45;
        color: #f5a623;
        padding: 8px 16px;
        border-bottom: 1px solid rgba(255,255,255,.06);
      }
      .${CHAR_CLASS} { display: inline; }
      .${ACTIVE_CLASS} { outline: 1px dashed rgba(255,255,255,.72); outline-offset: 4px; user-select: none; }
      .${ACTIVE_CLASS} ::selection { background: transparent; }
      .${ACTIVE_CLASS} *::selection { background: transparent; }
    </style>
    <div class="${rootClass}">
      <div class="${cursorClass}"></div>
      <div class="${valueClass}"></div>
      <div class="${selectionClass}"></div>
      <div class="${areaGuidesClass}"></div>
      <div class="${markersClass}"></div>
      <div class="${panelClass} js-panel">
        <div class="${headerClass} js-drag-handle">
          <div class="${headingClass}">
            <strong>${plugin.name}</strong>
          </div>
          <button class="${iconButtonClass} js-collapse" type="button" aria-label="${t.collapse}" title="${t.collapse}">−</button>
        </div>
        <div class="${editorClass('warn')} js-warn"></div>
        <div class="${bodyClass} js-panel-body">
          <div class="${rowClass} ${actionsClass}">
            <button class="${buttonClass} js-compare">${t.compare}</button>
            <button class="${buttonClass} js-gaps">${t.guides}</button>
            <button class="${buttonClass} js-export">${t.export}</button>
            <button class="${buttonClass} js-reset">${t.reset}</button>
          </div>
          <div class="${rowClass}">
            <span class="${helpClass}">${t.helpText}</span>
          </div>
          <span class="${toastClass}">${t.copied}</span>
        </div>
      </div>
    </div>
  `

  const cursorEl = root.querySelector(`.${cursorClass}`) as HTMLDivElement
  const valueEl = root.querySelector(`.${valueClass}`) as HTMLDivElement
  const selectionContainer = root.querySelector(`.${selectionClass}`) as HTMLDivElement
  const areaGuidesContainer = root.querySelector(`.${areaGuidesClass}`) as HTMLDivElement
  const markersContainer = root.querySelector(`.${markersClass}`) as HTMLDivElement
  const panelEl = root.querySelector('.js-panel') as HTMLDivElement
  const panelBodyEl = root.querySelector('.js-panel-body') as HTMLDivElement
  const dragHandleEl = root.querySelector('.js-drag-handle') as HTMLDivElement
  const collapseBtn = root.querySelector('.js-collapse') as HTMLButtonElement
  const compareBtn = root.querySelector('.js-compare') as HTMLButtonElement
  const gapsBtn = root.querySelector('.js-gaps') as HTMLButtonElement
  const exportBtn = root.querySelector('.js-export') as HTMLButtonElement
  const resetBtn = root.querySelector('.js-reset') as HTMLButtonElement
  const toastEl = root.querySelector(`.${toastClass}`) as HTMLSpanElement
  const warnEl = root.querySelector('.js-warn') as HTMLDivElement
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

  function clampPanelPosition(x: number, y: number) {
    const margin = 12
    const width = panelEl.offsetWidth || 280
    const height = panelEl.offsetHeight || 120
    return {
      x: Math.min(Math.max(margin, x), Math.max(margin, window.innerWidth - width - margin)),
      y: Math.min(Math.max(margin, y), Math.max(margin, window.innerHeight - height - margin)),
    }
  }

  function syncPanelPosition() {
    const next = clampPanelPosition(panelX, panelY)
    panelX = next.x
    panelY = next.y
    panelEl.style.left = `${panelX}px`
    panelEl.style.top = `${panelY}px`
  }

  function positionPanelDefault() {
    if (!panelPositioned) {
      const rect = panelEl.getBoundingClientRect()
      panelX = window.innerWidth - rect.width - 16
      panelY = window.innerHeight - rect.height - 16
      panelPositioned = true
    }
    syncPanelPosition()
  }

  function setCollapsed(next: boolean) {
    collapsed = next
    panelEl.classList.toggle('is-collapsed', collapsed)
    panelBodyEl.hidden = collapsed
    const label = collapsed ? t.expand : t.collapse
    collapseBtn.textContent = collapsed ? '+' : '−'
    collapseBtn.setAttribute('aria-label', label)
    collapseBtn.title = label
    window.requestAnimationFrame(syncPanelPosition)
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
    setCollapsed(!collapsed)
  }

  function onPointerMove(e: PointerEvent) {
    if (dragPointerId !== e.pointerId) return
    panelX = e.clientX - dragOffsetX
    panelY = e.clientY - dragOffsetY
    syncPanelPosition()
  }

  function onPointerEnd(e: PointerEvent) {
    if (dragPointerId !== e.pointerId) return
    dragPointerId = null
    panelEl.classList.remove('is-dragging')
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerEnd)
    window.removeEventListener('pointercancel', onPointerEnd)
  }

  function onDragStart(e: PointerEvent) {
    const target = e.target as HTMLElement
    if (target.closest('button')) return
    const rect = panelEl.getBoundingClientRect()
    dragPointerId = e.pointerId
    dragOffsetX = e.clientX - rect.left
    dragOffsetY = e.clientY - rect.top
    panelEl.classList.add('is-dragging')
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerEnd)
    window.addEventListener('pointercancel', onPointerEnd)
  }

  function onResize() {
    if (mounted && panelPositioned) syncPanelPosition()
  }

  const editor: KerningEditor = {
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
        if (options.kerning) applyKerning(options.kerning)
        return
      }
      if (mounted) return
      mounted = true
      if (options.kerning) applyKerning(options.kerning)
      lastAreaGuidesKey = ''
      lastMarkersKey = ''
      lastSelectionKey = ''
      document.body.appendChild(root)
      setCollapsed(false)
      positionPanelDefault()
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
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerEnd)
      window.removeEventListener('pointercancel', onPointerEnd)
      root.remove()
    },
  }

  return editor
}
