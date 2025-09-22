<script setup lang="ts">
import { SheetToolbar } from '../index'
import { FunctionSquare } from 'lucide-vue-next'

// UI-only layout for the control area above the sheet
// Props:
// - modelValue: the formula text (two-way bound from app)
// - disabled: whether input should be disabled (e.g., no selection)
// Emits:
// - update:modelValue on input typing
// - submit when user presses Enter in the input
const props = defineProps<{
  modelValue: string
  disabled?: boolean
  placeholder?: string
  selectionText?: string
  // Toolbar echo of active cell style
  fontFamily?: string | number
  fontSize?: string | number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'submit'): void
  (e: 'merge-cells'): void
  (e: 'unmerge-cells'): void
  (e: 'apply-fill', color: string): void
  (e: 'apply-border', payload: { mode: 'none' | 'all' | 'outside' | 'thick'; color?: string }): void
  (e: 'apply-font-family', family: string): void
  (e: 'apply-font-size', size: number): void
  (e: 'toggle-bold', enabled: boolean): void
  (e: 'toggle-italic', enabled: boolean): void
  (e: 'toggle-underline', enabled: boolean): void
  (e: 'toggle-strikethrough', enabled: boolean): void
}>()

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
function onEnter() {
  emit('submit')
}
</script>

<template>
  <div class="control-container">
    <div class="toolbar-wrap">
      <SheetToolbar
        :font-family="props.fontFamily"
        :font-size="props.fontSize"
        :bold="props.bold"
        :italic="props.italic"
        :underline="props.underline"
        :strikethrough="props.strikethrough"
        @merge-cells="() => emit('merge-cells')"
        @unmerge-cells="() => emit('unmerge-cells')"
        @apply-fill="(c) => emit('apply-fill', c)"
        @apply-border="(p) => emit('apply-border', p)"
        @apply-font-family="(f) => emit('apply-font-family', f)"
        @apply-font-size="(s) => emit('apply-font-size', s)"
        @toggle-bold="(v) => emit('toggle-bold', v)"
        @toggle-italic="(v) => emit('toggle-italic', v)"
        @toggle-underline="(v) => emit('toggle-underline', v)"
        @toggle-strikethrough="(v) => emit('toggle-strikethrough', v)"
      />
    </div>
    <div class="controls-row">
      <div class="range-card" :title="selectionText || ''">
        <span class="range-text">{{ selectionText || '—' }}</span>
      </div>
      <div class="formula-card">
        <div class="formula-left" aria-label="formula">
          <FunctionSquare :size="16" />
        </div>
        <div class="vsep" aria-hidden="true"></div>
        <input
          class="formula-input"
          :value="modelValue"
          :disabled="disabled"
          :placeholder="placeholder ?? 'Formula Bar'"
          @input="onInput"
          @keydown.enter.prevent="onEnter"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.control-container {
  padding: 10px;
  background: #f9fafb;
}
.toolbar-wrap {
  margin-bottom: 8px;
}
.controls-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.range-card {
  min-width: 120px;
  max-width: 220px;
  height: 36px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}
.range-text {
  font-size: 13px;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.formula-card {
  flex: 1;
  height: 36px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}
.formula-left {
  width: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #4b5563;
}
.vsep {
  width: 1px;
  height: 18px;
  background: #e5e7eb;
}
.formula-input {
  flex: 1;
  height: 26px;
  padding: 4px 8px;
  border: 0;
  background: transparent;
  outline: none;
  color: #111827;
}
.formula-card:focus-within {
  border-color: #93c5fd;
  box-shadow: 0 0 0 2px rgba(147, 197, 253, 0.25);
}
</style>
