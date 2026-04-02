import type { CaptionPart } from '../tour'

export interface PlatformInfo {
  isMac: boolean
  altKey: string
}

export interface DemoMessages {
  editorLocale: 'en' | 'ja'
  skipLabel: string
  replayLabel: string
  defaultGoogleFont: string
  preferredLocalFonts: string[]

  loadingBtn: string
  loadedBtn: string
  loadBtn: string
  unavailableBtn: string

  localUnavailable: string
  googleLoadingStatus: string
  googleLoadedStatus: (count: number) => string
  googleFailedStatus: string
  localLoadingStatus: string
  localLoadedStatus: (count: number) => string
  localBlockedStatus: string

  fontStatusMsg: (source: 'google' | 'local', family: string) => string
  localFontsLoadingMsg: string
  loadLocalFirst: string
  localAccessNote: string
  noLocalFonts: string
  typeTextFirst: string
  luckyFontMsg: (font: string) => string
  messyApplied: string
  dropOverlay: string

  tutorialContent: (p: PlatformInfo) => TutorialContent
}

export interface TutorialContent {
  welcome: CaptionPart[]
  openEditor: CaptionPart[]
  clickToEdit: string
  moveAdjust: CaptionPart[]
  compareTitle: string
  compareDesc: string
  guidesTitle: string
  guidesDesc: string
  exportTitle: string
  exportDesc1: string
  exportDesc2: string
  resetTitle: string
  resetDesc: string
  yourTurn: CaptionPart[]
}
