/**
 * visual-kerning — Webの文字組みを、もっと直感的に。
 */
export { createKerningEditor } from './kerningUI'
export type { KerningEditor, KerningEditorOptions } from './kerningUI'
export type { KerningExport } from './applyKerning'
export {
  CHAR_CLASS,
  SR_ONLY_CLASS,
  VISUAL_CLASS,
  ACTIVE_CLASS,
  MODIFIED_CLASS,
} from './applyKerning'
