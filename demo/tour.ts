/**
 * 宣言的ツアーエンジン — ステップ定義オブジェクトからインタラクティブツアーを再生する
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CaptionPart = string | { kbd: string } | { strong: string } | { key: string; label: string }

type CaptionPosition = 'bottom' | 'top' | 'left' | 'right'

export type TourAction =
  // 表示系
  | { type: 'overlay'; visible: boolean }
  | { type: 'caption'; target: string; position: CaptionPosition; content: CaptionPart[]; instant?: boolean }
  | { type: 'caption-center'; content: CaptionPart[] }
  | { type: 'caption-hide' }
  | { type: 'spotlight-move'; target: string; pad?: number }
  | { type: 'spotlight-teleport'; target: string; pad?: number }
  | { type: 'spotlight-transition'; duration: string; easing?: string }
  | { type: 'highlight'; target: string }
  // シミュレーション系
  | { type: 'click'; target: string; position?: 'center' | 'left' }
  | { type: 'key'; key: string; code?: string; modifiers?: Record<string, boolean>; repeat?: number; interval?: number; highlight?: string[]; holdKeys?: string[] }
  | { type: 'scroll'; target: string; block?: ScrollLogicalPosition }
  // 制御系
  | { type: 'wait'; ms: number }
  | { type: 'run'; fn: (ctx: TourContext) => void | Promise<void> }

export interface TourStep {
  actions: TourAction[]
}

export interface TourOptions {
  steps: TourStep[]
  doneKey: string
  skipLabel?: string
  replayLabel?: string
  onBeforeReplay?: () => void
  /** ツアー終了時（完走・スキップ・クリックキャンセル問わず）に呼ばれるコールバック */
  onDone?: () => void
  /** ツアーUI要素に付与する属性名。外部ライブラリがツアー要素を無視するために使用 */
  ignoreAttr?: string
}

export interface Tour {
  start(): void
  readonly active: boolean
}

export interface TourContext {
  spotlight: HTMLElement
  caption: HTMLElement
  flashKeys(keys: string[]): void
  clearKeys(): void
  showRipple(x: number, y: number): void
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type CancelRegistrar = (handler: () => void) => () => void

function sleep(ms: number, onCancel?: CancelRegistrar): Promise<void> {
  return new Promise(resolve => {
    const id = window.setTimeout(() => {
      cleanup()
      resolve()
    }, ms)
    const cleanup = () => {
      if (cancelCleanup) cancelCleanup()
      window.clearTimeout(id)
    }
    const cancelCleanup = onCancel?.(() => {
      cleanup()
      resolve()
    })
  })
}

function resolve(selector: string): HTMLElement | null {
  return document.querySelector(selector) as HTMLElement | null
}

// --- DOM creation ---

const TOUR_Z = '100001'
const TOUR_Z_TOP = '100002'

function createSpotlight(ignoreAttr?: string): HTMLElement {
  const el = document.createElement('div')
  if (ignoreAttr) el.setAttribute(ignoreAttr, 'true')
  Object.assign(el.style, {
    position: 'fixed',
    zIndex: TOUR_Z,
    boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
    borderRadius: '14px',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    pointerEvents: 'none',
    left: 'calc(100vw - 180px)',
    top: 'calc(100vh - 110px)',
    width: '0px',
    height: '0px',
  })
  return el
}

function createCaption(ignoreAttr?: string): HTMLElement {
  const el = document.createElement('div')
  el.className = 'tour-caption'
  if (ignoreAttr) el.setAttribute(ignoreAttr, 'true')
  Object.assign(el.style, {
    position: 'fixed',
    zIndex: TOUR_Z,
    background: '#1a1a1a',
    color: '#fff',
    padding: '14px 20px',
    borderRadius: '12px',
    border: '4px solid #ccc',
    fontFamily: "'Space Grotesk', -apple-system, sans-serif",
    fontSize: '15px',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    maxWidth: 'min(360px, calc(100vw - 24px))',
    boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
    pointerEvents: 'auto',
    transition: 'opacity 0.3s, transform 0.3s',
    opacity: '0',
    transform: 'translate(-50%, -50%)',
    left: '50%',
    top: '50%',
  })
  return el
}

function createStyleEl(): HTMLStyleElement {
  const el = document.createElement('style')
  el.textContent = `
    .tour-caption kbd {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 5px;
      background: rgba(255,255,255,0.12);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.88em;
      border: 1px solid rgba(255,255,255,0.2);
    }
    .tour-caption strong { color: #f5a623; }
    .tour-caption .tour-step-label {
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.5);
      margin-bottom: 4px;
    }
    .tour-highlight-ring {
      outline: 2px solid #f5a623 !important;
      outline-offset: 3px !important;
      border-radius: 6px;
    }
    .tour-skip-btn {
      position: relative;
      z-index: ${TOUR_Z_TOP};
    }
    .tour-keycap {
      display: inline-block;
      min-width: 24px;
      padding: 3px 8px;
      border-radius: 6px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      color: rgba(255,255,255,0.5);
      font: 600 13px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
      text-align: center;
      transition: all 0.12s ease;
    }
    .tour-keycap-active {
      background: rgba(245, 166, 35, 0.25);
      border-color: rgba(245, 166, 35, 0.6);
      color: #f5a623;
      box-shadow: 0 0 8px rgba(245, 166, 35, 0.3);
    }
    .tour-keycap-pop {
      animation: tour-keycap-pop 0.15s ease-out;
    }
    @keyframes tour-keycap-pop {
      0% { transform: scale(1.25); }
      100% { transform: scale(1); }
    }
  `
  return el
}

// --- Spotlight ---

function getTargetRadius(target: HTMLElement): number {
  return parseFloat(getComputedStyle(target).borderRadius) || 0
}

function moveSpotlight(spotlight: HTMLElement, target: HTMLElement, pad = 10) {
  const rect = target.getBoundingClientRect()
  spotlight.style.boxShadow = '0 0 0 9999px rgba(0,0,0,0.45)'
  Object.assign(spotlight.style, {
    left: `${rect.left - pad}px`,
    top: `${rect.top - pad}px`,
    width: `${rect.width + pad * 2}px`,
    height: `${rect.height + pad * 2}px`,
    borderRadius: `${getTargetRadius(target) + pad}px`,
  })
}

async function teleportSpotlight(
  spotlight: HTMLElement,
  target: HTMLElement,
  pad = 10,
  onCancel?: CancelRegistrar,
  isCancelled?: () => boolean,
) {
  const rect = target.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  // 穴を閉じる
  spotlight.style.transition = 'left 0.3s, top 0.3s, width 0.3s, height 0.3s, border-radius 0.3s'
  const oldRect = spotlight.getBoundingClientRect()
  const oldCx = oldRect.left + oldRect.width / 2
  const oldCy = oldRect.top + oldRect.height / 2
  Object.assign(spotlight.style, {
    left: `${oldCx}px`,
    top: `${oldCy}px`,
    width: '0px',
    height: '0px',
  })
  await sleep(300, onCancel)
  if (isCancelled?.()) return

  // トランジションなしで移動先に配置
  spotlight.style.transition = 'none'
  Object.assign(spotlight.style, {
    left: `${cx}px`,
    top: `${cy}px`,
    width: '0px',
    height: '0px',
  })
  spotlight.offsetHeight // force reflow

  // 穴を開く
  spotlight.style.transition = 'left 0.35s, top 0.35s, width 0.35s, height 0.35s, border-radius 0.35s'
  Object.assign(spotlight.style, {
    left: `${rect.left - pad}px`,
    top: `${rect.top - pad}px`,
    width: `${rect.width + pad * 2}px`,
    height: `${rect.height + pad * 2}px`,
    borderRadius: `${getTargetRadius(target) + pad}px`,
  })
  await sleep(350, onCancel)
  if (isCancelled?.()) return

  spotlight.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
}

// --- Caption ---

function buildCaptionContent(caption: HTMLElement, stepNum: number, totalSteps: number, parts: CaptionPart[]) {
  caption.textContent = ''

  const label = document.createElement('div')
  label.className = 'tour-step-label'
  label.textContent = `Step ${stepNum} / ${totalSteps}`
  caption.appendChild(label)

  for (const part of parts) {
    if (typeof part === 'string') {
      caption.appendChild(document.createTextNode(part))
    } else if ('kbd' in part) {
      const kbd = document.createElement('kbd')
      kbd.textContent = part.kbd
      caption.appendChild(kbd)
    } else if ('key' in part) {
      const keycap = document.createElement('kbd')
      keycap.className = 'tour-keycap'
      keycap.setAttribute('data-tour-key', part.key)
      keycap.textContent = part.label
      caption.appendChild(keycap)
    } else if ('strong' in part) {
      const strong = document.createElement('strong')
      strong.textContent = part.strong
      caption.appendChild(strong)
    }
  }
}

function showCaption(caption: HTMLElement, stepNum: number, totalSteps: number, parts: CaptionPart[]) {
  caption.style.opacity = '0'
  caption.style.transform = 'translateY(8px)'
  buildCaptionContent(caption, stepNum, totalSteps, parts)

  requestAnimationFrame(() => {
    const captionRect = caption.getBoundingClientRect()
    // Skip tourボタン分のスペースを確保（ボタン高さ ~36px + bottom 24px + gap 12px）
    const bottomMargin = 72
    if (captionRect.bottom > window.innerHeight - bottomMargin) {
      caption.style.top = `${window.innerHeight - captionRect.height - bottomMargin}px`
    }
    caption.style.opacity = '1'
    caption.style.transform = 'translateY(0)'
  })
}

function setCaptionCenter(caption: HTMLElement, stepNum: number, totalSteps: number, parts: CaptionPart[]) {
  buildCaptionContent(caption, stepNum, totalSteps, parts)
  Object.assign(caption.style, {
    left: '50%',
    top: '50%',
    right: 'auto',
    bottom: 'auto',
    transform: 'translate(-50%, -50%)',
    opacity: '1',
  })
}

function clampLeft(left: number, caption: HTMLElement, margin = 12): number {
  const vw = window.innerWidth
  const w = caption.offsetWidth || 360
  return Math.max(margin, Math.min(left, vw - w - margin))
}

function moveCaption(caption: HTMLElement, target: HTMLElement, position: CaptionPosition) {
  const rect = target.getBoundingClientRect()
  const pad = 16
  const margin = 12

  caption.style.left = 'auto'
  caption.style.top = 'auto'
  caption.style.right = 'auto'
  caption.style.bottom = 'auto'

  if (position === 'bottom') {
    caption.style.left = `${clampLeft(rect.left, caption, margin)}px`
    caption.style.top = `${rect.bottom + pad}px`
  } else if (position === 'top') {
    caption.style.left = `${clampLeft(rect.left, caption, margin)}px`
    caption.style.bottom = `${window.innerHeight - rect.top + pad}px`
  } else if (position === 'right') {
    caption.style.left = `${clampLeft(rect.right + pad, caption, margin)}px`
    caption.style.top = `${rect.top}px`
  } else if (position === 'left') {
    // 左配置: 画面幅が狭い場合はtopにフォールバック（パレットボタンの上に表示）
    const rightEdge = window.innerWidth - rect.left + pad
    const captionWidth = caption.offsetWidth || 360
    if (rightEdge + captionWidth > window.innerWidth - margin * 2) {
      caption.style.left = `${clampLeft(rect.left, caption, margin)}px`
      caption.style.bottom = `${window.innerHeight - rect.top + pad}px`
    } else {
      caption.style.right = `${rightEdge}px`
      const maxTop = window.innerHeight - caption.offsetHeight - 24
      caption.style.top = `${Math.min(rect.top, maxTop)}px`
    }
  }
}

function hideCaption(caption: HTMLElement) {
  caption.style.opacity = '0'
  caption.style.transform = 'translateY(8px)'
}

// --- Highlight ---

let highlightedEl: HTMLElement | null = null

function highlightButton(el: HTMLElement) {
  clearHighlight()
  el.classList.add('tour-highlight-ring')
  highlightedEl = el
}

function clearHighlight() {
  if (highlightedEl) {
    highlightedEl.classList.remove('tour-highlight-ring')
    highlightedEl = null
  }
}

// --- Interaction simulation ---

function simulateClick(el: HTMLElement, position: 'center' | 'left' = 'center') {
  const rect = el.getBoundingClientRect()
  const x = position === 'left' ? rect.left + 4 : rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }))
}

function simulateKey(key: string, code: string | undefined, modifiers: Record<string, boolean> = {}) {
  const o = { key, code: code ?? key, bubbles: true, ...modifiers }
  window.dispatchEvent(new KeyboardEvent('keydown', o))
  window.dispatchEvent(new KeyboardEvent('keyup', o))
}

function showClickRipple(x: number, y: number, ignoreAttr?: string): void {
  const ripple = document.createElement('div')
  if (ignoreAttr) ripple.setAttribute(ignoreAttr, 'true')
  Object.assign(ripple.style, {
    position: 'fixed',
    left: `${x}px`,
    top: `${y}px`,
    width: '0px',
    height: '0px',
    borderRadius: '50%',
    border: '2px solid rgba(245, 166, 35, 0.8)',
    pointerEvents: 'none',
    zIndex: TOUR_Z_TOP,
    transform: 'translate(-50%, -50%)',
  })
  document.body.appendChild(ripple)

  ripple.animate([
    { width: '0px', height: '0px', opacity: 1 },
    { width: '40px', height: '40px', opacity: 0 },
  ], { duration: 500, easing: 'ease-out', fill: 'forwards' })

  setTimeout(() => ripple.remove(), 500)
}

// --- Keycap highlight ---

function flashKeycaps(caption: HTMLElement, keys: string[], preserve: string[] = []) {
  // 前回のハイライトをクリア（hold中のキーは保護）
  caption.querySelectorAll('.tour-keycap-active').forEach(el => {
    const name = el.getAttribute('data-tour-key') ?? ''
    if (!keys.includes(name) && !preserve.includes(name)) {
      el.classList.remove('tour-keycap-active', 'tour-keycap-pop')
    }
  })
  for (const name of keys) {
    const el = caption.querySelector(`[data-tour-key="${name}"]`)
    if (!el) continue
    el.classList.add('tour-keycap-active')
    // ポップアニメーションをリトリガー
    el.classList.remove('tour-keycap-pop')
    void (el as HTMLElement).offsetHeight
    el.classList.add('tour-keycap-pop')
  }
}

function clearKeycaps(caption: HTMLElement) {
  caption.querySelectorAll('.tour-keycap-active').forEach(el => {
    el.classList.remove('tour-keycap-active')
  })
}

// ---------------------------------------------------------------------------
// Action executor
// ---------------------------------------------------------------------------

interface RunContext {
  spotlight: HTMLElement
  caption: HTMLElement
  stepNum: number
  totalSteps: number
  cancelled: boolean
  ignoreAttr?: string
  onCancel: CancelRegistrar
  isCancelled: () => boolean
}

async function executeAction(action: TourAction, ctx: RunContext): Promise<void> {
  switch (action.type) {
    case 'overlay': {
      if (action.visible) {
        ctx.spotlight.style.boxShadow = '0 0 0 9999px rgba(0,0,0,0.45)'
        ctx.spotlight.style.opacity = '1'
      } else {
        ctx.spotlight.style.boxShadow = 'none'
      }
      break
    }

    case 'caption': {
      const target = resolve(action.target)
      if (!target) break
      moveCaption(ctx.caption, target, action.position)
      if (action.instant) {
        ctx.caption.style.transition = 'none'
        buildCaptionContent(ctx.caption, ctx.stepNum, ctx.totalSteps, action.content)
        ctx.caption.style.opacity = '1'
        ctx.caption.style.transform = 'translateY(0)'
        ctx.caption.offsetHeight
        ctx.caption.style.transition = 'opacity 0.3s, transform 0.3s'
      } else {
        showCaption(ctx.caption, ctx.stepNum, ctx.totalSteps, action.content)
      }
      break
    }

    case 'caption-center': {
      setCaptionCenter(ctx.caption, ctx.stepNum, ctx.totalSteps, action.content)
      break
    }

    case 'caption-hide': {
      hideCaption(ctx.caption)
      break
    }

    case 'spotlight-move': {
      const target = resolve(action.target)
      if (!target) break
      moveSpotlight(ctx.spotlight, target, action.pad)
      break
    }

    case 'spotlight-teleport': {
      const target = resolve(action.target)
      if (!target) break
      // テレポート前にキャプションを即消し
      ctx.caption.style.transition = 'none'
      ctx.caption.style.opacity = '0'
      ctx.caption.offsetHeight
      ctx.caption.style.transition = 'opacity 0.3s, transform 0.3s'
      await teleportSpotlight(ctx.spotlight, target, action.pad, ctx.onCancel, ctx.isCancelled)
      break
    }

    case 'spotlight-transition': {
      ctx.spotlight.style.transition = `all ${action.duration} ${action.easing ?? 'ease'}`
      break
    }

    case 'highlight': {
      const target = resolve(action.target)
      if (target) highlightButton(target)
      break
    }

    case 'click': {
      const target = resolve(action.target)
      if (target) simulateClick(target, action.position)
      break
    }

    case 'key': {
      const repeat = action.repeat ?? 1
      const interval = action.interval ?? 0
      const flash = action.highlight ?? []
      const hold = action.holdKeys ?? []

      // holdKeys はアクション開始時にハイライト（ポップなし）
      for (const name of hold) {
        const el = ctx.caption.querySelector(`[data-tour-key="${name}"]`)
        if (el) el.classList.add('tour-keycap-active')
      }

      for (let i = 0; i < repeat; i++) {
        if (ctx.isCancelled()) return
        if (flash.length) flashKeycaps(ctx.caption, flash, hold)
        simulateKey(action.key, action.code, action.modifiers)
        if (interval > 0 && i < repeat - 1) {
          await sleep(interval, ctx.onCancel)
          if (ctx.isCancelled()) return
        }
      }

      if (flash.length || hold.length) {
        await sleep(120, ctx.onCancel)
        if (ctx.isCancelled()) return
        clearKeycaps(ctx.caption)
      }
      break
    }

    case 'scroll': {
      const target = resolve(action.target)
      if (target) target.scrollIntoView({ behavior: 'smooth', block: action.block ?? 'center' })
      break
    }

    case 'wait': {
      await sleep(action.ms, ctx.onCancel)
      break
    }

    case 'run': {
      const tourCtx: TourContext = {
        spotlight: ctx.spotlight,
        caption: ctx.caption,
        flashKeys: (keys) => flashKeycaps(ctx.caption, keys),
        clearKeys: () => clearKeycaps(ctx.caption),
        showRipple: (x, y) => showClickRipple(x, y, ctx.ignoreAttr),
      }
      await action.fn(tourCtx)
      break
    }

  }
}

// ---------------------------------------------------------------------------
// createTour
// ---------------------------------------------------------------------------

export function createTour(options: TourOptions): Tour {
  const { steps, doneKey, onBeforeReplay, onDone, ignoreAttr } = options
  const skipLabel = options.skipLabel ?? 'Skip tour'
  const replayLabel = options.replayLabel ?? 'Replay tour'

  let _active = false
  let replayBtn: HTMLElement | null = null
  let styleInjected = false

  function ensureStyle() {
    if (styleInjected) return
    styleInjected = true
    document.head.appendChild(createStyleEl())
  }

  function showReplayButton() {
    if (replayBtn) return
    ensureStyle()
    replayBtn = document.createElement('button')
    replayBtn.className = 'nav-btn tour-replay-btn'
    if (ignoreAttr) replayBtn.setAttribute(ignoreAttr, 'true')
    replayBtn.textContent = replayLabel
    replayBtn.addEventListener('click', () => {
      replayBtn?.remove()
      replayBtn = null
      localStorage.removeItem(doneKey)
      onBeforeReplay?.()
      runTour()
    })
    const nav = document.querySelector('.top-nav')
    if (nav) {
      nav.insertBefore(replayBtn, nav.firstChild)
    } else {
      document.body.appendChild(replayBtn)
    }
  }

  function runTour() {
    _active = true
    let cancelled = false
    const cancelCallbacks = new Set<() => void>()

    const onCancel: CancelRegistrar = (handler) => {
      cancelCallbacks.add(handler)
      return () => cancelCallbacks.delete(handler)
    }

    const isCancelled = () => cancelled

    const requestCancel = () => {
      if (cancelled) return
      cancelled = true
      for (const handler of Array.from(cancelCallbacks)) handler()
      cancelCallbacks.clear()
    }

    const spotlight = createSpotlight(ignoreAttr)
    const caption = createCaption(ignoreAttr)
    const styleEl = createStyleEl()

    const skipBtn = document.createElement('button')
    skipBtn.className = 'nav-btn tour-skip-btn'
    if (ignoreAttr) skipBtn.setAttribute(ignoreAttr, 'true')
    skipBtn.textContent = skipLabel
    skipBtn.addEventListener('click', requestCancel)

    function onPagePointerDown(e: PointerEvent) {
      if (!e.isTrusted) return
      const target = e.target as HTMLElement
      if (target.closest('.tour-skip-btn') || target.closest('.nav-btn')) return
      requestCancel()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (!e.isTrusted) return
      if (e.key === 'Escape') requestCancel()
    }
    document.addEventListener('pointerdown', onPagePointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)

    document.head.appendChild(styleEl)
    const nav = document.querySelector('.top-nav')
    if (nav) {
      nav.insertBefore(skipBtn, nav.firstChild)
    } else {
      document.body.appendChild(skipBtn)
    }
    document.body.append(spotlight, caption)

    // 初期状態: スポットライト非表示
    spotlight.style.opacity = '0'

    function cleanup() {
      document.removeEventListener('pointerdown', onPagePointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
      _active = false
      clearHighlight()
      localStorage.setItem(doneKey, '1')
      onDone?.()
      spotlight.style.boxShadow = 'none'
      caption.style.opacity = '0'
      skipBtn.style.opacity = '0'
      setTimeout(() => {
        spotlight.remove()
        caption.remove()
        skipBtn.remove()
        styleEl.remove()
        showReplayButton()
      }, 300)
    }

    async function run() {
      for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
        const step = steps[stepIdx]
        const ctx: RunContext = {
          spotlight,
          caption,
          stepNum: stepIdx + 1,
          totalSteps: steps.length,
          cancelled: false,
          ignoreAttr,
          onCancel,
          isCancelled,
        }

        for (const action of step.actions) {
          if (cancelled) return cleanup()
          ctx.cancelled = cancelled
          await executeAction(action, ctx)
          if (cancelled) return cleanup()
        }
      }
      cleanup()
    }

    run()
  }

  const tour: Tour = {
    start() {
      if (localStorage.getItem(doneKey)) {
        showReplayButton()
        return
      }
      runTour()
    },
    get active() {
      return _active
    },
  }

  return tour
}
