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

  it('applyKerningToSpans copies margin-left to inline wrapper parent', () => {
    const el = document.createElement('div')
    const em = document.createElement('em')
    const span = document.createElement('span'); span.textContent = 'A'
    em.appendChild(span)
    const s2 = document.createElement('span'); s2.textContent = 'V'
    el.append(em, s2)

    applyKerningToSpans([span, s2], [100, 0], 50)

    // span自体にmargin-leftがセットされる
    expect(span.style.marginLeft).toBe('0.05em')
    // 唯一の子なのでemラッパーにもコピーされる
    expect(em.style.marginLeft).toBe('0.05em')
    // s2は直接の子なのでラッパーコピーなし
    expect(s2.style.marginLeft).toBe('0.1em')
  })

  it('applyKerningToSpans does not copy margin to wrapper with multiple children', () => {
    const el = document.createElement('div')
    const strong = document.createElement('strong')
    const s1 = document.createElement('span'); s1.textContent = 'A'
    const s2 = document.createElement('span'); s2.textContent = 'B'
    strong.append(s1, s2)
    el.appendChild(strong)

    applyKerningToSpans([s1, s2], [100, 0], 50)

    // strongは複数の子を持つのでコピーしない
    expect(strong.style.marginLeft).toBeFalsy()
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

  it('accessible option adds visually-hidden text and aria-hidden wrapper', () => {
    const el = document.createElement('h1')
    el.textContent = 'HELLO'
    wrapTextWithKerning(el, 'HELLO', [0, 0, 0, 0], { accessible: true })

    const srOnly = el.querySelector('.visual-kerning-sr-only') as HTMLElement
    expect(srOnly).not.toBeNull()
    expect(srOnly.textContent).toBe('HELLO')

    const ariaHidden = el.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(ariaHidden).not.toBeNull()
    expect(ariaHidden.querySelectorAll('span')).toHaveLength(5)
  })

  it('accessible option works with wrapElementWithKerning preserving inline markup', () => {
    const el = document.createElement('h1')
    const em = document.createElement('em')
    em.textContent = 'E'
    el.append('H', em, 'LLO')
    wrapElementWithKerning(el, [0, 0, 0, 0], { accessible: true })

    const srOnly = el.querySelector('.visual-kerning-sr-only') as HTMLElement
    expect(srOnly).not.toBeNull()
    expect(srOnly.textContent).toBe('HELLO')

    const ariaHidden = el.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(ariaHidden).not.toBeNull()
    expect(ariaHidden.querySelector('em')).not.toBeNull()
  })

  it('accessible option defaults to false (no extra DOM)', () => {
    const el = document.createElement('p')
    wrapTextWithKerning(el, 'AB', [0], {})

    expect(el.querySelector('.visual-kerning-sr-only')).toBeNull()
    expect(el.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  it('applyKerning passes accessible option to wrapElementWithKerning', () => {
    const host = document.createElement('div')
    const p = document.createElement('p')
    p.id = 'a11y-test'
    p.textContent = 'Hello'
    host.appendChild(p)
    document.body.appendChild(host)

    const data: KerningExport = {
      exported: new Date().toISOString(),
      page: '/',
      areas: [{
        selector: '#a11y-test',
        text: 'Hello',
        font: { family: 'sans', weight: '400', size: '16px' },
        kerning: [0, 0, 0, 0],
      }],
    }
    applyKerning(data, { accessible: true })

    const target = document.querySelector('#a11y-test') as HTMLElement
    expect(target.querySelector('.visual-kerning-sr-only')).not.toBeNull()
    expect(target.querySelector('[aria-hidden="true"]')).not.toBeNull()
    host.remove()
  })

  it('applyKerning with accessible is idempotent on double call', () => {
    const host = document.createElement('div')
    const p = document.createElement('p')
    p.id = 'idempotent-test'
    p.textContent = 'Hello'
    host.appendChild(p)
    document.body.appendChild(host)

    const data: KerningExport = {
      exported: new Date().toISOString(),
      page: '/',
      areas: [{
        selector: '#idempotent-test',
        text: 'Hello',
        font: { family: 'sans', weight: '400', size: '16px' },
        kerning: [0, 0, 0, 0],
      }],
    }
    applyKerning(data, { accessible: true })
    applyKerning(data, { accessible: true })

    const target = document.querySelector('#idempotent-test') as HTMLElement
    expect(target.querySelectorAll('.visual-kerning-sr-only')).toHaveLength(1)
    expect(target.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1)
    host.remove()
  })

  it('accessible works on already-span-wrapped elements', () => {
    const host = document.createElement('div')
    const p = document.createElement('p')
    p.id = 'prewrapped-test'
    // 手動でspan化済みの状態を作る
    for (const ch of 'Hi') {
      const span = document.createElement('span')
      span.textContent = ch
      p.appendChild(span)
    }
    host.appendChild(p)
    document.body.appendChild(host)

    const data: KerningExport = {
      exported: new Date().toISOString(),
      page: '/',
      areas: [{
        selector: '#prewrapped-test',
        text: 'Hi',
        font: { family: 'sans', weight: '400', size: '16px' },
        kerning: [50],
      }],
    }
    applyKerning(data, { accessible: true })

    const target = document.querySelector('#prewrapped-test') as HTMLElement
    expect(target.querySelector('.visual-kerning-sr-only')).not.toBeNull()
    expect(target.querySelector('[aria-hidden="true"]')).not.toBeNull()
    host.remove()
  })

  it('accessible normalizes newlines to spaces in SR text', () => {
    const el = document.createElement('h1')
    wrapTextWithKerning(el, 'A\nV', [0], { accessible: true })

    const srOnly = el.querySelector('.visual-kerning-sr-only') as HTMLElement
    expect(srOnly).not.toBeNull()
    expect(srOnly.textContent).toBe('A V')
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
    } as unknown as KerningExport)).toThrow('[visual-kerning] Invalid kerning export payload.')
  })
})
