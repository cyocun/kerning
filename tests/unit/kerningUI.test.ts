import { afterEach, describe, expect, it, vi } from 'vitest'
import { createKerningEditor } from '../../src/kerningUI'

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
    vi.restoreAllMocks()
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

    expect(document.querySelector('.typespacing-panel strong')?.textContent).toBe('typespacing')

    const marker = document.querySelector('.typespacing-gap-marker')
    expect(marker).not.toBeNull()

    flushAnimationFrame()

    expect(document.querySelector('.typespacing-gap-marker')).toBe(marker)

    editor.unmount()
  })
})
