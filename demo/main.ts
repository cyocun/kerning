import { visualKerning } from '../src/kerningUI'
import { wrapElementWithKerning } from '../src/applyKerning'
import { ACTIVE_CLASS, CHAR_CLASS, MODIFIED_CLASS, STORAGE_KEY } from '../src/kerningEditor'
import kerningData from './kerning-export.json'
import { createTour } from './tour'
import { buildTutorialSteps, simulateCmdK, TUTORIAL_DONE_KEY } from './tutorial'
import { en } from './locales/en'
import { ja } from './locales/ja'
import type { DemoMessages } from './locales/types'

const lang = document.documentElement.lang
const m: DemoMessages = lang === 'ja' ? ja : en

declare function gtag(command: 'event', action: string, params?: Record<string, string | number>): void

function trackEvent(action: string, label?: string) {
  if (typeof gtag === 'function') {
    gtag('event', action, {
      event_category: 'demo',
      ...(label ? { event_label: label } : {}),
    })
  }
}

type PersistedArea = { text: string; kerning: number[]; indent: number; font: { family: string; weight: string; size: string } }
type SelectOption = { value: string; text: string }
type ChoicesOption = { value: string; label: string; selected?: boolean; disabled?: boolean }
type ChoicesSettings = {
  searchEnabled?: boolean
  shouldSort?: boolean
  shouldSortItems?: boolean
  searchFields?: string[]
  itemSelectText?: string
  allowHTML?: boolean
  searchResultLimit?: number
  renderChoiceLimit?: number
}
type ChoicesInstance = {
  setChoices: (choices: ChoicesOption[], value?: string, label?: string, replaceChoices?: boolean) => void
  setChoiceByValue: (value: string) => void
  clearStore: () => void
}
type ChoicesConstructor = new (el: HTMLSelectElement, settings: ChoicesSettings) => ChoicesInstance

const IMPORTED_KEY = 'visual-kerning-editor-imported'
const Choices = (window as unknown as { Choices?: ChoicesConstructor }).Choices
if (!Choices) {
  throw new Error('Choices.js is not loaded')
}

// 言語切り替え: localStorage に保存
document.querySelectorAll<HTMLAnchorElement>('.lang-toggle a[data-lang]').forEach(link => {
  link.addEventListener('click', () => {
    localStorage.setItem('visual-kerning-demo-lang', link.dataset.lang!)
    trackEvent('lang_switch', link.dataset.lang!)
  })
})

function areasToPersistedMap(areas: typeof kerningData.areas): Record<string, PersistedArea> {
  const persisted: Record<string, PersistedArea> = {}
  for (const area of areas) {
    persisted[area.selector] = {
      text: area.text,
      kerning: [...area.kerning],
      indent: area.indent ?? 0,
      font: area.font,
    }
  }
  return persisted
}

if (localStorage.getItem(IMPORTED_KEY)) {
  localStorage.removeItem(IMPORTED_KEY)
} else {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(areasToPersistedMap(kerningData.areas)))
}

const editor = visualKerning({ locale: m.editorLocale })
editor.mount()

if (localStorage.getItem(TUTORIAL_DONE_KEY)) {
  editor.plugin.enabled.value = true
}

const isMac = navigator.platform.includes('Mac')
const altKey = isMac ? 'Option' : 'Alt'
const tutorialContent = m.tutorialContent({ isMac, altKey })

const tour = createTour({
  doneKey: TUTORIAL_DONE_KEY,
  steps: buildTutorialSteps((handler) => editor.plugin.on('enable', handler), tutorialContent),
  onBeforeReplay: () => simulateCmdK(),
  onDone: () => { editor.plugin.enabled.value = true },
  ignoreAttr: 'data-visual-kerning-ignore',
  skipLabel: m.skipLabel,
  replayLabel: m.replayLabel,
})
tour.start()

let initialState = ''
setTimeout(() => {
  initialState = localStorage.getItem(STORAGE_KEY) ?? ''
}, 0)
window.addEventListener('beforeunload', (e) => {
  if (tour.active) return
  const current = localStorage.getItem(STORAGE_KEY) ?? ''
  if (current !== initialState) {
    e.preventDefault()
  }
})

function exportAndReset() {
  const json = JSON.stringify(editor.plugin.exportJSON(), null, 2)
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(IMPORTED_KEY)
  return json
}

const globals = window as unknown as { __kerningDemo?: typeof editor; exportKerning?: typeof exportAndReset }
globals.__kerningDemo = editor
globals.exportKerning = exportAndReset

// --- Card size sliders ---
document.querySelectorAll('.card-size-slider').forEach(slider => {
  const input = slider.querySelector('input[type="range"]') as HTMLInputElement
  const output = slider.querySelector('output') as HTMLOutputElement
  const target = slider.closest('.card')?.querySelector('[data-sizable]') as HTMLElement | null
  if (!input || !output || !target) return

  input.addEventListener('input', () => {
    output.textContent = `${input.value}px`
    target.style.setProperty('--size', input.value)
  })
})

// --- Sandbox ---

const GOOGLE_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Lato', 'Oswald', 'Raleway',
  'Poppins', 'Playfair Display', 'Merriweather', 'Bebas Neue', 'Space Grotesk',
  'DM Sans', 'DM Serif Display', 'Libre Baskerville', 'Cormorant Garamond',
  'Noto Sans JP', 'Noto Serif JP', 'M PLUS 1p', 'Zen Kaku Gothic New',
  'Zen Old Mincho', 'BIZ UDPGothic', 'BIZ UDPMincho', 'DotGothic16',
  'Source Code Pro', 'JetBrains Mono', 'IBM Plex Sans', 'IBM Plex Serif',
  'Archivo', 'Sora', 'Outfit', 'Barlow', 'Barlow Condensed',
  'Crimson Text', 'Fraunces', 'Bricolage Grotesque',
]
const GOOGLE_FONTS_URL = new URL('./google-fonts.json', import.meta.url).toString()

const DEFAULT_LOCAL_FONTS = [
  'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto',
  'Helvetica', 'Helvetica Neue', 'Arial', 'Noto Sans', 'Noto Sans JP',
  'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Hiragino Mincho ProN',
  'Yu Gothic', 'YuGothic', 'Meiryo', 'MS PGothic', 'MS Mincho',
  'Avenir', 'Avenir Next', 'Avenir Next Condensed', 'Futura', 'Gill Sans',
  'Optima', 'Palatino', 'Hoefler Text', 'Baskerville', 'Didot', 'Georgia',
  'Times', 'Times New Roman', 'American Typewriter', 'Copperplate',
  'Chalkboard', 'Chalkboard SE', 'Chalkduster', 'Marker Felt', 'Noteworthy',
  'Apple SD Gothic Neo', 'AppleGothic', 'Apple Color Emoji',
  'SF Pro Text', 'SF Pro Display', 'SF Pro Rounded', 'SF Mono',
  'Courier', 'Courier New', 'Menlo', 'Monaco', 'Consolas',
]

const loadedFonts = new Set<string>()

function loadGoogleFont(family: string, weight: string) {
  const key = `${family}:${weight}`
  if (loadedFonts.has(key)) return
  loadedFonts.add(key)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`
  document.head.appendChild(link)
}

type QueryLocalFonts = () => Promise<Array<{ family: string; fullName?: string }>>
type FontSource = 'google' | 'local'

function uniqueSorted(list: string[]): string[] {
  return Array.from(new Set(list.filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

function uniqueOptions(options: SelectOption[]): SelectOption[] {
  const map = new Map<string, string>()
  for (const option of options) {
    if (!option.value) continue
    if (!map.has(option.value)) map.set(option.value, option.text || option.value)
  }
  return Array.from(map.entries())
    .map(([value, text]) => ({ value, text }))
    .sort((a, b) => a.text.localeCompare(b.text))
}

const fontGoogleSelect = document.getElementById('sb-font-google') as HTMLSelectElement
const fontLocalSelect = document.getElementById('sb-font-local') as HTMLSelectElement
const googleFontStatus = document.getElementById('sb-font-google-status') as HTMLSpanElement
const googleFontLoadBtn = document.getElementById('sb-font-google-load') as HTMLButtonElement
const localFontStatus = document.getElementById('sb-font-local-status') as HTMLSpanElement
const localFontLoadBtn = document.getElementById('sb-font-local-load') as HTMLButtonElement
const luckyBtn = document.getElementById('sb-lucky') as HTMLButtonElement
const messyBtn = document.getElementById('sb-messy') as HTMLButtonElement
const luckyStatus = document.getElementById('sb-lucky-status') as HTMLSpanElement
const sizeInput = document.getElementById('sb-size') as HTMLInputElement
const weightSelect = document.getElementById('sb-weight') as HTMLSelectElement
const weightRange = document.getElementById('sb-weight-range') as HTMLInputElement
const weightRangeWrap = document.getElementById('sb-weight-range-wrap') as HTMLDivElement
const weightOutput = document.getElementById('sb-weight-output') as HTMLOutputElement
const textInput = document.getElementById('sb-input') as HTMLTextAreaElement
const preview = document.getElementById('sb-preview') as HTMLParagraphElement
const exportBtn = document.getElementById('sb-export') as HTMLButtonElement
const resizeHandle = document.getElementById('sb-resize') as HTMLDivElement
const sandboxBody = document.getElementById('sb-body') as HTMLDivElement

// Font selector
const baseGoogleOptions = GOOGLE_FONTS.map(font => ({ value: font, text: font }))
fontGoogleSelect.append(...baseGoogleOptions.map(option => new Option(option.text, option.value)))
fontGoogleSelect.value = m.defaultGoogleFont

const baseLocalFonts = uniqueSorted(DEFAULT_LOCAL_FONTS)
const baseLocalOptions = baseLocalFonts.map(font => ({ value: font, text: font }))
fontLocalSelect.append(...baseLocalOptions.map(option => new Option(option.text, option.value)))
const defaultLocalFont = m.preferredLocalFonts.find(f => baseLocalFonts.includes(f)) ?? baseLocalFonts[0] ?? ''
if (defaultLocalFont) fontLocalSelect.value = defaultLocalFont

const queryLocalFonts = (window as unknown as { queryLocalFonts?: QueryLocalFonts }).queryLocalFonts
if (!queryLocalFonts) {
  localFontStatus.textContent = m.localUnavailable
  if (localFontLoadBtn) {
    localFontLoadBtn.disabled = true
    localFontLoadBtn.textContent = m.unavailableBtn
  }
}

let googleSelect: ChoicesInstance | null = null
let googleFontsLoaded = false
let googleFontsLoading = false

function syncChoices(instance: ChoicesInstance | null, options: SelectOption[], nextValue: string) {
  if (!instance) return
  const choices = options.map(option => ({
    value: option.value,
    label: option.text,
    selected: option.value === nextValue,
  }))
  instance.setChoices(choices, 'value', 'label', true)
}

function syncGoogleFontOptions(options: SelectOption[]) {
  const nextOptions = uniqueOptions(options)
  const nextValues = nextOptions.map(option => option.value)
  const current = fontGoogleSelect.value
  fontGoogleSelect.replaceChildren(...nextOptions.map(option => new Option(option.text, option.value)))
  const nextValue = nextValues.includes(current) ? current : nextValues[0] ?? ''
  if (nextValue) fontGoogleSelect.value = nextValue
  syncChoices(googleSelect, nextOptions, nextValue)
}

async function ensureGoogleFonts() {
  if (googleFontsLoaded || googleFontsLoading) return
  googleFontsLoading = true
  if (googleFontLoadBtn) {
    googleFontLoadBtn.disabled = true
    googleFontLoadBtn.textContent = m.loadingBtn
  }
  if (googleFontStatus) {
    googleFontStatus.classList.remove('is-error')
    googleFontStatus.textContent = m.googleLoadingStatus
  }
  try {
    const response = await fetch(GOOGLE_FONTS_URL)
    if (!response.ok) throw new Error(`Request failed: ${response.status}`)
    const data = await response.json() as string[] | { familyMetadataList?: Array<{ family: string }> }
    const families = Array.isArray(data)
      ? data.filter(Boolean)
      : data.familyMetadataList?.map(item => item.family).filter(Boolean) ?? []
    if (families.length === 0) return
    const googleOptions = families.map(font => ({ value: font, text: font }))
    syncGoogleFontOptions(googleOptions)
    googleFontsLoaded = true
    if (googleFontStatus) {
      googleFontStatus.textContent = m.googleLoadedStatus(fontGoogleSelect.options.length)
    }
    if (googleFontLoadBtn) {
      googleFontLoadBtn.textContent = m.loadedBtn
    }
  } catch (error) {
    console.warn('[visual-kerning] Failed to load Google Fonts list', error)
    if (googleFontStatus) {
      googleFontStatus.textContent = m.googleFailedStatus
      googleFontStatus.classList.add('is-error')
    }
    if (googleFontLoadBtn) {
      googleFontLoadBtn.disabled = false
      googleFontLoadBtn.textContent = m.loadBtn
    }
  } finally {
    googleFontsLoading = false
  }
}

googleSelect = new Choices(fontGoogleSelect, {
  searchEnabled: true,
  shouldSort: false,
  shouldSortItems: false,
  searchFields: ['label', 'value'],
  itemSelectText: '',
  allowHTML: false,
  searchResultLimit: 500,
  renderChoiceLimit: -1,
})
if (googleFontLoadBtn) {
  googleFontLoadBtn.addEventListener('click', () => {
    trackEvent('font_load', 'google')
    void ensureGoogleFonts()
  })
}

let localSelect: ChoicesInstance | null = null
let localFontsLoaded = false
let localFontsLoading = false

function syncLocalFontOptions(options: SelectOption[]) {
  const nextOptions = uniqueOptions(options)
  const nextValues = nextOptions.map(option => option.value)
  const current = fontLocalSelect.value
  fontLocalSelect.replaceChildren(...nextOptions.map(option => new Option(option.text, option.value)))
  const nextValue = nextValues.includes(current) ? current : nextValues[0] ?? ''
  if (nextValue) fontLocalSelect.value = nextValue
  syncChoices(localSelect, nextOptions, nextValue)
}

async function ensureLocalFonts() {
  if (localFontsLoaded || localFontsLoading || !queryLocalFonts) return
  localFontsLoading = true
  localFontStatus.textContent = m.localLoadingStatus
  if (localFontLoadBtn) {
    localFontLoadBtn.disabled = true
    localFontLoadBtn.textContent = m.loadingBtn
  }
  try {
    const fonts = await queryLocalFonts()
    const localOptions = fonts.map(font => ({
      value: font.family,
      text: font.fullName || font.family,
    }))
    syncLocalFontOptions([...baseLocalOptions, ...localOptions])
    localFontStatus.textContent = m.localLoadedStatus(fontLocalSelect.options.length)
    localFontsLoaded = true
    if (localFontLoadBtn) {
      localFontLoadBtn.textContent = m.loadedBtn
    }
  } catch {
    localFontStatus.textContent = m.localBlockedStatus
    localFontStatus.classList.add('is-error')
    if (localFontLoadBtn) {
      localFontLoadBtn.disabled = false
      localFontLoadBtn.textContent = m.loadBtn
    }
  } finally {
    localFontsLoading = false
  }
}

localSelect = new Choices(fontLocalSelect, {
  searchEnabled: true,
  shouldSort: false,
  shouldSortItems: false,
  searchFields: ['label', 'value'],
  itemSelectText: '',
  allowHTML: false,
  searchResultLimit: 500,
  renderChoiceLimit: -1,
})
if (localFontLoadBtn) {
  localFontLoadBtn.addEventListener('click', () => {
    trackEvent('font_load', 'local')
    void ensureLocalFonts()
  })
}

function preventScrollJump(root: HTMLElement) {
  let lastScrollX = 0
  let lastScrollY = 0
  root.addEventListener('pointerdown', () => {
    lastScrollX = window.scrollX
    lastScrollY = window.scrollY
  })
  root.addEventListener('focusin', () => {
    requestAnimationFrame(() => {
      if (window.scrollX !== lastScrollX || window.scrollY !== lastScrollY) {
        window.scrollTo(lastScrollX, lastScrollY)
      }
    })
  })
}

document.querySelectorAll('.sandbox-header .choices').forEach(el => {
  preventScrollJump(el as HTMLElement)
})

let activeFontSource: FontSource = 'google'
const VARIABLE_FONTS = new Set([
  'Inter',
  'Roboto',
  'Open Sans',
  'Montserrat',
  'Lato',
  'Oswald',
  'Raleway',
  'Poppins',
  'Playfair Display',
  'Merriweather',
  'Space Grotesk',
  'DM Sans',
  'Noto Sans JP',
  'Noto Serif JP',
  'Source Code Pro',
  'JetBrains Mono',
  'IBM Plex Sans',
  'IBM Plex Serif',
  'Archivo',
  'Sora',
  'Outfit',
])

function getSelectedFont(): { family: string; source: FontSource } {
  if (activeFontSource === 'local' && fontLocalSelect.value) {
    return { family: fontLocalSelect.value, source: 'local' }
  }
  return { family: fontGoogleSelect.value, source: 'google' }
}


function isVariableFont(family: string, source: FontSource): boolean {
  return source === 'google' && VARIABLE_FONTS.has(family)
}

function getWeightValue(): string {
  if (weightRangeWrap && !weightRangeWrap.hidden) return weightRange.value
  return weightSelect.value
}

function syncWeightControls(value: string) {
  weightSelect.value = value
  if (weightRange) weightRange.value = value
  if (weightOutput) weightOutput.textContent = value
}

function updateWeightUI() {
  const { family, source } = getSelectedFont()
  const useRange = isVariableFont(family, source)
  if (weightRangeWrap) weightRangeWrap.hidden = !useRange
  weightSelect.hidden = useRange
  syncWeightControls(getWeightValue())
}

function updatePreviewStyle() {
  const { family, source } = getSelectedFont()
  const size = sizeInput.value
  const weight = getWeightValue()
  if (source === 'google') loadGoogleFont(family, weight)
  preview.style.fontFamily = `'${family}', ${source === 'google' ? 'sans-serif' : 'system-ui, sans-serif'}`
  preview.style.fontSize = `${size}px`
  preview.style.fontWeight = weight
  setLuckyStatus(m.fontStatusMsg(source, family))
}

function resetPreviewArea() {
  const areas = editor.plugin.areas.value
  for (const [selector, area] of areas) {
    if (area.el === preview) {
      area.el.classList.remove(ACTIVE_CLASS, MODIFIED_CLASS)
      areas.delete(selector)
      break
    }
  }
}

function updatePreviewText() {
  const text = textInput.value
  resetPreviewArea()
  preview.textContent = text
}

function normalizeFontFamily(name: string): string {
  const safe = name.replace(/"/g, '\\"')
  const needsQuote = /[\s,]/.test(safe)
  return needsQuote ? `"${safe}"` : safe
}

function setLuckyStatus(message: string, isError = false) {
  if (!luckyStatus) return
  luckyStatus.textContent = message
  luckyStatus.classList.toggle('is-error', isError)
  luckyStatus.style.display = message ? 'inline' : 'none'
}

function getLuckyContext(): { fonts: string[]; text: string } | null {
  if (localFontsLoading) {
    setLuckyStatus(m.localFontsLoadingMsg)
    return null
  }
  if (!localFontsLoaded) {
    setLuckyStatus(
      queryLocalFonts ? m.loadLocalFirst : m.localAccessNote,
      true,
    )
    return null
  }
  const fonts = Array.from(fontLocalSelect.options).map(option => option.value).filter(Boolean)
  if (fonts.length === 0) {
    setLuckyStatus(m.noLocalFonts, true)
    return null
  }
  const text = textInput.value
  if (!text) {
    setLuckyStatus(m.typeTextFirst, true)
    return null
  }
  return { fonts, text }
}

function applyLucky() {
  const context = getLuckyContext()
  if (!context) return
  const font = context.fonts[Math.floor(Math.random() * context.fonts.length)]
  activeFontSource = 'local'
  fontLocalSelect.value = font
  localSelect?.setChoiceByValue(font)
  updateWeightUI()
  updatePreviewStyle()
  updatePreviewText()
  setLuckyStatus(m.luckyFontMsg(font))
}

function applyMessy() {
  const context = getLuckyContext()
  if (!context) return
  activeFontSource = 'local'
  updateWeightUI()
  updatePreviewStyle()
  resetPreviewArea()
  const fragment = document.createDocumentFragment()
  for (const char of context.text) {
    const span = document.createElement('span')
    span.textContent = char
    const font = context.fonts[Math.floor(Math.random() * context.fonts.length)]
    span.style.fontFamily = `${normalizeFontFamily(font)}, system-ui, sans-serif`
    fragment.append(span)
  }
  preview.replaceChildren(fragment)
  setLuckyStatus(m.messyApplied)
}

textInput.addEventListener('input', updatePreviewText)
updateWeightUI()
updatePreviewStyle()
fontGoogleSelect.addEventListener('change', () => {
  activeFontSource = 'google'
  updateWeightUI()
  updatePreviewStyle()
})
fontLocalSelect.addEventListener('change', () => {
  activeFontSource = 'local'
  updateWeightUI()
  updatePreviewStyle()
})
sizeInput.addEventListener('input', updatePreviewStyle)
weightSelect.addEventListener('change', () => {
  syncWeightControls(weightSelect.value)
  updatePreviewStyle()
})
if (weightRange) {
  weightRange.addEventListener('input', () => {
    syncWeightControls(weightRange.value)
    updatePreviewStyle()
  })
}
if (luckyBtn) {
  luckyBtn.addEventListener('click', () => {
    trackEvent('lucky')
    applyLucky()
  })
}
if (messyBtn) {
  messyBtn.addEventListener('click', () => {
    trackEvent('messy')
    applyMessy()
  })
}

// Resize handle
let resizing = false
let resizeStartX = 0
let resizeStartW = 0

if (resizeHandle) {
  resizeHandle.addEventListener('pointerdown', (e: PointerEvent) => {
    e.preventDefault()
    resizing = true
    resizeStartX = e.clientX
    resizeStartW = sandboxBody.offsetWidth
    resizeHandle.classList.add('is-dragging')
    resizeHandle.setPointerCapture(e.pointerId)
  })

  resizeHandle.addEventListener('pointermove', (e: PointerEvent) => {
    if (!resizing) return
    const delta = e.clientX - resizeStartX
    const newW = Math.max(200, resizeStartW + delta)
    sandboxBody.style.maxWidth = `${newW}px`
  })

  function stopResize() {
    resizing = false
    resizeHandle.classList.remove('is-dragging')
  }
  resizeHandle.addEventListener('pointerup', stopResize)
  resizeHandle.addEventListener('pointercancel', stopResize)
}

// --- Parse exported HTML for re-import ---
interface ImportedHtmlData {
  text: string
  kerning: number[]
  indent: number
  fontFamily: string
  fontSize: string
  fontWeight: string
  fontSource: FontSource
}

function parseExportedHtml(html: string): ImportedHtmlData | null {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const root = doc.body.firstElementChild as HTMLElement | null
  if (!root) return null

  const style = root.getAttribute('style') || ''
  const familyMatch = style.match(/font-family:\s*'([^']+)'/)
    || style.match(/font-family:\s*"([^"]+)"/)
    || style.match(/font-family:\s*([^,;]+)/)
  const sizeMatch = style.match(/font-size:\s*(\d+)/)
  const weightMatch = style.match(/font-weight:\s*(\d+)/)

  const fontFamily = familyMatch ? familyMatch[1].trim() : ''
  const fontSize = sizeMatch ? sizeMatch[1] : '64'
  const fontWeight = weightMatch ? weightMatch[1] : '400'

  const hasGoogleLink = !!doc.querySelector('link[href*="fonts.googleapis.com"]')
  const fontSource: FontSource = hasGoogleLink ? 'google' : 'local'

  const chars: string[] = []
  const marginValues: number[] = []

  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    const el = child as HTMLElement
    if (el.tagName === 'BR') {
      chars.push('\n')
      continue
    }
    if (el.tagName === 'SPAN') {
      const ml = el.style.marginLeft || el.getAttribute('style')?.match(/margin-left:\s*([^;]+)/)?.[1] || ''
      const emMatch = ml.match(/([-\d.]+)\s*em/)
      chars.push(el.textContent ?? '')
      marginValues.push(emMatch ? Math.round(parseFloat(emMatch[1]) * 1000) : 0)
    }
  }

  if (marginValues.length === 0) return null

  // margin[0] → indent, margin[1..] → kerning, plus trailing 0
  const kerning = [...marginValues.slice(1), 0]
  const text = chars.join('').replace(/\n+$/, '')

  return { text, kerning, indent: marginValues[0], fontFamily, fontSize, fontWeight, fontSource }
}

// --- Apply imported HTML data to sandbox ---
function applyImportedHtml(data: ImportedHtmlData) {
  activeFontSource = data.fontSource
  const isGoogle = data.fontSource === 'google'
  const selectEl = isGoogle ? fontGoogleSelect : fontLocalSelect
  const choicesInst = isGoogle ? googleSelect : localSelect
  const syncFn = isGoogle ? syncGoogleFontOptions : syncLocalFontOptions

  if (!Array.from(selectEl.options).some(o => o.value === data.fontFamily)) {
    const current = Array.from(selectEl.options).map(o => ({ value: o.value, text: o.text }))
    current.push({ value: data.fontFamily, text: data.fontFamily })
    syncFn(current)
  }
  selectEl.value = data.fontFamily
  choicesInst?.setChoiceByValue(data.fontFamily)
  if (isGoogle) loadGoogleFont(data.fontFamily, data.fontWeight)

  sizeInput.value = data.fontSize
  syncWeightControls(data.fontWeight)
  updateWeightUI()
  textInput.value = data.text

  updatePreviewStyle()
  resetPreviewArea()

  preview.textContent = ''
  const lines = data.text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) preview.appendChild(document.createElement('br'))
    if (lines[i]) preview.appendChild(document.createTextNode(lines[i]))
  }

  wrapElementWithKerning(preview, data.kerning, { indent: data.indent, spanClassName: CHAR_CLASS })
  setLuckyStatus(m.htmlImportSuccess)
}

// --- HTML drag & drop on sandbox ---
{
  const sandbox = document.getElementById('sandbox') as HTMLElement
  const overlay = document.createElement('div')
  overlay.textContent = m.htmlDropOverlay
  Object.assign(overlay.style, {
    display: 'none',
    position: 'absolute',
    inset: '0',
    background: 'rgba(255, 255, 255, 0.82)',
    backdropFilter: 'blur(6px)',
    color: '#1a1a1a',
    font: '600 13px/1 system-ui, sans-serif',
    letterSpacing: '0.06em',
    borderRadius: 'inherit',
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
    zIndex: '1',
  })
  sandbox.style.position = 'relative'
  sandbox.appendChild(overlay)

  let dragCount = 0
  sandbox.addEventListener('dragenter', (e) => {
    e.preventDefault()
    dragCount++
    overlay.style.display = 'flex'
  })
  sandbox.addEventListener('dragleave', () => {
    dragCount--
    if (dragCount <= 0) { dragCount = 0; overlay.style.display = 'none' }
  })
  sandbox.addEventListener('dragover', (e) => {
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'copy'
  })
  sandbox.addEventListener('drop', (e) => {
    e.preventDefault()
    dragCount = 0
    overlay.style.display = 'none'
    const file = e.dataTransfer?.files[0]
    if (!file || !(file.name.endsWith('.html') || file.name.endsWith('.htm'))) return
    file.text().then((text) => {
      try {
        const data = parseExportedHtml(text)
        if (!data) {
          setLuckyStatus(m.htmlImportFailed, true)
          return
        }
        applyImportedHtml(data)
      } catch {
        console.warn('[visual-kerning] Failed to parse dropped HTML')
        setLuckyStatus(m.htmlImportFailed, true)
      }
    })
  })
}

// Export HTML
exportBtn.addEventListener('click', () => {
  trackEvent('export_html')
  const clone = preview.cloneNode(true) as HTMLElement
  clone.classList.remove(ACTIVE_CLASS, MODIFIED_CLASS, 'sandbox-preview')
  clone.querySelectorAll('[class]').forEach(el => {
    const classes = Array.from(el.classList).filter(c => !c.startsWith('visual-kerning-'))
    if (classes.length === 0) {
      el.removeAttribute('class')
    } else {
      el.className = classes.join(' ')
    }
  })

  const { family, source } = getSelectedFont()
  const size = sizeInput.value
  const weight = getWeightValue()
  const fallback = source === 'google' ? 'sans-serif' : 'system-ui, sans-serif'
  const style = `font-family:'${family}',${fallback}; font-size:${size}px; font-weight:${weight}; line-height:1.1;`
  clone.setAttribute('style', style + ' ' + (clone.getAttribute('style') || ''))

  clone.querySelectorAll(`span.${CHAR_CLASS}`).forEach(span => {
    span.style.removeProperty('letter-spacing')
    if (!span.getAttribute('style')?.trim()) span.removeAttribute('style')
  })

  const body = clone.outerHTML

  let fontComment = ''
  let fontLink = ''
  if (source === 'google') {
    fontLink = `  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap">\n`
  } else {
    fontComment =
      `  <!--\n` +
      `    ⚠ フォントについて:\n` +
      `    このファイルはお使いのPC内のフォント「${family}」を使っています。\n` +
      `    このフォントが入っていないPCでは、別のフォントで表示されるため\n` +
      `    文字の見た目やカーニングがずれることがあります。\n` +
      `\n` +
      `    Font notice:\n` +
      `    This file uses the local font "${family}".\n` +
      `    On computers without this font, text will fall back to a default font\n` +
      `    and kerning may not appear as intended.\n` +
      `  -->\n`
  }

  const html =
    `<!DOCTYPE html>\n` +
    `<html lang="ja">\n` +
    `<head>\n` +
    `  <meta charset="UTF-8">\n` +
    `  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n` +
    `  <!--\n` +
    `    visual-kerning HTML Export\n` +
    `    https://github.com/cyocun/visual-kerning\n` +
    `\n` +
    `    使い方:\n` +
    `      このファイルをブラウザ（Chrome, Safari 等）で開くだけで\n` +
    `      カーニング調整済みのテキストが表示されます。\n` +
    `      そのままデザイン確認用として共有できます。\n` +
    `\n` +
    `    Webサイトに組み込む場合:\n` +
    `      <body> 〜 </body> の中身をコピーしてお使いください。\n` +
    (source === 'google'
      ? `      また、<head> 内の <link rel="stylesheet" href="https://fonts.googleapis.com/..."> の行も\n` +
        `      コピー先の <head> に追加してください（フォントの読み込みに必要です）。\n` +
        `      <head> を編集できない場合は、<body> 内に貼っても動作します。\n`
      : '') +
    `\n` +
    `    How to use:\n` +
    `      Just open this file in a browser (Chrome, Safari, etc.)\n` +
    `      to see the kerned text. Share it as-is for design review.\n` +
    `\n` +
    `    To embed in your website:\n` +
    `      Copy the contents inside <body> ... </body>.\n` +
    (source === 'google'
      ? `      Also copy the <link rel="stylesheet" href="https://fonts.googleapis.com/..."> line\n` +
        `      into your page's <head> (required to load the font).\n` +
        `      If you can't edit <head>, placing it inside <body> also works.\n`
      : '') +
    `  -->\n` +
    fontLink +
    fontComment +
    `</head>\n` +
    `<body>\n` +
    `${body}\n` +
    `</body>\n` +
    `</html>`

  const blob = new Blob([html], { type: 'text/html' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'visual-kerning-export.html'
  a.click()
  URL.revokeObjectURL(a.href)
})

// --- Install tabs ---
document.querySelectorAll('.install-tab-bar').forEach(bar => {
  const tabs = bar.querySelectorAll<HTMLButtonElement>('.install-tab')
  const container = bar.closest('.install-tabs')!
  const panels = container.querySelectorAll<HTMLPreElement>('.install-panel')

  const section = bar.closest('.for-engineers')
  const usagePkg = section?.querySelector<HTMLElement>('[data-usage="pkg"]')
  const usageCdn = section?.querySelector<HTMLElement>('[data-usage="cdn"]')

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.tab!
      trackEvent('install_tab', id)
      tabs.forEach(t => t.classList.toggle('is-active', t === tab))
      panels.forEach(p => p.classList.toggle('is-active', p.dataset.tab === id))
      if (usagePkg && usageCdn) {
        const isCdn = id === 'cdn'
        usagePkg.hidden = isCdn
        usageCdn.hidden = !isCdn
      }
    })
  })
})

// --- Outbound link tracking ---
document.querySelectorAll<HTMLAnchorElement>('.github-link').forEach(link => {
  link.addEventListener('click', () => trackEvent('click_github'))
})
document.querySelectorAll<HTMLAnchorElement>('.kofi-btn, a[href*="ko-fi.com"]').forEach(link => {
  link.addEventListener('click', () => trackEvent('click_kofi'))
})
document.querySelectorAll<HTMLAnchorElement>('.aside-links a').forEach(link => {
  link.addEventListener('click', () => trackEvent('nav_anchor', link.getAttribute('href') ?? ''))
})
