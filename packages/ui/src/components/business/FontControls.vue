<script setup lang="ts">
import { ref, watch } from 'vue'
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
import IconWithSwatch from '../common/IconWithSwatch.vue'
import ColorGridMenu from '../business/color/ColorGridMenu.vue'
import ColorPickerModal from '../business/color/ColorPickerModal.vue'

// Emit actions upward so app can wire to Sheet API
const emit = defineEmits<{
  (e: 'apply-fill', color: string): void
  (e: 'apply-border', payload: {
    mode: 'none' | 'all' | 'outside' | 'thick'
    color?: string
  }): void
  (e: 'apply-font-family', family: string): void
  (e: 'apply-font-size', size: number): void
  (e: 'toggle-bold', enabled: boolean): void
  (e: 'toggle-italic', enabled: boolean): void
  (e: 'toggle-underline', enabled: boolean): void
  (e: 'toggle-strikethrough', enabled: boolean): void
}>()

// purely UI controls block (no functionality wired)
const fontOptions = [
  { label: '宋体', value: 'SongTi' },
  { label: '微软雅黑', value: 'MiSans' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Inter', value: 'Inter' },
]
// Provide full range [6..72] so current value is always in options; avoids placeholder flicker
const sizeOptions = Array.from({ length: MAX_SIZE - MIN_SIZE + 1 }, (_, i) => MIN_SIZE + i).map(
  (n) => ({ label: String(n), value: n }),
)

// Controlled props from parent (toolbar echo of active cell)
const props = defineProps<{
  fontFamily?: string | number
  fontSize?: string | number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
}>()

// limits for font size
const MIN_SIZE = 6
const MAX_SIZE = 72
const normSize = (v: unknown): number => {
  const n = Number(v)
  if (!Number.isFinite(n)) return 14
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(n)))
}

// local states (two-way in this control, but driven by props when provided)
const font = ref<string | number>(props.fontFamily ?? 'SongTi')
const size = ref<number>(normSize(props.fontSize))
const bold = ref(!!props.bold)
const italic = ref(!!props.italic)
const underline = ref(!!props.underline)
const strike = ref(!!props.strikethrough)

// keep in sync when parent updates
watch(
  () => [props.fontFamily, props.fontSize, props.bold, props.italic, props.underline, props.strikethrough],
  ([ff, fs, b, i, u, s]) => {
    if (ff !== undefined) font.value = ff
    if (fs !== undefined) size.value = normSize(fs)
    if (b !== undefined) bold.value = !!b
    if (i !== undefined) italic.value = !!i
    if (u !== undefined) underline.value = !!u
    if (s !== undefined) strike.value = !!s
  },
)
function emitFont() {
  if (typeof font.value === 'string') emit('apply-font-family', font.value)
  size.value = normSize(size.value)
  emit('apply-font-size', size.value)
}

// Fill color state and presets (5 cols x 5 rows)
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
  // Row 5 - blue
  '#dbeafe',
  '#bfdbfe',
  '#93c5fd',
  '#3b82f6',
  '#1d4ed8',
]
// Build custom menu logic (grid + more colors)
const fillPicker = ref<HTMLInputElement | null>(null)
const showFillDialog = ref(false)
const tempFill = ref<string>('#4b5563')
// Provide non-empty menu-items so ToolItem treats it like the border tool (same icon/caret spacing)
const fillMenu = fillPresets.map((c) => ({ label: c, value: c, icon: PaintBucket }))
function setFill(c: string) {
  fillColor.value = c
  emit('apply-fill', fillColor.value)
}
function onFillPicked(e: Event) {
  fillColor.value = (e.target as HTMLInputElement).value
  emit('apply-fill', fillColor.value)
}
function onSelectColor(c: string, close: () => void) {
  setFill(c)
  close()
}
function onMoreColors(close: () => void) {
  tempFill.value = fillColor.value
  showFillDialog.value = true
  close()
}
function onDialogConfirm(c: string) {
  setFill(c)
  showFillDialog.value = false
}
function onDialogCancel() {
  showFillDialog.value = false
}

// Cell border menu state
const borderStyle = ref<string>('all')
const borderMenu = [
  { label: '无框线', value: 'none', icon: Grid2X2X },
  { label: '所有框线', value: 'all', icon: Grid3X3 },
  { label: '外侧框线', value: 'outside', icon: Square },
  { label: '粗框线', value: 'thick', icon: SquarePlus },
]

function onBorderSelect(p: { label: string; value: string }) {
  const v = p.value as 'none' | 'all' | 'outside' | 'thick'
  emit('apply-border', { mode: v, color: '#374151' })
}

function onBorderMainClick() {
  const v = String(borderStyle.value) as 'none' | 'all' | 'outside' | 'thick'
  emit('apply-border', { mode: v, color: '#374151' })
}
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
          @update:model-value="emitFont()"
        />
        <Dropdown
          v-model="size"
          :options="sizeOptions"
          placeholder="14"
          :width="72"
          join="right"
          @update:model-value="(v:any) => { size = normSize(v); emitFont() }"
        />
      </ToolGroup>
      <ToolGroup :gap="6">
        <ToolItem label-position="none" aria-label="字号加" @click="() => { size = normSize((Number(size) || 14) + 1); emitFont() }"
          ><AArrowUp :size="18"
        /></ToolItem>
        <ToolItem label-position="none" aria-label="字号减" @click="() => { size = normSize((Number(size) || 14) - 1); emitFont() }"
          ><AArrowDown :size="18"
        /></ToolItem>
      </ToolGroup>
    </ToolGroup>
    <ToolGroup :gap="6">
      <ToolItem :active="bold" label-position="none" aria-label="加粗" @click="() => { bold = !bold; emit('toggle-bold', bold) }"
        ><Bold :size="18"
      /></ToolItem>
      <ToolItem :active="italic" label-position="none" aria-label="斜体" @click="() => { italic = !italic; emit('toggle-italic', italic) }"
        ><Italic :size="18"
      /></ToolItem>
      <ToolItem :active="underline" label-position="none" aria-label="下划线" @click="() => { underline = !underline; emit('toggle-underline', underline) }"
        ><Underline :size="18"
      /></ToolItem>
      <ToolItem :active="strike" label-position="none" aria-label="删除线" @click="() => { strike = !strike; emit('toggle-strikethrough', strike) }"
        ><Strikethrough :size="18"
      /></ToolItem>
      <ToolItem
        v-model="borderStyle"
        :menu-items="borderMenu"
        label-position="none"
        aria-label="单元格边框"
        split
        @click="onBorderMainClick"
        @select="onBorderSelect"
      />
      <ToolItem
        v-model="fillColor"
        :menu-items="fillMenu"
        label-position="none"
        aria-label="填充单元格颜色"
        :auto-icon="false"
        split
        @click="emit('apply-fill', fillColor)"
      >
        <IconWithSwatch :color="fillColor">
          <PaintBucket :size="18" />
        </IconWithSwatch>
        <template #menu="{ close }">
          <ColorGridMenu
            :colors="fillPresets"
            :value="fillColor"
            :columns="5"
            @select="(c) => onSelectColor(c, close)"
            @more="() => onMoreColors(close)"
          />
          <input ref="fillPicker" type="color" class="color-input-hidden" @input="onFillPicked" />
        </template>
      </ToolItem>
      <ToolItem label-position="none" aria-label="填充字体颜色"><Type :size="18" /></ToolItem>
      <ToolItem label-position="none" aria-label="清除"><Eraser :size="18" /></ToolItem>
    </ToolGroup>
  </ToolGroup>
  <ColorPickerModal
    v-model:visible="showFillDialog"
    v-model:color="tempFill"
    :movable="true"
    mask-color="rgba(0,0,0,0.25)"
    title="选择填充颜色"
    @confirm="onDialogConfirm"
    @cancel="onDialogCancel"
  />
</template>

<style scoped>
.mr-0 {
  margin-right: 0;
}
.color-input-hidden {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
}
</style>
