<script setup lang="ts">
import { Paintbrush, ClipboardPaste, Copy, Combine, Split } from 'lucide-vue-next'
import { computed } from 'vue'
import ToolItem from '../common/ToolItem.vue'
import ToolGroup from '../common/ToolGroup.vue'
import FontControls from './FontControls.vue'
import CellAlignIcon from '../common/icons/CellAlignIcon.vue'
// Props drive toolbar echo from active cell style
const props = defineProps<{
  fontFamily?: string | number
  fontSize?: string | number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  fontColor?: string
  horizontalAlign?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
}>()

// Emits: merge/unmerge and styling commands upward to layout/app
const emit = defineEmits<{
  (e: 'merge-cells'): void
  (e: 'unmerge-cells'): void
  (e: 'apply-fill', color: string): void
  (e: 'apply-border', payload: { mode: 'none' | 'all' | 'outside' | 'thick'; color?: string }): void
  (e: 'apply-font-color', color: string): void
  (e: 'apply-font-family', family: string): void
  (e: 'apply-font-size', size: number): void
  (e: 'toggle-bold', enabled: boolean): void
  (e: 'toggle-italic', enabled: boolean): void
  (e: 'toggle-underline', enabled: boolean): void
  (e: 'toggle-strikethrough', enabled: boolean): void
  (e: 'apply-horizontal-align', align: 'left' | 'center' | 'right'): void
  (e: 'apply-vertical-align', align: 'top' | 'middle' | 'bottom'): void
}>()

const horizontalAlign = computed(() => props.horizontalAlign ?? 'left')
const verticalAlign = computed(() => props.verticalAlign ?? 'middle')

function setAlignment(alignment: {
  horizontal?: 'left' | 'center' | 'right'
  vertical?: 'top' | 'middle' | 'bottom'
}) {
  if (alignment.horizontal) emit('apply-horizontal-align', alignment.horizontal)
  if (alignment.vertical) emit('apply-vertical-align', alignment.vertical)
}
</script>

<template>
  <div class="toolbar-card" aria-label="toolbar-card">
    <!-- 左侧：格式刷 与 粘贴（大图标 + 底部文字） -->
    <ToolGroup direction="horizontal" :gap="2">
      <ToolItem label="格式刷">
        <Paintbrush :size="22" />
      </ToolItem>
      <ToolItem label="粘贴">
        <ClipboardPaste :size="22" />
      </ToolItem>
    </ToolGroup>

    <!-- 右侧：复制/粘贴 竖直排列，无底部文字 -->
    <ToolGroup direction="vertical" :gap="2">
      <ToolItem label-position="none" aria-label="剪切"><ClipboardPaste :size="18" /></ToolItem>
      <ToolItem label-position="none" aria-label="复制"><Copy :size="18" /></ToolItem>
    </ToolGroup>

    <!-- 竖向分割线 -->
    <div class="vsep"></div>

    <!-- 字体控制块：上下 group（上：两个下拉紧贴；下：四个样式icon） -->
    <FontControls
      :font-family="props.fontFamily"
      :font-size="props.fontSize"
      :bold="props.bold"
      :italic="props.italic"
      :underline="props.underline"
      :strikethrough="props.strikethrough"
      :font-color="props.fontColor"
      @apply-fill="(c) => emit('apply-fill', c)"
      @apply-border="(p) => emit('apply-border', p)"
      @apply-font-color="(c) => emit('apply-font-color', c)"
      @apply-font-family="(f) => emit('apply-font-family', f)"
      @apply-font-size="(s) => emit('apply-font-size', s)"
      @toggle-bold="(v) => emit('toggle-bold', v)"
      @toggle-italic="(v) => emit('toggle-italic', v)"
      @toggle-underline="(v) => emit('toggle-underline', v)"
      @toggle-strikethrough="(v) => emit('toggle-strikethrough', v)"
    />

    <div class="vsep"></div>
    <ToolGroup direction="vertical" :gap="2">
      <ToolGroup :gap="2">
        <ToolItem
          label-position="none"
          aria-label="左上对齐"
          :active="horizontalAlign === 'left' && verticalAlign === 'top'"
          @click="setAlignment({ horizontal: 'left', vertical: 'top' })"
        >
          <CellAlignIcon variant="top-left" />
        </ToolItem>
        <ToolItem
          label-position="none"
          aria-label="右上对齐"
          :active="horizontalAlign === 'right' && verticalAlign === 'top'"
          @click="setAlignment({ horizontal: 'right', vertical: 'top' })"
        >
          <CellAlignIcon variant="top-right" />
        </ToolItem>
        <ToolItem
          label-position="none"
          aria-label="水平居左"
          :active="horizontalAlign === 'left'"
          @click="setAlignment({ horizontal: 'left' })"
        >
          <CellAlignIcon variant="horizontal-left" />
        </ToolItem>
        <ToolItem
          label-position="none"
          aria-label="水平居中"
          :active="horizontalAlign === 'center'"
          @click="setAlignment({ horizontal: 'center' })"
        >
          <CellAlignIcon variant="horizontal-center" />
        </ToolItem>
        <ToolItem
          label-position="none"
          aria-label="水平居右"
          :active="horizontalAlign === 'right'"
          @click="setAlignment({ horizontal: 'right' })"
        >
          <CellAlignIcon variant="horizontal-right" />
        </ToolItem>
      </ToolGroup>
      <ToolGroup :gap="2">
        <ToolItem
          label-position="none"
          aria-label="左下对齐"
          :active="horizontalAlign === 'left' && verticalAlign === 'bottom'"
          @click="setAlignment({ horizontal: 'left', vertical: 'bottom' })"
        >
          <CellAlignIcon variant="bottom-left" />
        </ToolItem>
        <ToolItem
          label-position="none"
          aria-label="右下对齐"
          :active="horizontalAlign === 'right' && verticalAlign === 'bottom'"
          @click="setAlignment({ horizontal: 'right', vertical: 'bottom' })"
        >
          <CellAlignIcon variant="bottom-right" />
        </ToolItem>
        <ToolItem
          label-position="none"
          aria-label="垂直居上"
          :active="verticalAlign === 'top'"
          @click="setAlignment({ vertical: 'top' })"
        >
          <CellAlignIcon variant="vertical-top" />
        </ToolItem>
        <ToolItem
          label-position="none"
          aria-label="垂直居中"
          :active="verticalAlign === 'middle'"
          @click="setAlignment({ vertical: 'middle' })"
        >
          <CellAlignIcon variant="vertical-middle" />
        </ToolItem>
        <ToolItem
          label-position="none"
          aria-label="垂直居下"
          :active="verticalAlign === 'bottom'"
          @click="setAlignment({ vertical: 'bottom' })"
        >
          <CellAlignIcon variant="vertical-bottom" />
        </ToolItem>
      </ToolGroup>
    </ToolGroup>
    <div class="vsep"></div>
    <!-- 合并/取消合并 -->
    <ToolGroup :gap="2">
      <ToolItem label-position="none" aria-label="合并单元格" @click="emit('merge-cells')">
        <Combine :size="18" />
      </ToolItem>
      <ToolItem label-position="none" aria-label="取消合并" @click="emit('unmerge-cells')">
        <Split :size="18" />
      </ToolItem>
    </ToolGroup>
  </div>
</template>

<style scoped>
.toolbar-card {
  height: 56px; /* 略微高一些 */
  background: #ffffff;
  border-radius: 12px;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.06),
    0 1px 2px rgba(0, 0, 0, 0.04),
    inset 0 0 0 1px #e6eaf2;
  /* Allow dropdown menus to overflow outside */
  overflow: visible;
  display: flex;
  align-items: center;
  padding: 6px 10px;
}
.tool-item {
  border: 0;
  background: transparent;
  border-radius: 10px;
  color: #4b5563;
}
.tool-tile:hover {
  background: rgba(0, 0, 0, 0.06);
}
.tool-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 44px;
  padding: 4px 8px;
  cursor: pointer;
}
.label {
  font-size: 12px;
  color: #6b7280;
  line-height: 1;
}
.tool-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px;
}
.vsep {
  width: 1px;
  height: 32px;
  background: #e5e7eb;
  margin: 0 6px;
}
.btn {
  appearance: none;
  border: 0;
  background: transparent;
  border-radius: 8px;
  padding: 4px;
  height: 24px;
  width: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #4b5563;
  cursor: pointer;
}
.btn:hover {
  background: rgba(0, 0, 0, 0.06);
}
</style>
