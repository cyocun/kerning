import type { KerningArea, KerningExport } from './applyKerning'

type FontInfo = KerningArea['font']

export interface PersistedKerningArea {
  text: string
  kerning: number[]
  indent?: number
  font: FontInfo
}

export interface SanitizedPersistedData {
  data: Record<string, PersistedKerningArea>
  droppedSelectors: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isFontInfo(value: unknown): value is FontInfo {
  if (!isRecord(value)) return false
  return typeof value.family === 'string'
    && typeof value.weight === 'string'
    && typeof value.size === 'string'
}

function isKerningArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isFiniteNumber)
}

export function isKerningArea(value: unknown): value is KerningArea {
  if (!isRecord(value)) return false

  return typeof value.selector === 'string'
    && typeof value.text === 'string'
    && isFontInfo(value.font)
    && (value.indent === undefined || isFiniteNumber(value.indent))
    && isKerningArray(value.kerning)
}

export function isKerningExport(value: unknown): value is KerningExport {
  if (!isRecord(value)) return false

  return (value.version === undefined || isFiniteNumber(value.version))
    && typeof value.exported === 'string'
    && typeof value.page === 'string'
    && Array.isArray(value.areas)
    && value.areas.every(isKerningArea)
}

export function assertValidKerningExport(value: unknown): asserts value is KerningExport {
  if (!isKerningExport(value)) {
    throw new TypeError('[typespacing] Invalid kerning export payload.')
  }
}

export function isPersistedKerningArea(value: unknown): value is PersistedKerningArea {
  if (!isRecord(value)) return false

  return typeof value.text === 'string'
    && isKerningArray(value.kerning)
    && (value.indent === undefined || isFiniteNumber(value.indent))
    && isFontInfo(value.font)
}

export function sanitizePersistedKerningData(value: unknown): SanitizedPersistedData | null {
  if (!isRecord(value)) return null

  const data: Record<string, PersistedKerningArea> = {}
  const droppedSelectors: string[] = []

  for (const [selector, area] of Object.entries(value)) {
    if (isPersistedKerningArea(area)) {
      data[selector] = {
        text: area.text,
        kerning: [...area.kerning],
        indent: area.indent,
        font: { ...area.font },
      }
      continue
    }
    droppedSelectors.push(selector)
  }

  return { data, droppedSelectors }
}
