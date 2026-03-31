import { describe, expect, it, vi } from 'vitest'
import {
  applyKerning,
  applyKerningToSpans,
  collectKerningText,
  extractKerningFromWrapped,
  getSingleCharSpans,
  wrapElementWithKerning,
  wrapTextWithKerning,
  type KerningExport,
} from '../../src/applyKerning'

describe('applyKerning helpers', () => {
  it('wrapTextWithKerning splits chars and applies kerning + indent', () => {
    const el = document.createElement('p')
    const { spans, brPositions } = wrapTextWithKerning(el, 'A\nV', [120, -40], { indent: 80, spanClassName: 'x' })

    expect(spans).toHaveLength(2)
    expect(brPositions).toEqual([1])
    expect(spans[0]?.textContent).toBe('A')
    expect(spans[1]?.textContent).toBe('V')
    expect(spans[0]?.style.marginLeft).toBe('0.08em')
    expect(spans[0]?.style.letterSpacing).toBe('0em')
    expect(spans[1]?.style.letterSpacing).toBe('0em')
    expect(spans[1]?.style.marginLeft).toBe('0.12em')
    expect(el.querySelectorAll('br')).toHaveLength(1)
  })

  it('wrapTextWithKerning keeps kerning positions aligned across explicit breaks', () => {
    const el = document.createElement('p')
    const { spans, brPositions } = wrapTextWithKerning(el, 'AB\nCD', [50, 120, -40, 0], {
      indent: 40,
      spanClassName: 'x',
    })

    expect(brPositions).toEqual([2])
    expect(spans[0]?.style.marginLeft).toBe('0.04em')
    expect(spans[1]?.style.marginLeft).toBe('0.05em')
    expect(spans[2]?.style.marginLeft).toBe('0.12em')
    expect(spans[3]?.style.marginLeft).toBe('-0.04em')
  })

  it('getSingleCharSpans returns spans only for single-char span sequences', () => {
    const ok = document.createElement('div')
    ok.append(document.createElement('span'), document.createElement('span'))
    ok.children[0]!.textContent = 'A'
    ok.children[1]!.textContent = 'V'
    expect(getSingleCharSpans(ok)?.length).toBe(2)

    const ng = document.createElement('div')
    ng.textContent = 'AV'
    expect(getSingleCharSpans(ng)).toBeNull()
  })

  it('wrapElementWithKerning preserves inline wrappers for mixed-font titles', () => {
    const el = document.createElement('h1')
    el.innerHTML = 'Type <em>Spacing</em> <span class="accent">Title</span>'

    const text = collectKerningText(el).replace(/\n/g, '')
    const { spans } = wrapElementWithKerning(el, new Array(text.length).fill(0), { spanClassName: 'x' })

    expect(spans).toHaveLength(text.length)
    expect(el.querySelector('em .x')?.textContent).toBe('S')
    expect(el.querySelector('.accent .x')?.textContent).toBe('T')
    expect(el.querySelectorAll(':scope > .x').length).toBeGreaterThan(0)
  })

  it('extractKerningFromWrapped reads existing inline styles', () => {
    const el = document.createElement('div')
    const s1 = document.createElement('span'); s1.textContent = 'A'
    const s2 = document.createElement('span'); s2.textContent = 'V'
    const s3 = document.createElement('span'); s3.textContent = 'X'
    el.append(s1, s2, s3)
    const spans = [s1, s2, s3]
    applyKerningToSpans(spans, [100, -20, 0], 50)

    const extracted = extractKerningFromWrapped(el)
    expect(extracted).not.toBeNull()
    expect(extracted?.text).toBe('AVX')
    expect(extracted?.indent).toBe(50)
    expect(extracted?.kerning[0]).toBe(100)
    expect(extracted?.kerning[1]).toBe(-20)
  })

  it('extractKerningFromWrapped reads calc margin-left values emitted with inherited letter-spacing', () => {
    const el = document.createElement('div')
    el.style.letterSpacing = '1px'
    const s1 = document.createElement('span'); s1.textContent = 'A'
    const s2 = document.createElement('span'); s2.textContent = 'V'
    const s3 = document.createElement('span'); s3.textContent = 'X'
    el.append(s1, s2, s3)

    applyKerningToSpans([s1, s2, s3], [100, -20, 0], 50)

    expect(s2.style.marginLeft).toContain('calc(')
    const extracted = extractKerningFromWrapped(el)

    expect(extracted).not.toBeNull()
    expect(extracted?.indent).toBe(50)
    expect(extracted?.kerning[0]).toBe(100)
    expect(extracted?.kerning[1]).toBe(-20)
  })

  it('extractKerningFromWrapped supports legacy letter-spacing data', () => {
    const el = document.createElement('div')
    el.innerHTML = '<span style="letter-spacing:0.1em">A</span><span style="letter-spacing:-0.02em">V</span>'

    const extracted = extractKerningFromWrapped(el)

    expect(extracted).not.toBeNull()
    expect(extracted?.kerning).toEqual([100, -20])
  })

  it('collectKerningText ignores formatting whitespace but preserves explicit br', () => {
    const el = document.createElement('div')
    el.innerHTML = `
      <p>
        The editor palette is visible on load.
        <br>
        Click any text block.
      </p>
    `

    expect(collectKerningText(el)).toBe('The editor palette is visible on load.\nClick any text block.')
  })

  it('wrapTextWithKerning keeps surrogate-pair characters intact', () => {
    const el = document.createElement('p')
    const { spans } = wrapTextWithKerning(el, '😀A', [90], { spanClassName: 'x' })

    expect(spans).toHaveLength(2)
    expect(spans[0]?.textContent).toBe('😀')
    expect(spans[1]?.textContent).toBe('A')
    expect(spans[1]?.style.marginLeft).toBe('0.09em')
  })

  it('applyKerningToSpans keeps zero kerning as explicit inline style', () => {
    const el = document.createElement('div')
    const s1 = document.createElement('span')
    s1.textContent = 'A'
    s1.style.letterSpacing = '0.1em'
    const s2 = document.createElement('span')
    s2.textContent = 'V'
    s2.style.letterSpacing = '0.1em'
    el.append(s1, s2)
    const spans = [s1, s2]

    applyKerningToSpans(spans, [0, 0], 0)

    expect(spans[0]?.style.letterSpacing).toBe('0em')
    expect(spans[1]?.style.letterSpacing).toBe('0em')
    // marginLeft は 0 のときセットされない
    expect(spans[0]?.style.marginLeft).toBeFalsy()
    expect(spans[1]?.style.marginLeft).toBeFalsy()
  })

  it('applyKerning warns when selector is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const data: KerningExport = {
      exported: new Date().toISOString(),
      page: '/',
      areas: [{
        selector: '.missing',
        text: 'AV',
        font: { family: 'sans', weight: '400', size: '16px' },
        kerning: [0, 0],
      }],
    }
    applyKerning(data, { warnMissing: true })
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('applyKerning warns and normalizes kerning length to visible characters', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const host = document.createElement('div')
    host.innerHTML = '<h1 id="title">A<br>V</h1>'
    document.body.appendChild(host)

    const data: KerningExport = {
      exported: new Date().toISOString(),
      page: '/',
      areas: [{
        selector: '#title',
        text: 'A\nV',
        font: { family: 'sans', weight: '400', size: '16px' },
        kerning: [120],
      }],
    }

    applyKerning(data, { warnMissing: true })

    const spans = document.querySelectorAll('#title span')
    expect(spans).toHaveLength(2)
    expect((spans[1] as HTMLElement).style.marginLeft).toBe('0.12em')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Kerning length mismatch for #title'))
    warn.mockRestore()
  })

  it('applyKerning throws for invalid payloads', () => {
    expect(() => applyKerning({
      exported: new Date().toISOString(),
      page: '/',
      areas: [{
        selector: '#title',
        text: 'AV',
        font: { family: 'sans', weight: '400', size: '16px' },
        kerning: ['120'],
      }],
    } as unknown as KerningExport)).toThrow('[typespacing] Invalid kerning export payload.')
  })
})
