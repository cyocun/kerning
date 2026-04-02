import { afterEach, describe, expect, it, vi } from 'vitest'
import { createKerningEditor } from '../../src/kerningUI'
import type { KerningExport } from '../../src/applyKerning'

describe('createKerningEditor', () => {
  const rafQueue: FrameRequestCallback[] = []
  let originalRequestAnimationFrame: typeof window.requestAnimationFrame
  let originalCancelAnimationFrame: typeof window.cancelAnimationFrame

  function flushAnimationFrame() {
    const callback = rafQueue.shift()
    if (callback) callback(performance.now())
  }

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame
    window.cancelAnimationFrame = originalCancelAnimationFrame
    vi.useRealTimers()
    vi.restoreAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    document.body.innerHTML = ''
    rafQueue.length = 0
  })

  it('renders the official tool name and keeps marker nodes when state is unchanged', () => {
    originalRequestAnimationFrame = window.requestAnimationFrame
    originalCancelAnimationFrame = window.cancelAnimationFrame
    window.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    window.cancelAnimationFrame = vi.fn()

    const editor = createKerningEditor({ locale: 'en' })
    editor.plugin.enabled.value = true
    editor.plugin.gapMarkers.value = [{ x: 10, y: 20, h: 30, value: 40 }]

    editor.mount()
    flushAnimationFrame()
    flushAnimationFrame()

    expect(document.querySelector('.visual-kerning-panel strong')?.textContent).toBe('visual kerning')

    const marker = document.querySelector('.visual-kerning-gap-marker')
    expect(marker).not.toBeNull()

    flushAnimationFrame()

    expect(document.querySelector('.visual-kerning-gap-marker')).toBe(marker)

    editor.unmount()
  })

  it('restores original HTML after reset when starting from kerning data in editable mode', () => {
    vi.useFakeTimers()
    originalRequestAnimationFrame = window.requestAnimationFrame
    originalCancelAnimationFrame = window.cancelAnimationFrame
    window.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    window.cancelAnimationFrame = vi.fn()

    document.body.innerHTML = '<h1 id="title">Type <em>Spacing</em></h1>'
    const payload: KerningExport = {
      exported: new Date().toISOString(),
      page: '/',
      areas: [{
        selector: '#title',
        text: 'Type Spacing',
        font: { family: 'serif', weight: '700', size: '42px' },
        kerning: new Array('Type Spacing'.length).fill(0),
      }],
    }

    const editor = createKerningEditor({ locale: 'en', kerning: payload })
    editor.mount()
    vi.runAllTimers()
    flushAnimationFrame()

    editor.plugin.resetAll()

    expect(document.querySelector('#title')?.innerHTML).toBe('Type <em>Spacing</em>')

    editor.unmount()
  })

  it('collapses and expands the panel from the toggle button', () => {
    originalRequestAnimationFrame = window.requestAnimationFrame
    originalCancelAnimationFrame = window.cancelAnimationFrame
    window.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    window.cancelAnimationFrame = vi.fn()

    const editor = createKerningEditor({ locale: 'en' })
    editor.plugin.enabled.value = true
    editor.mount()
    flushAnimationFrame()

    const collapseBtn = document.querySelector('.js-collapse') as HTMLButtonElement | null
    const panelBody = document.querySelector('.js-panel-body') as HTMLDivElement | null

    collapseBtn?.click()
    expect(panelBody?.hidden).toBe(true)

    collapseBtn?.click()
    expect(panelBody?.hidden).toBe(false)

    editor.unmount()
  })
})
