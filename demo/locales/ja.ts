import type { DemoMessages } from './types'

export const ja: DemoMessages = {
  editorLocale: 'ja',
  skipLabel: 'ツアーをスキップ',
  replayLabel: 'ツアーを再生',
  defaultGoogleFont: 'Noto Sans JP',
  preferredLocalFonts: ['Hiragino Sans', 'system-ui'],

  loadingBtn: 'Loading...',
  loadedBtn: '読込済',
  loadBtn: '読み込む',
  unavailableBtn: '利用不可',

  localUnavailable: 'ローカルフォント一覧はChrome/Edgeで利用できます。',
  googleLoadingStatus: 'Google Fontsを読み込み中...',
  googleLoadedStatus: (count) => `Google Fonts読み込み完了（${count}件）`,
  googleFailedStatus: 'Google Fontsの読み込みに失敗しました。',
  localLoadingStatus: 'ローカルフォントを読み込み中...',
  localLoadedStatus: (count) => `ローカルフォント読み込み完了（${count}件）`,
  localBlockedStatus: 'ローカルフォントへのアクセスがブロックされました。',

  fontStatusMsg: (source, family) => `${source === 'google' ? 'Google Fonts' : 'ローカルフォント'}: ${family}`,
  localFontsLoadingMsg: 'ローカルフォントを読み込み中...',
  loadLocalFirst: 'まずローカルフォントを読み込んでください（「読み込む」をクリック）。',
  localAccessNote: 'ローカルフォントへのアクセスはChrome/Edgeで利用できます。',
  noLocalFonts: 'ローカルフォントがありません。',
  typeTextFirst: 'まずテキストを入力してください。',
  luckyFontMsg: (font) => `Luckyフォント: ${font}`,
  messyApplied: 'Messy！',
  dropOverlay: 'JSONをドロップしてインポート',

  tutorialContent: ({ isMac, altKey }) => ({
    welcome: [
      { strong: 'visual kerning' }, ' へようこそ！',
      '\n',
      'ブラウザ上で文字間を微調整する方法を',
      '\n',
      '見ていきましょう。',
    ],
    openEditor: [
      { key: 'cmd', label: isMac ? '\u2318' : 'Ctrl' }, ' + ', { key: 'k', label: 'K' }, ' でエディタパレットを開きます。',
    ],
    clickToEdit: 'テキストをクリックして編集を開始',
    moveAdjust: [
      '移動  ', { key: 'nav-left', label: '\u2190' }, ' ', { key: 'nav-right', label: '\u2192' },
      '   調整  ', { key: 'adj-mod', label: altKey }, ' + ', { key: 'adj-left', label: '\u2190' }, ' ', { key: 'adj-right', label: '\u2192' },
    ],
    compareTitle: '比較',
    compareDesc: '元の文字間と比較できます。',
    guidesTitle: 'ガイド',
    guidesDesc: '文字間のスペーシングマーカーを表示します。',
    exportTitle: '書き出し',
    exportDesc1: 'カーニングデータを\nJSONとしてコピーします。',
    exportDesc2: 'visual kerningライブラリで\n適用すれば完了です！',
    resetTitle: 'リセット',
    resetDesc: 'すべての変更を破棄して\n元の文字間に戻します。',
    yourTurn: [
      'さあ、あなたの番です！',
      '\n',
      'フォントを選んでテキストを入力し、',
      '\n',
      'カーニングを試してみましょう。',
    ],
  }),
}
