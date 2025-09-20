<script setup lang="ts">
import { ref } from 'vue'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AArrowUp,
  AArrowDown,
  PaintBucket,
  Type,
  Eraser,
  Grid3X3,
  Grid2X2X,
  Square,
  SquarePlus,
} from 'lucide-vue-next'
import Dropdown from '../common/Dropdown.vue'
import ToolGroup from '../common/ToolGroup.vue'
import ToolItem from '../common/ToolItem.vue'

// purely UI controls block (no functionality wired)
const fontOptions = [
  { label: '宋体', value: 'SongTi' },
  { label: '微软雅黑', value: 'MiSans' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Inter', value: 'Inter' },
]
const sizeOptions = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28].map((n) => ({
  label: String(n),
  value: n,
}))

// defaults: 字体默认宋体，字号默认 11
const font = ref<string | number>('SongTi')
const size = ref<string | number>(11)

// Fill color state and presets (5 cols x 4 rows)
const fillColor = ref<string>('#4b5563')
const fillPresets = [
  // Row 1 - neutral
  '#ffffff',
  '#f3f4f6',
  '#e5e7eb',
  '#d1d5db',
  '#9ca3af',
  // Row 2 - red
  '#fee2e2',
  '#fecaca',
  '#fca5a5',
  '#f87171',
  '#ef4444',
  // Row 3 - amber/orange
  '#ffedd5',
  '#fed7aa',
  '#fdba74',
  '#f59e0b',
  '#ea580c',
  // Row 4 - green
  '#dcfce7',
  '#bbf7d0',
  '#86efac',
  '#22c55e',
  '#16a34a',
]
const fillPicker = ref<HTMLInputElement | null>(null)
function setFill(c: string) {
  fillColor.value = c
}
function openFillPicker() {
  fillPicker.value?.click()
}
function onFillPicked(e: Event) {
  fillColor.value = (e.target as HTMLInputElement).value
}

// Cell border menu state
const borderStyle = ref<string>('all')
const borderMenu = [
  { label: '无框线', value: 'none', icon: Grid2X2X },
  { label: '所有框线', value: 'all', icon: Grid3X3 },
  { label: '外侧框线', value: 'outside', icon: Square },
  { label: '粗框线', value: 'thick', icon: SquarePlus },
]
</script>

<template>
  <ToolGroup direction="vertical" :gap="2" align="start">
    <ToolGroup direction="horizontal" :gap="2" align="center">
      <ToolGroup :gap="0">
        <Dropdown
          v-model="font"
          class="mr-0"
          :options="fontOptions"
          placeholder="字体"
          :width="160"
          join="left"
        />
        <Dropdown v-model="size" :options="sizeOptions" placeholder="11" :width="72" join="right" />
      </ToolGroup>
      <ToolGroup :gap="6">
        <ToolItem label-position="none" aria-label="字号加"><AArrowUp :size="18" /></ToolItem>
        <ToolItem label-position="none" aria-label="字号减"><AArrowDown :size="18" /></ToolItem>
      </ToolGroup>
    </ToolGroup>
    <ToolGroup :gap="6">
      <ToolItem label-position="none" aria-label="加粗"><Bold :size="18" /></ToolItem>
      <ToolItem label-position="none" aria-label="斜体"><Italic :size="18" /></ToolItem>
      <ToolItem label-position="none" aria-label="下划线"><Underline :size="18" /></ToolItem>
      <ToolItem label-position="none" aria-label="删除线"><Strikethrough :size="18" /></ToolItem>
      <ToolItem
        v-model="borderStyle"
        :menu-items="borderMenu"
        label-position="none"
        aria-label="单元格边框"
      />
      <ToolItem label-position="none" aria-label="填充单元格颜色" :auto-icon="false">
        <PaintBucket :size="18" :color="fillColor" />
        <template #menu="{ close }">
          <div class="color-grid">
            <button
              v-for="c in fillPresets"
              :key="c"
              type="button"
              class="swatch"
              :class="{ selected: c.toLowerCase() === String(fillColor).toLowerCase() }"
              :style="{ background: c }"
              :aria-label="c"
              @click="
                setFill(c)
                close()
              "
            />
          </div>
          <button
            type="button"
            class="other-color-btn"
            @click="
              openFillPicker()
              close()
            "
          >
            其他颜色
          </button>
          <input ref="fillPicker" type="color" class="color-input-hidden" @input="onFillPicked" />
        </template>
      </ToolItem>
      <ToolItem label-position="none" aria-label="填充字体颜色"><Type :size="18" /></ToolItem>
      <ToolItem label-position="none" aria-label="清除"><Eraser :size="18" /></ToolItem>
    </ToolGroup>
  </ToolGroup>
</template>

<style scoped>
.mr-0 {
  margin-right: 0;
}
.color-grid {
  display: grid;
  grid-template-columns: repeat(5, 24px);
  grid-auto-rows: 24px;
  gap: 6px;
  margin-bottom: 6px;
}
.swatch {
  display: inline-block;
  width: 24px;
  height: 24px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  cursor: pointer;
}
.swatch.selected {
  outline: 2px solid #3b82f6;
  outline-offset: 0;
}
.other-color-btn {
  display: inline-flex;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
}
.other-color-btn:hover {
  background: #f1f5ff;
}
.color-input-hidden {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
}
</style>
