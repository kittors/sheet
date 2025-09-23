<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import '@sheet/ui/styles/theme.css'
import { SheetCanvas, SheetControlLayout, ContextMenu } from '@sheet/ui'
import { attachSheetInteractions, type InteractionHandle } from '@sheet/interaction'
import {
  createWorkbookWithSheet,
  applyCells,
  applyMerges,
  createSheetApi,
  type InitCell,
} from '@sheet/api'
import type { CanvasRenderer, WorkerRenderer } from '@sheet/renderer'
import type { BorderStyle, Sheet, Style } from '@sheet/core'
import tableData from './data/table.json'
import cellMenu from './config/contextMenu'

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

// Configure grid size and initial cell contents (externalized JSON under src/data)
type AttachArgs = Parameters<typeof attachSheetInteractions>[0]
type StyleDefinition = Omit<Style, 'id'>
type TableCell = InitCell & { style?: string }
type BorderRegion = {
  r0: number
  c0: number
  r1: number
  c1: number
  color?: string
  width?: number
  style?: BorderStyle
  outsideOnly?: boolean
}

interface TableData {
  rows: number
  cols: number
  cells: TableCell[]
  merges: Array<{ r: number; c: number; rows: number; cols: number }>
  styles?: Record<string, StyleDefinition>
  colWidths?: Array<{ index: number; width: number }>
  rowHeights?: Array<{ index: number; height: number }>
  borderRegions?: BorderRegion[]
}
const td = tableData as TableData
const rows = ref(td.rows)
const cols = ref(td.cols)
const cells = ref<TableCell[]>(td.cells)
const merges = ref(td.merges)

// Create workbook/sheet externally and fill initial cells
const { sheet } = createWorkbookWithSheet({ name: 'Sheet1', rows: rows.value, cols: cols.value })
applyCells(sheet, cells.value)
applyMerges(sheet, merges.value)
// Demo内容改为从 JSON 读取（见下方 JSON 应用段）

// ---------- Demo: Borders ----------
// Helper to apply a border style to a rectangular region; interior sides dedupe in renderer
function applyRegionBorder(
  r0: number,
  c0: number,
  r1: number,
  c1: number,
  cfg: {
    color?: string
    width?: number
    style?: BorderStyle
    outsideOnly?: boolean
  },
) {
  const color = cfg.color ?? '#111827'
  const width = Math.max(1, Math.floor(cfg.width ?? 1))
  const style = cfg.style ?? 'solid'
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const top = r === r0
      const bottom = r === r1
      const left = c === c0
      const right = c === c1
      const sides = cfg.outsideOnly
        ? {
            top: top ? { color, width, style } : undefined,
            bottom: bottom ? { color, width, style } : undefined,
            left: left ? { color, width, style } : undefined,
            right: right ? { color, width, style } : undefined,
          }
        : {
            top: { color, width, style },
            bottom: { color, width, style },
            left: { color, width, style },
            right: { color, width, style },
          }
      const id = sheet.defineStyle({ border: sides })
      sheet.setCellStyle(r, c, id)
    }
  }
}

// 从 JSON 应用：样式、单元格样式、行高列宽、边框区域
const styleMap = new Map<string, number>()
if (td.styles) {
  for (const [name, def] of Object.entries(td.styles)) {
    styleMap.set(name, sheet.defineStyle(def))
  }
}
// apply cell-level styles defined by style name
for (const cell of cells.value) {
  if (cell.style) {
    const id = styleMap.get(cell.style)
    if (id != null) sheet.setCellStyle(cell.r, cell.c, id)
  }
}
// col widths / row heights
for (const it of td.colWidths ?? [])
  if (it.index >= 0 && it.index < sheet.cols) sheet.setColWidth(it.index, it.width)
for (const it of td.rowHeights ?? [])
  if (it.index >= 0 && it.index < sheet.rows) sheet.setRowHeight(it.index, it.height)
// border regions
for (const br of td.borderRegions ?? []) applyRegionBorder(br.r0, br.c0, br.r1, br.c1, br)

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

function onReady(payload: {
  canvas: HTMLCanvasElement
  renderer: CanvasRenderer | WorkerRenderer
  sheet: Sheet
  scrollHost?: HTMLElement | null
  infiniteScroll?: boolean
}) {
  // attach interactions as soon as child reports ready
  // Safari/macOS 在滚动到左右/上下边缘时容易触发系统级回退/前进手势或产生弹性回弹导致画布抖动。
  // 为了彻底规避该问题，在 Safari 下禁用“原生滚动主机”路径，改用自定义 wheel 处理（会调用 preventDefault）。
  const ua = navigator.userAgent
  const isSafari = /Safari\//.test(ua) && !/Chrom(e|ium)\//.test(ua)
  const attachArgs: AttachArgs = {
    canvas: payload.canvas,
    renderer: payload.renderer as CanvasRenderer,
    sheet: payload.sheet,
    scrollHost: isSafari ? null : payload.scrollHost,
    infiniteScroll: payload.infiniteScroll,
  }
  handle.value = attachSheetInteractions(attachArgs)
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
  else if (p.mode === 'outside')
    api.applyBorder({ mode: 'outside', width: 1, style: 'solid', color: p.color })
  else if (p.mode === 'all')
    api.applyBorder({ mode: 'all', width: 1, style: 'solid', color: p.color })
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
import type { ContextMenuItem } from '@sheet/ui'
const cmRef = ref<InstanceType<typeof ContextMenu> | null>(null)
const cmItems = ref<ContextMenuItem[]>([])
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
        :infinite-scroll="true"
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
/* 全局禁用 overscroll 链接与回弹，降低 Safari 边缘手势误触 */
html,
body {
  overscroll-behavior-x: none;
  overscroll-behavior-y: none;
}
</style>
