<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import '@sheet/ui/styles/theme.css'
import { SheetCanvas, SheetControlLayout, ContextMenu } from '@sheet/ui'
import { attachSheetInteractions, type InteractionHandle } from '@sheet/interaction'
import { createWorkbookWithSheet, applyCells, applyMerges, createSheetApi } from '@sheet/api'
import type { CanvasRenderer } from '@sheet/renderer'
import type { Sheet } from '@sheet/core'

const handle = ref<InteractionHandle | null>(null)
let api: ReturnType<typeof createSheetApi> | null = null
let offSel: (() => void) | null = null
const hasSelection = ref(false)
const selectionLabel = ref('')
const formula = ref('')
// Toolbar echo states (reflect active cell style)
const tbFontFamily = ref<string | number>('SongTi')
const tbFontSize = ref<string | number>(14)
const tbBold = ref(false)
const tbItalic = ref(false)
const tbUnderline = ref(false)
const tbStrike = ref(false)

// Configure grid size and initial cell contents here (app layer)
const rows = ref(1000)
const cols = ref(100)
const cells = ref([
  { r: 0, c: 0, value: 'A1' },
  { r: 1, c: 1, value: 'B2' },
  { r: 2, c: 2, value: 'C3' },
])
// Initial merged ranges (non-overlapping)
const merges = ref([
  { r: 0, c: 0, rows: 2, cols: 3 }, // A1:C2
  { r: 4, c: 0, rows: 1, cols: 2 }, // A5:B5 (row merge)
  { r: 0, c: 5, rows: 3, cols: 1 }, // F1:F3 (col merge)
])

// Create workbook/sheet externally and fill initial cells
const { sheet } = createWorkbookWithSheet({ name: 'Sheet1', rows: rows.value, cols: cols.value })
applyCells(sheet, cells.value)
applyMerges(sheet, merges.value)
// Demo: overflow/clip/ellipsis/wrap
const longText =
  'This is a very very long content to demonstrate overflow, clipping and wrapping behavior.'
// Styles for alignment/flow
const styleClip = sheet.defineStyle({ alignment: { overflow: 'clip' } })
const styleEllipsis = sheet.defineStyle({ alignment: { overflow: 'ellipsis' } })
const styleWrap = sheet.defineStyle({ alignment: { wrapText: true, vertical: 'top' } })
// Place sample cells (same column to compare)
sheet.setValue(7, 0, 'Overflow: ' + longText) // default overflow
sheet.setValue(8, 0, 'Clip: ' + longText)
sheet.setCellStyle(8, 0, styleClip)
sheet.setValue(9, 0, 'Ellipsis: ' + longText)
sheet.setCellStyle(9, 0, styleEllipsis)
sheet.setValue(10, 0, 'Wrap: ' + longText)
sheet.setCellStyle(10, 0, styleWrap)
sheet.setRowHeight(10, 72)

// App-level size configuration: define a few custom column widths and row heights
// Adjust or externalize as needed (e.g., from settings or persisted user prefs)
const initialColWidths: Array<{ index: number; width: number }> = [
  { index: 0, width: 140 },
  { index: 1, width: 220 },
  { index: 3, width: 180 },
]
const initialRowHeights: Array<{ index: number; height: number }> = [
  { index: 0, height: 32 },
  { index: 1, height: 40 },
  { index: 5, height: 36 },
]
for (const it of initialColWidths)
  if (it.index >= 0 && it.index < sheet.cols) sheet.setColWidth(it.index, it.width)
for (const it of initialRowHeights)
  if (it.index >= 0 && it.index < sheet.rows) sheet.setRowHeight(it.index, it.height)

// Header appearance and labels (configurable)
const headerStyle = {
  background: '#f9fafb', // 默认表头背景
  textColor: '#374151', // 表头文字颜色
  gridColor: '#e5e7eb', // 表头默认分隔线颜色
  selectedBackground: '#d1d5db', // 表头激活背景色
  selectedGridColor: '#9ca3af', // 表头激活范围的分隔线颜色（可选）
}
const headerLabels = {
  // 可自定义返回值；不提供时仍使用 A,B,C… / 1,2,3…
  // col: (i: number) => `列${i + 1}`,
  // row: (i: number) => `行${i + 1}`,
}

function onReady(payload: { canvas: HTMLCanvasElement; renderer: CanvasRenderer; sheet: Sheet }) {
  // attach interactions as soon as child reports ready
  handle.value = attachSheetInteractions(payload)
  // build API and subscribe formula to selection changes
  api = createSheetApi({ sheet: payload.sheet, interaction: handle.value! })
  // live sync formula bar while editing
  handle.value!.onEditorChange?.((e) => {
    if (e && e.editing) {
      formula.value = e.text ?? ''
    }
  })
  offSel = api.onSelectionChange((sel) => {
    hasSelection.value = !!sel
    // format selection like A1 or A1:B3
    selectionLabel.value = formatSelection(sel)
    const active = api!.getActiveCell()
    if (!active) {
      formula.value = ''
      // reset toolbar to defaults when no active cell
      tbFontFamily.value = 'SongTi'
      tbFontSize.value = 14
      tbBold.value = false
      tbItalic.value = false
      tbUnderline.value = false
      tbStrike.value = false
      return
    }
    const v = api!.getCellValue(active.r, active.c)
    formula.value = v == null ? '' : String(v)
    // echo style to toolbar
    const st = api!.getCellStyle(active.r, active.c)
    // Echo effective style with sensible defaults when not set on the cell
    tbFontFamily.value = st?.font?.family ?? 'SongTi'
    tbFontSize.value = st?.font?.size ?? 14
    tbBold.value = !!st?.font?.bold
    tbItalic.value = !!st?.font?.italic
    tbUnderline.value = !!st?.font?.underline
    tbStrike.value = !!st?.font?.strikethrough
  })
}

onBeforeUnmount(() => {
  handle.value?.destroy()
  if (offSel) offSel()
})

const applyFormula = () => api?.setValueInSelection(formula.value)
const onMergeCells = () => api?.mergeSelection()
const onUnmergeCells = () => api?.unmergeSelection()
const onApplyFill = (color: string) => api?.applyFillColor(color)
const onApplyBorder = (p: { mode: 'none' | 'all' | 'outside' | 'thick'; color?: string }) => {
  if (!api) return
  if (p.mode === 'thick') api.applyBorder({ mode: 'all', width: 2, style: 'solid', color: p.color })
  else if (p.mode === 'outside') api.applyBorder({ mode: 'outside', width: 1, style: 'solid', color: p.color })
  else if (p.mode === 'all') api.applyBorder({ mode: 'all', width: 1, style: 'solid', color: p.color })
  else api.applyBorder({ mode: 'none' })
}

// Font controls handlers
const onApplyFontFamily = (family: string) => {
  api?.applyFontFamily(family)
  tbFontFamily.value = family
}
const onApplyFontSize = (size: number) => {
  api?.applyFontSize(size)
  tbFontSize.value = size
}
const onToggleBold = (v: boolean) => {
  api?.applyFontBold(v)
  tbBold.value = v
}
const onToggleItalic = (v: boolean) => {
  api?.applyFontItalic(v)
  tbItalic.value = v
}
const onToggleUnderline = (v: boolean) => {
  api?.applyFontUnderline(v)
  tbUnderline.value = v
}
const onToggleStrikethrough = (v: boolean) => {
  api?.applyFontStrikethrough(v)
  tbStrike.value = v
}

function colName(n: number) {
  let s = ''
  n = n + 1
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}
function formatSelection(sel: { r0: number; c0: number; r1: number; c1: number } | null) {
  if (!sel) return ''
  const r0 = Math.min(sel.r0, sel.r1),
    r1 = Math.max(sel.r0, sel.r1)
  const c0 = Math.min(sel.c0, sel.c1),
    c1 = Math.max(sel.c0, sel.c1)
  const a = `${colName(c0)}${r0 + 1}`
  const b = `${colName(c1)}${r1 + 1}`
  return a === b ? a : `${a}:${b}`
}

// 右键菜单（仅在表格内容区域触发）
import { Scissors, Copy, ClipboardPaste, AlignLeft, AlignCenter, AlignRight } from 'lucide-vue-next'
import type { ContextMenuItem } from '@sheet/ui'
const cmRef = ref<InstanceType<typeof ContextMenu> | null>(null)
const cmItems = ref<ContextMenuItem[]>([])
// 右键菜单（含二级菜单，仅展示，不实现功能）
const cellMenu: ContextMenuItem[] = [
  { id: 'cut', label: '剪切', icon: Scissors, shortcut: '⌘X' },
  { id: 'copy', label: '复制', icon: Copy, shortcut: '⌘C' },
  { id: 'paste', label: '粘贴', icon: ClipboardPaste, shortcut: '⌘V' },
  { id: 'grp-sep-1', seperator: true },
  {
    id: 'insert',
    label: '插入',
    children: [
      { id: 'insert-row-above', label: '在上方插入行' },
      { id: 'insert-row-below', label: '在下方插入行' },
      { id: 'ins-sep-1', seperator: true },
      { id: 'insert-col-left', label: '在左侧插入列' },
      { id: 'insert-col-right', label: '在右侧插入列' },
    ],
  },
  {
    id: 'align',
    label: '对齐',
    children: [
      { id: 'align-left', label: '左对齐', icon: AlignLeft },
      { id: 'align-center', label: '水平居中', icon: AlignCenter },
      { id: 'align-right', label: '右对齐', icon: AlignRight },
      { id: 'aln-sep-1', seperator: true },
      { id: 'valign-top', label: '顶部对齐' },
      { id: 'valign-middle', label: '垂直居中' },
      { id: 'valign-bottom', label: '底部对齐' },
      // 第三级示例
      {
        id: 'align-advanced',
        label: '高级',
        separatorBefore: true,
        children: [
          { id: 'distribute-h', label: '水平分布' },
          { id: 'distribute-v', label: '垂直分布' },
          {
            id: 'indent',
            label: '缩进',
            children: [
              { id: 'indent-increase', label: '增加缩进' },
              { id: 'indent-decrease', label: '减少缩进' },
            ],
          },
        ],
      },
    ],
  },
  { id: 'grp-sep-2', seperator: true },
  // 多级菜单综合示例：格式 -> 数字格式 -> 小数位 -> 选项
  {
    id: 'format',
    label: '格式',
    children: [
      {
        id: 'number-format',
        label: '数字格式',
        children: [
          { id: 'fmt-general', label: '常规' },
          { id: 'fmt-number', label: '数值' },
          { id: 'fmt-percent', label: '百分比' },
          {
            id: 'fmt-decimal',
            label: '小数位',
            children: [
              { id: 'decimal-0', label: '0 位' },
              { id: 'decimal-1', label: '1 位' },
              { id: 'decimal-2', label: '2 位' },
              { id: 'decimal-3', label: '3 位' },
            ],
          },
        ],
      },
      {
        id: 'borders',
        label: '边框',
        children: [
          { id: 'border-all', label: '所有边框' },
          { id: 'border-outside', label: '外边框' },
          { id: 'border-inside', label: '内部边框' },
        ],
      },
      {
        id: 'text-orientation',
        label: '文本方向',
        children: [
          { id: 'orientation-horizontal', label: '水平' },
          { id: 'orientation-vertical', label: '垂直' },
          {
            id: 'orientation-angle',
            label: '角度',
            children: [
              { id: 'angle-45', label: '45 deg' },
              { id: 'angle-90', label: '90 deg' },
              { id: 'angle-135', label: '135 deg' },
            ],
          },
        ],
      },
    ],
  },
]
function onOpenContextMenu(e: MouseEvent) {
  // 仅在内容区域（cell）打开
  const hit = handle.value?.hitTest(e.clientX, e.clientY)
  if (hit && hit.area === 'cell') {
    cmItems.value = cellMenu
    cmRef.value?.openWithEvent(e)
  }
}
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100vh">
    <SheetControlLayout
      v-model="formula"
      :selection-text="selectionLabel"
      :disabled="!hasSelection"
      :font-family="tbFontFamily"
      :font-size="tbFontSize"
      :bold="tbBold"
      :italic="tbItalic"
      :underline="tbUnderline"
      :strikethrough="tbStrike"
      @submit="applyFormula"
      @merge-cells="onMergeCells"
      @unmerge-cells="onUnmergeCells"
      @apply-fill="onApplyFill"
      @apply-border="onApplyBorder"
      @apply-font-family="onApplyFontFamily"
      @apply-font-size="onApplyFontSize"
      @toggle-bold="onToggleBold"
      @toggle-italic="onToggleItalic"
      @toggle-underline="onToggleUnderline"
      @toggle-strikethrough="onToggleStrikethrough"
    />
    <div style="flex: 1; min-height: 0" @contextmenu="onOpenContextMenu">
      <SheetCanvas
        :sheet="sheet"
        :header-style="headerStyle"
        :header-labels="headerLabels"
        @ready="onReady"
      />
    </div>
    <ContextMenu ref="cmRef" :menu-items="cmItems" />
  </div>
</template>

<style>
@import '@sheet/ui/styles/theme.css';
html,
body,
#app {
  height: 100%;
  margin: 0;
}
</style>
