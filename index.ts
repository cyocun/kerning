/**
 * kerning — ブラウザ上でカーニングを適用・編集するツールキット
 *
 * - applyKerning: フレームワーク非依存。JSONデータをDOMに適用する。
 * - createKerningPlugin / KerningOverlay: Vue 3 向けのビジュアルエディタ。
 */
export { applyKerning } from './applyKerning'
export type { KerningArea, KerningExport } from './applyKerning'

export { createKerningPlugin } from './kerningEditor'
export type { KerningEditorArea, KerningEditorPlugin } from './kerningEditor'

export { default as KerningOverlay } from './KerningOverlay.vue'
