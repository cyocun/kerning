import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHAR_CLASS, createKerningPlugin, STORAGE_KEY } from '../../src/kerningEditor'

describe('createKerningPlugin persistence', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('normalizes multiline persisted kerning on load', () => {
    vi.useFakeTimers()
    document.body.innerHTML = '<h1 id="title">A<br>V</h1>'
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      '#title': {
        text: 'A\nV',
        kerning: [120],
        indent: 50,
        font: { family: 'sans-serif', weight: '700', size: '42px' },
      },
    }))

    const plugin = createKerningPlugin()
    plugin.mount()
    vi.runAllTimers()

    const area = plugin.areas.value.get('#title')
    expect(area).toBeDefined()
    expect(area?.kerning).toEqual([120, 0])

    const spans = document.querySelectorAll(`#title .${CHAR_CLASS}`)
    expect(spans).toHaveLength(2)
    expect((spans[0] as HTMLElement).style.marginLeft).toBe('0.05em')
    expect((spans[1] as HTMLElement).style.marginLeft).toBe('0.12em')

    plugin.unmount()
  })

  it('drops invalid persisted areas and rewrites storage with valid entries only', () => {
    vi.useFakeTimers()
    document.body.innerHTML = '<h1 id="title">AV</h1>'
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      '#title': {
        text: 'AV',
        kerning: [120, 0],
        font: { family: 'sans-serif', weight: '700', size: '42px' },
      },
      '#broken': {
        text: 123,
        kerning: [0],
        font: { family: 'sans-serif', weight: '700', size: '42px' },
      },
    }))

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const plugin = createKerningPlugin()
    plugin.mount()
    vi.runAllTimers()

    expect(plugin.areas.value.has('#title')).toBe(true)
    expect(plugin.areas.value.has('#broken')).toBe(false)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Ignoring invalid stored areas'))
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      '#title': {
        text: 'AV',
        kerning: [120, 0],
        font: { family: 'sans-serif', weight: '700', size: '42px' },
      },
    })

    plugin.unmount()
  })
})
