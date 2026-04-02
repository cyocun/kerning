export type EditorLocale = 'ja' | 'en'

const baseMessages = {
  en: {
    export: 'Export',
    reset: 'Reset',
    compare: 'Before/After',
    copied: 'Downloaded',
    confirmReset: 'Reset all kerning?',
    collapse: 'Collapse palette',
    expand: 'Expand palette',
    guides: 'Guides',
  },
  ja: {
    export: '書き出し',
    reset: 'リセット',
    compare: '比較',
    copied: 'ダウンロードしました',
    confirmReset: 'カーニングをすべてリセットしますか？',
    collapse: 'パレットを折りたたむ',
    expand: 'パレットを展開する',
    guides: 'ガイド',
  },
} as const

export const editorMessages = {
  en: {
    ...baseMessages.en,
    helpText: '⌥⇧ + ←/→ ±1  ⌥ + ←/→ ±10  ⌥⌘ + ←/→ ±100\n⌘ + K toggle  B compare',
    warnSpanTarget: '<span> detected as target. Use a block element (<p>, <div>, <h1>) to avoid nested spans.',
  },
  ja: {
    ...baseMessages.ja,
    helpText: '⌥⇧ + ←/→ ±1  ⌥ + ←/→ ±10  ⌥⌘ + ←/→ ±100\n⌘ + K 切替  B 比較',
    warnSpanTarget: '対象が <span> です。ネストを避けるためブロック要素（<p>, <div>, <h1>）の使用を推奨します。',
  },
} as const
