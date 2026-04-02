/**
 * デモページのチュートリアル定義
 * ツアーエンジンに渡すステップ配列 + デモ固有のヘルパー
 */

import type { TourStep } from './tour'
import type { TutorialContent } from './locales/types'

export const TUTORIAL_DONE_KEY = 'visual-kerning-tutorial-done'

type OnEnable = (handler: () => void) => (() => void)

const isMac = navigator.platform.includes('Mac')

function smoothScrollTo(action: () => void, isAtTarget: () => boolean): Promise<void> {
  return new Promise<void>(resolve => {
    if (isAtTarget()) { resolve(); return }
    const timeout = setTimeout(done, 1500)
    function done() {
      clearTimeout(timeout)
      window.removeEventListener('scrollend', done)
      resolve()
    }
    window.addEventListener('scrollend', done, { once: true })
    action()
  })
}

export function simulateCmdK() {
  const o = { key: 'k', code: 'KeyK', bubbles: true, metaKey: isMac, ctrlKey: !isMac }
  window.dispatchEvent(new KeyboardEvent('keydown', o))
  window.dispatchEvent(new KeyboardEvent('keyup', o))
}

function animateJsonDownload(anchor: HTMLElement): Promise<void> {
  const rect = anchor.getBoundingClientRect()
  const startX = rect.left + rect.width / 2 - 24
  const startY = rect.top + rect.height / 2 - 30

  const icon = document.createElement('div')
  icon.setAttribute('data-visual-kerning-ignore', 'true')

  const parser = new DOMParser()
  const svgDoc = parser.parseFromString(
    '<svg width="48" height="60" viewBox="0 0 48 60" fill="none" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M4 0h28l16 16v40a4 4 0 01-4 4H4a4 4 0 01-4-4V4a4 4 0 014-4z" fill="#fff"/>'
    + '<path d="M32 0l16 16H36a4 4 0 01-4-4V0z" fill="#ddd"/>'
    + '<path d="M4 0h28l16 16v40a4 4 0 01-4 4H4a4 4 0 01-4-4V4a4 4 0 014-4z" stroke="#ccc" stroke-width="1" fill="none"/>'
    + '<text x="24" y="42" text-anchor="middle" fill="#1a1a1a" font-family="ui-monospace,SFMono-Regular,monospace" font-size="16" font-weight="700">{ }</text>'
    + '</svg>',
    'image/svg+xml',
  )
  icon.appendChild(svgDoc.documentElement)

  Object.assign(icon.style, {
    position: 'fixed',
    left: `${startX}px`,
    top: `${startY}px`,
    zIndex: '100002',
    pointerEvents: 'none',
    filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))',
  })
  document.body.appendChild(icon)
  icon.offsetHeight

  const totalDuration = 1200
  const frames: Keyframe[] = []
  const v0 = -14
  const g = 0.45
  const numFrames = 30

  for (let i = 0; i <= numFrames; i++) {
    const t = i / numFrames
    const time = t * totalDuration / 16
    const y = v0 * time + 0.5 * g * time * time
    const rotation = -8 + t * 20
    frames.push({
      transform: `translateY(${y}px) rotate(${rotation}deg)`,
      opacity: 1,
      offset: t,
    })
  }

  const anim = icon.animate(frames, {
    duration: totalDuration,
    easing: 'linear',
    fill: 'forwards',
  })

  return new Promise(resolve => {
    anim.onfinish = () => { icon.remove(); resolve() }
  })
}

// --- ステップ定義 ---

const TARGET_TEXT = '.card:first-child [data-sizable]'

export function buildTutorialSteps(onEnable: OnEnable, t: TutorialContent): TourStep[] {
  let enabledPromise: Promise<void>
  return [
    // Step 0: イントロ
    {
      actions: [
        { type: 'run', fn: () => smoothScrollTo(
          () => window.scrollTo({ top: 0, behavior: 'smooth' }),
          () => window.scrollY === 0,
        )},
        { type: 'overlay', visible: true },
        { type: 'caption-center', content: t.welcome },
        { type: 'wait', ms: 4000 },
      ],
    },

    // Step 1: Cmd+K でエディタを起動
    {
      actions: [
        { type: 'caption-center', content: t.openEditor },
        { type: 'wait', ms: 1800 },
        { type: 'run', fn: () => { enabledPromise = new Promise<void>(r => { const d = onEnable(() => { d(); r() }) }) }},
        { type: 'key', key: 'k', code: 'KeyK', modifiers: { metaKey: isMac, ctrlKey: !isMac }, highlight: ['cmd', 'k'] },
        { type: 'run', fn: async () => { await enabledPromise }},
        { type: 'wait', ms: 50 },
        { type: 'spotlight-move', target: '.js-panel', pad: 6 },
        { type: 'wait', ms: 1500 },
      ],
    },

    // Step 2: テキストブロックをクリックして編集開始
    {
      actions: [
        { type: 'run', fn: () => {
          const el = document.querySelector(TARGET_TEXT)
          if (!el) return Promise.resolve()
          return smoothScrollTo(
            () => el.scrollIntoView({ behavior: 'smooth', block: 'center' }),
            () => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight },
          )
        }},
        { type: 'spotlight-teleport', target: TARGET_TEXT },
        { type: 'caption', target: TARGET_TEXT, position: 'bottom', content: [t.clickToEdit], instant: true },
        { type: 'wait', ms: 1500 },
        { type: 'run', fn: (ctx) => {
          const el = document.querySelector(TARGET_TEXT) as HTMLElement | null
          if (!el) return
          const spans = el.querySelectorAll('.visual-kerning-char')
          if (spans.length === 0) {
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 0, clientY: 0 }))
            return
          }
          const span = spans[Math.min(2, spans.length - 1)] as HTMLElement
          const rect = span.getBoundingClientRect()
          ctx.showRipple(rect.right, rect.top + rect.height / 2)
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rect.right, clientY: rect.top + rect.height / 2 }))
        }},
        { type: 'wait', ms: 500 },
        { type: 'caption-hide' },
        { type: 'wait', ms: 400 },
      ],
    },

    // Step 3: 文字間をカーニング調整
    {
      actions: [
        { type: 'spotlight-move', target: TARGET_TEXT },
        { type: 'caption', target: TARGET_TEXT, position: 'bottom', content: t.moveAdjust },
        { type: 'wait', ms: 800 },
        { type: 'key', key: 'ArrowLeft', code: 'ArrowLeft', highlight: ['nav-left'] },
        { type: 'wait', ms: 400 },
        { type: 'key', key: 'ArrowRight', code: 'ArrowRight', modifiers: { altKey: true }, repeat: 5, interval: 180, holdKeys: ['adj-mod'], highlight: ['adj-right'] },
        { type: 'wait', ms: 300 },
        { type: 'key', key: 'ArrowLeft', code: 'ArrowLeft', modifiers: { altKey: true }, repeat: 8, interval: 180, holdKeys: ['adj-mod'], highlight: ['adj-left'] },
        { type: 'wait', ms: 400 },
        { type: 'key', key: 'ArrowRight', code: 'ArrowRight', modifiers: { altKey: true }, repeat: 3, interval: 180, holdKeys: ['adj-mod'], highlight: ['adj-right'] },
        { type: 'wait', ms: 800 },
        { type: 'caption-hide' },
        { type: 'wait', ms: 400 },
      ],
    },

    // Step 4: Before/After
    {
      actions: [
        { type: 'spotlight-move', target: '.js-compare', pad: 6 },
        { type: 'highlight', target: '.js-compare' },
        { type: 'caption', target: '.js-compare', position: 'left', content: [
          { strong: t.compareTitle },
          '\n',
          t.compareDesc,
        ]},
        { type: 'wait', ms: 1500 },
        { type: 'click', target: '.js-compare' },
        { type: 'wait', ms: 1500 },
        { type: 'click', target: '.js-compare' },
        { type: 'wait', ms: 800 },
      ],
    },

    // Step 5: Guides
    {
      actions: [
        { type: 'spotlight-transition', duration: '0.15s', easing: 'ease' },
        { type: 'spotlight-move', target: '.js-gaps', pad: 6 },
        { type: 'wait', ms: 150 },
        { type: 'spotlight-transition', duration: '0.4s', easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
        { type: 'highlight', target: '.js-gaps' },
        { type: 'caption', target: '.js-gaps', position: 'left', content: [
          { strong: t.guidesTitle },
          '\n',
          t.guidesDesc,
        ]},
        { type: 'wait', ms: 1500 },
        { type: 'click', target: '.js-gaps' },
        { type: 'wait', ms: 1500 },
        { type: 'click', target: '.js-gaps' },
        { type: 'wait', ms: 800 },
      ],
    },

    // Step 6: Export
    {
      actions: [
        { type: 'spotlight-transition', duration: '0.15s', easing: 'ease' },
        { type: 'spotlight-move', target: '.js-export', pad: 6 },
        { type: 'highlight', target: '.js-export' },
        { type: 'caption', target: '.js-export', position: 'left', content: [
          { strong: t.exportTitle },
          '\n',
          t.exportDesc1,
          '\n',
          t.exportDesc2,
        ]},
        { type: 'wait', ms: 1500 },
        { type: 'run', fn: async () => {
          const el = document.querySelector('.js-export') as HTMLElement | null
          if (el) await animateJsonDownload(el)
        }},
        { type: 'wait', ms: 1000 },
      ],
    },

    // Step 7: Reset
    {
      actions: [
        { type: 'spotlight-transition', duration: '0.15s', easing: 'ease' },
        { type: 'spotlight-move', target: '.js-reset', pad: 6 },
        { type: 'highlight', target: '.js-reset' },
        { type: 'caption', target: '.js-reset', position: 'left', content: [
          { strong: t.resetTitle },
          '\n',
          t.resetDesc,
        ]},
        { type: 'wait', ms: 1500 },
        { type: 'run', fn: () => {
          const originalConfirm = window.confirm
          window.confirm = () => true
          const el = document.querySelector('.js-reset') as HTMLElement
          if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 0, clientY: 0 }))
          window.confirm = originalConfirm
        }},
        { type: 'wait', ms: 1500 },
      ],
    },

    // Step 8: Sandbox へ誘導
    {
      actions: [
        { type: 'caption-hide' },
        { type: 'run', fn: () => {
          const el = document.querySelector('#sandbox')
          if (!el) return Promise.resolve()
          const absTop = el.getBoundingClientRect().top + window.scrollY
          const target = Math.max(0, absTop - 32)
          return smoothScrollTo(
            () => window.scrollTo({ top: target, behavior: 'smooth' }),
            () => Math.abs(window.scrollY - target) < 2,
          )
        }},
        { type: 'spotlight-teleport', target: '#sandbox', pad: 8 },
        { type: 'caption-center', content: t.yourTurn },
        { type: 'wait', ms: 4000 },
      ],
    },
  ]
}
