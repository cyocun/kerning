<!--
  KerningOverlay — カーニング編集モードのUI
  - 文字間カーソル（ブリンク）
  - カーニング値ツールチップ
  - パネル（書き出し / リセット / ヘルプ）
-->
<template>
  <div class="kern-edit-overlay">

    <!-- カーソル -->
    <div
      v-if="cursor"
      class="cursor-wrap"
      :style="{
        left: `${cursor.x}px`,
        top: `${cursor.y}px`,
        height: `${cursor.h}px`,
      }"
    >
      <div class="cursor-line" />
      <span class="value">
        {{ value > 0 ? `+${value}` : value }}
      </span>
    </div>

    <!-- パネル（ヘルプはパネル上部にインライン展開） -->
    <div class="panel">

      <!-- ヘルプ（パネル上部にスライド表示） -->
      <Transition name="help">
        <div v-if="showHelp" class="help">
          <dl class="help-list">
            <dt>{{ t.helpClickDt }}</dt>
            <dd>{{ t.helpClickDd }}</dd>
            <dt>⌥ ← / →</dt>
            <dd>{{ t.helpAltArrow }}</dd>
            <dt>⌥⌘ ← / →</dt>
            <dd>{{ t.helpAltCmdArrow }}</dd>
            <dt>Tab / Shift+Tab</dt>
            <dd>{{ t.helpTab }}</dd>
            <dt>Esc</dt>
            <dd>{{ t.helpEsc }}</dd>
            <dt>⌘K</dt>
            <dd>{{ t.helpToggle }}</dd>
          </dl>
          <div class="help-divider" />
          <p class="help-note" v-html="t.helpNote" />
        </div>
      </Transition>

      <!-- メイン部分 -->
      <div class="panel-main">
        <div class="panel-row">
          <span class="label">{{ t.title }}</span>
          <div class="panel-right">
            <span class="modified" v-if="modifiedCount > 0">{{ modifiedCount }} {{ t.modified }}</span>
            <button class="help-btn" @click.stop="showHelp = !showHelp">?</button>
          </div>
        </div>
        <div class="panel-row actions">
          <button class="btn" @click="onExport" :disabled="modifiedCount === 0">{{ t.export }}</button>
          <button class="btn btn-reset" @click="onReset" :disabled="modifiedCount === 0">{{ t.reset }}</button>
        </div>
        <Transition name="fade">
          <span v-if="copied" class="toast">{{ t.copied }}</span>
        </Transition>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const messages = {
  en: {
    title: 'Kerning',
    modified: 'modified',
    export: 'Export',
    reset: 'Reset',
    copied: 'Downloaded',
    confirmReset: 'Reset all kerning?',
    helpClickDt: 'Click text',
    helpClickDd: 'Select a text element to kern',
    helpAltArrow: 'Adjust ±10 (1/1000 em)',
    helpAltCmdArrow: 'Adjust ±100',
    helpTab: 'Move cursor to next / prev gap',
    helpEsc: 'Deselect',
    helpToggle: 'Toggle kerning mode',
    helpNote: 'Export copies kerning data as JSON.<br>Apply with <code>applyKerning(json)</code>',
  },
  ja: {
    title: 'カーニング',
    modified: '件変更',
    export: '書き出し',
    reset: 'リセット',
    copied: 'ダウンロードしました',
    confirmReset: 'カーニングをすべてリセットしますか？',
    helpClickDt: 'テキストをクリック',
    helpClickDd: 'カーニング対象を選択',
    helpAltArrow: '±10 調整（1/1000 em）',
    helpAltCmdArrow: '±100 調整',
    helpTab: '前後のギャップに移動',
    helpEsc: '選択解除',
    helpToggle: 'カーニングモード切替',
    helpNote: 'カーニングデータをJSONで書き出します。<br><code>applyKerning(json)</code> で適用できます。',
  },
} as const

const props = defineProps<{
  cursor: { x: number; y: number; h: number } | null
  value: number
  modifiedCount: number
  /** UI言語（default: 'ja'） */
  locale?: keyof typeof messages
}>()

const emit = defineEmits<{
  export: []
  reset: []
}>()

const t = computed(() => messages[props.locale ?? 'ja'])

const copied = ref(false)
const showHelp = ref(true)
let helpReady = false

function dismissHelp() {
  if (helpReady && showHelp.value) showHelp.value = false
}

onMounted(() => {
  document.body.classList.add('kern-edit-on')
  // Cmd+K の keydown が即 dismiss しないよう、次のイベントループまで待つ
  requestAnimationFrame(() => {
    helpReady = true
  })
  window.addEventListener('click', dismissHelp)
  window.addEventListener('keydown', dismissHelp)
})

onUnmounted(() => {
  document.body.classList.remove('kern-edit-on')
  helpReady = false
  window.removeEventListener('click', dismissHelp)
  window.removeEventListener('keydown', dismissHelp)
})

function onExport() {
  emit('export')
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}

function onReset() {
  if (confirm(t.value.confirmReset)) emit('reset')
}
</script>

<style scoped>
/* --- カーソル --- */
.cursor-wrap {
  position: fixed;
  z-index: 100000;
  pointer-events: none;
  transform: translateX(-0.5px);
}

.cursor-line {
  width: 2px;
  height: 100%;
  background: #fff;
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  50% { opacity: 0; }
}

.value {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  font-family: "akzidenz-grotesk-next-pro", sans-serif;
  font-weight: 500;
  font-size: 16px;
  line-height: 1;
  color: #fff;
  white-space: nowrap;
  letter-spacing: -0.02em;
  background: #000;
  padding: 4px 7px;
  border-radius: 4px;
}
.value::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: #000;
}

/* --- パネル --- */
.panel {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 100001;
  min-width: 280px;
  border-radius: 8px;
  overflow: hidden;
  background: #222;
  font-family: "akzidenz-grotesk-next-pro", sans-serif;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
  letter-spacing: -0.02em;
  line-height: 1.4;
  user-select: none;
}

.panel-main {
  padding: 14px 18px;
}

.panel-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.panel-row + .panel-row { margin-top: 12px; }

.panel-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.label {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
}

.modified {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  font-variant-numeric: tabular-nums;
}

.help-btn {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 50%;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-family: inherit;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.help-btn:hover {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.6);
}

.actions { gap: 8px; }

.btn {
  flex: 1;
  padding: 7px 0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 5px;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.btn:hover:not(:disabled) {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.5);
}
.btn:disabled {
  opacity: 0.2;
  cursor: default;
}
.btn-active {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.5);
}
.btn-reset:hover:not(:disabled) {
  color: #ff4d4d;
  border-color: rgba(255, 77, 77, 0.5);
}

.toast {
  display: block;
  margin-top: 10px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.fade-enter-active { transition: opacity 0.15s; }
.fade-leave-active { transition: opacity 0.3s 1s; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }

/* --- ヘルプ（パネル上部） --- */
.help {
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 13px;
}

.help-list {
  margin: 0;
  padding: 0;
}
.help-list dt {
  font-size: 12px;
  font-weight: 500;
  color: #fff;
  margin-top: 8px;
}
.help-list dt:first-child { margin-top: 0; }
.help-list dd {
  margin: 2px 0 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.help-divider {
  height: 1px;
  margin: 12px 0;
  background: rgba(255, 255, 255, 0.08);
}

.help-note {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.5;
}
.help-note code {
  font-family: 'SF Mono', 'Menlo', monospace;
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
}

.help-enter-active,
.help-leave-active {
  transition: max-height 0.2s ease, opacity 0.2s ease;
  overflow: hidden;
}
.help-enter-from,
.help-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}
.help-enter-to,
.help-leave-from {
  max-height: 400px;
  opacity: 1;
}
</style>

<style>
/* グローバル */
.kern-edit-char { display: inline; }
.kern-edit-active {
  outline: 1px dashed rgba(255, 255, 255, 0.25);
  outline-offset: 3px;
}
.kern-edit-on .kern-edit-modified {
  outline: 1px solid rgba(255, 255, 255, 0.12);
  outline-offset: 3px;
}
.kern-edit-on .kern-edit-active.kern-edit-modified {
  outline-color: rgba(255, 255, 255, 0.25);
  outline-style: dashed;
}
</style>
