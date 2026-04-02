import type { DemoMessages } from './types'

export const en: DemoMessages = {
  editorLocale: 'en',
  skipLabel: 'Skip tour',
  replayLabel: 'Replay tour',
  defaultGoogleFont: 'Inter',
  preferredLocalFonts: ['system-ui'],

  loadingBtn: 'Loading...',
  loadedBtn: 'Loaded',
  loadBtn: 'Load',
  unavailableBtn: 'Unavailable',

  localUnavailable: 'Local font list is available in Chrome/Edge.',
  googleLoadingStatus: 'Loading Google Fonts...',
  googleLoadedStatus: (count) => `Google fonts loaded (${count})`,
  googleFailedStatus: 'Google font list failed to load.',
  localLoadingStatus: 'Loading local fonts...',
  localLoadedStatus: (count) => `Local fonts loaded (${count})`,
  localBlockedStatus: 'Local font access was blocked.',

  fontStatusMsg: (source, family) => `${source === 'google' ? 'Google Fonts' : 'Local Fonts'}: ${family}.`,
  localFontsLoadingMsg: 'Local fonts are loading...',
  loadLocalFirst: 'Load local fonts first (click Load).',
  localAccessNote: 'Local font access is available in Chrome/Edge.',
  noLocalFonts: 'No local fonts available.',
  typeTextFirst: 'Type some text first.',
  luckyFontMsg: (font) => `Lucky font: ${font}.`,
  messyApplied: 'Messy!',
  dropOverlay: 'Drop JSON to import',

  tutorialContent: ({ isMac, altKey }) => ({
    welcome: [
      'Welcome to ', { strong: 'visual kerning' }, '!',
      '\n',
      'Let\'s see how to fine-tune letter spacing in the browser.',
    ],
    openEditor: [
      'Press ', { key: 'cmd', label: isMac ? '\u2318' : 'Ctrl' }, ' + ', { key: 'k', label: 'K' }, ' to open the editor palette.',
    ],
    clickToEdit: 'Clicking a text block to start editing...',
    moveAdjust: [
      'Move ', { key: 'nav-left', label: '\u2190' }, ' ', { key: 'nav-right', label: '\u2192' },
      '   Adjust ', { key: 'adj-mod', label: altKey }, ' + ', { key: 'adj-left', label: '\u2190' }, ' ', { key: 'adj-right', label: '\u2192' },
    ],
    compareTitle: 'Before / After',
    compareDesc: 'Toggle to compare with the original spacing.',
    guidesTitle: 'Guides',
    guidesDesc: 'Show spacing markers between characters.',
    exportTitle: 'Export',
    exportDesc1: 'Copies kerning data as JSON.',
    exportDesc2: 'Apply it with the visual kerning library and you\'re done!',
    resetTitle: 'Reset',
    resetDesc: 'Discard all changes and restore original spacing.',
    yourTurn: [
      'Your turn!',
      '\n',
      'Pick a font, type some text,',
      '\n',
      'and try kerning it yourself.',
    ],
  }),
}
