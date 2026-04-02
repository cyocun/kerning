import { describe, expect, it } from 'vitest'
import * as api from '../../src/index'

describe('public API surface', () => {
  it('exposes the editor entry point and CSS class constants', () => {
    expect(Object.keys(api).sort()).toEqual([
      'ACTIVE_CLASS',
      'CHAR_CLASS',
      'MODIFIED_CLASS',
      'SR_ONLY_CLASS',
      'VISUAL_CLASS',
      'visualKerning',
    ])
  })
})
