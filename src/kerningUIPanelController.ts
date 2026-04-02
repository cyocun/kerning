interface PanelControllerOptions {
  panelEl: HTMLDivElement
  panelBodyEl: HTMLDivElement
  collapseBtn: HTMLButtonElement
  getCollapseLabel(): string
  getExpandLabel(): string
}

export interface KerningUIPanelController {
  setCollapsed(next: boolean): void
  toggleCollapsed(): void
  positionDefault(): void
  onResize(): void
  startDrag(event: PointerEvent): void
  dispose(): void
}

const MARGIN = 12
const DEFAULT_OFFSET = 16
/** panelBottom がこの値以下なら最下部とみなし、下方向に折りたたむ */
const BOTTOM_ANCHOR_THRESHOLD = 30
const FALLBACK_WIDTH = 280
const FALLBACK_HEIGHT = 120

export function createKerningUIPanelController(options: PanelControllerOptions): KerningUIPanelController {
  const { panelEl, panelBodyEl, collapseBtn, getCollapseLabel, getExpandLabel } = options

  let collapsed = false
  let panelPositioned = false
  let panelRight = 0
  let panelBottom = 0
  let dragPointerId: number | null = null
  let dragOffsetX = 0
  let dragOffsetY = 0

  function getPanelSize() {
    return {
      width: panelEl.offsetWidth || FALLBACK_WIDTH,
      height: panelEl.offsetHeight || FALLBACK_HEIGHT,
    }
  }

  /** right/bottom オフセットから left/top ピクセル値を算出 */
  function toLeftTop(right: number, bottom: number) {
    const { width, height } = getPanelSize()
    return {
      left: window.innerWidth - right - width,
      top: window.innerHeight - bottom - height,
    }
  }

  function clampOffsets(right: number, bottom: number) {
    const { width, height } = getPanelSize()
    return {
      right: Math.min(Math.max(MARGIN, right), Math.max(MARGIN, window.innerWidth - width - MARGIN)),
      bottom: Math.min(Math.max(MARGIN, bottom), Math.max(MARGIN, window.innerHeight - height - MARGIN)),
    }
  }

  function syncPanelPosition() {
    const clamped = clampOffsets(panelRight, panelBottom)
    panelRight = clamped.right
    panelBottom = clamped.bottom
    const { left, top } = toLeftTop(panelRight, panelBottom)
    panelEl.style.left = `${left}px`
    panelEl.style.top = `${top}px`
  }

  function removeDragListeners() {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerEnd)
    window.removeEventListener('pointercancel', onPointerEnd)
  }

  function onPointerMove(event: PointerEvent) {
    if (dragPointerId !== event.pointerId) return
    const { left, top } = toLeftTop(panelRight, panelBottom)
    const newLeft = event.clientX - dragOffsetX
    const newTop = event.clientY - dragOffsetY
    const { width, height } = getPanelSize()
    panelRight += left - newLeft
    panelBottom += top - newTop
    syncPanelPosition()
  }

  function onPointerEnd(event: PointerEvent) {
    if (dragPointerId !== event.pointerId) return
    dragPointerId = null
    panelEl.classList.remove('is-dragging')
    removeDragListeners()
  }

  function setCollapsed(next: boolean) {
    const changed = collapsed !== next
    const heightBefore = changed ? panelEl.offsetHeight : 0
    collapsed = next
    panelEl.classList.toggle('is-collapsed', collapsed)
    panelBodyEl.hidden = collapsed
    const label = collapsed ? getExpandLabel() : getCollapseLabel()
    collapseBtn.textContent = collapsed ? '+' : '−'
    collapseBtn.setAttribute('aria-label', label)
    collapseBtn.title = label
    if (changed && panelBottom > BOTTOM_ANCHOR_THRESHOLD) {
      panelBottom += heightBefore - panelEl.offsetHeight
    }
    window.requestAnimationFrame(syncPanelPosition)
  }

  return {
    setCollapsed,
    toggleCollapsed() {
      setCollapsed(!collapsed)
    },
    positionDefault() {
      if (!panelPositioned) {
        panelRight = DEFAULT_OFFSET
        panelBottom = DEFAULT_OFFSET
        panelPositioned = true
      }
      syncPanelPosition()
    },
    onResize() {
      if (panelPositioned) syncPanelPosition()
    },
    startDrag(event: PointerEvent) {
      if ((event.target as HTMLElement).closest('button')) return
      const { left, top } = toLeftTop(panelRight, panelBottom)
      dragPointerId = event.pointerId
      dragOffsetX = event.clientX - left
      dragOffsetY = event.clientY - top
      panelEl.classList.add('is-dragging')
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerEnd)
      window.addEventListener('pointercancel', onPointerEnd)
    },
    dispose() {
      dragPointerId = null
      removeDragListeners()
    },
  }
}
