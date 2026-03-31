/**
 * カーニングJSON適用ユーティリティ
 *
 * デザイナーがブラウザ上で調整・書き出したカーニングJSONを
 * エンジニアがDOMに適用するための関数。
 * フレームワーク非依存（Vanilla JS）で動作する。
 *
 * @example
 * import { applyKerning } from 'typespacing'
 * import data from './kerning-export.json'
 * document.addEventListener('DOMContentLoaded', () => applyKerning(data))
 */
interface KerningArea {
    /** 対象要素を特定するCSSセレクタ */
    selector: string;
    /** 元のテキスト内容（検証用） */
    text: string;
    /** フォント情報（参考用） */
    font: {
        family: string;
        weight: string;
        size: string;
    };
    /** 1文字目の左のスペース（1/1000em単位） */
    indent?: number;
    /** 各文字の後ろ側ギャップ量（1/1000em単位）。配列長 = 改行を除く表示文字数 */
    kerning: number[];
}
interface KerningExport {
    /** フォーマットバージョン */
    version?: number;
    /** 書き出し日時（ISO 8601） */
    exported: string;
    /** 対象ページのパス */
    page: string;
    /** カーニング対象テキストエリア一覧 */
    areas: KerningArea[];
}

type EditorLocale = 'ja' | 'en';

/**
 * Kerning Editor — ブラウザ上でペアカーニングを直接調整するツール。
 */

interface ValueBox<T> {
    value: T;
}
interface KerningChangeDetail {
    selector: string;
    kerning: number[];
    indent: number;
}
interface KerningSelectDetail {
    selector: string | null;
    gapIndex: number;
    gapIndexEnd: number | null;
}
interface KerningEditorEventMap {
    enable: undefined;
    disable: undefined;
    change: KerningChangeDetail;
    select: KerningSelectDetail;
    reset: undefined;
}
type EventHandler<T> = (detail: T) => void;
interface KerningEventEmitter {
    on<K extends keyof KerningEditorEventMap>(event: K, handler: EventHandler<KerningEditorEventMap[K]>): () => void;
}
interface CursorRect {
    x: number;
    y: number;
    h: number;
}
interface KerningEditorArea {
    selector: string;
    el: HTMLElement;
    text: string;
    originalHTML: string;
    kerning: number[];
    indent: number;
    font: KerningArea['font'];
    brPositions: number[];
}
interface SelectionRange {
    rects: CursorRect[];
}
interface GapMarker {
    x: number;
    y: number;
    h: number;
    value: number;
}
interface KerningEditorPlugin extends KerningEventEmitter {
    name: string;
    enabled: ValueBox<boolean>;
    compareMode: ValueBox<boolean>;
    showGapMarkers: ValueBox<boolean>;
    mount(): void;
    unmount(): void;
    areas: ValueBox<Map<string, KerningEditorArea>>;
    activeSelector: ValueBox<string | null>;
    cursorGap: ValueBox<number>;
    cursorGapEnd: ValueBox<number | null>;
    cursorRect: ValueBox<CursorRect | null>;
    selectionRange: ValueBox<SelectionRange | null>;
    cursorValue: ValueBox<number>;
    gapMarkers: ValueBox<GapMarker[]>;
    modifiedCount: ValueBox<number>;
    exportJSON(): KerningExport;
    toggleCompareMode(): void;
    resetAll(): void;
}

interface KerningEditorOptions {
    locale?: EditorLocale;
    editable?: boolean;
    kerning?: KerningExport;
}
interface KerningEditor extends KerningEditorPlugin {
    plugin: KerningEditorPlugin;
}
declare function createKerningEditor(options?: KerningEditorOptions): KerningEditor;

export { type KerningArea, type KerningEditor, type KerningEditorOptions, type KerningExport, createKerningEditor };
