import { describe, expect, it } from 'vitest'
import { applyKerning, wrapTextWithKerning, type KerningExport } from '../../src/applyKerning'
import { CHAR_CLASS } from '../../src/kerningEditor'

describe('smoke: core flows', () => {
  it('wraps text and applies kerning without throwing', () => {
    const el = document.createElement('p')
    expect(() => wrapTextWithKerning(el, 'AV', [120, 0], { indent: 80, spanClassName: CHAR_CLASS })).not.toThrow()
    expect(el.querySelectorAll(`.${CHAR_CLASS}`)).toHaveLength(2)
  })

  it('applyKerning applies exported payload to target element', () => {
    const host = document.createElement('div')
    host.innerHTML = '<h1 id="title">AVATAR</h1>'
    document.body.appendChild(host)

    const payload: KerningExport = {
      exported: new Date().toISOString(),
      page: '/',
      areas: [{
        selector: '#title',
        text: 'AVATAR',
        font: { family: 'sans-serif', weight: '700', size: '42px' },
        kerning: [120, 0, 0, 0, 0, 0],
        indent: 60,
      }],
    }

    expect(() => applyKerning(payload)).not.toThrow()
    const first = document.querySelector('#title span') as HTMLElement | null
    expect(first).not.toBeNull()
    if (first) {
      expect(first.style.marginLeft).toBe('0.06em')
      expect(first.style.letterSpacing).toBe('0em')
      const second = document.querySelectorAll('#title span')[1] as HTMLElement | null
      expect(second?.style.marginLeft).toBe('0.12em')
    }
  })

  it('applyKerning preserves inline wrappers in mixed-font titles', () => {
    const host = document.createElement('div')
    host.innerHTML = '<h1 id="mixed">Type <em>Spacing</em></h1>'
    document.body.appendChild(host)

    const payload: KerningExport = {
      exported: new Date().toISOString(),
      page: '/',
      areas: [{
        selector: '#mixed',
        text: 'Type Spacing',
        font: { family: 'serif', weight: '700', size: '42px' },
        kerning: new Array('Type Spacing'.length).fill(0),
      }],
    }

    expect(() => applyKerning(payload)).not.toThrow()
    expect(document.querySelector('#mixed em span')?.textContent).toBe('S')
  })
})
