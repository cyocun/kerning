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
    helpText: 'Click text, use Alt + ←/→ to adjust. Drag the header to move the palette, and use − / + to collapse or expand it.',
    warnSpanTarget: '<span> detected as target. Use a block element (<p>, <div>, <h1>) to avoid nested spans.',
  },
  ja: {
    ...baseMessages.ja,
    helpText: 'テキストをクリックし、Alt + ←/→ で調整。ヘッダーはドラッグで移動、− / + で折りたたみ・展開できます。',
    warnSpanTarget: '対象が <span> です。ネストを避けるためブロック要素（<p>, <div>, <h1>）の使用を推奨します。',
  },
} as const
