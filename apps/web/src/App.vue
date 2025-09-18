<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { SheetCanvas, SheetControlLayout } from '@sheet/ui'
import { attachSheetInteractions, type InteractionHandle } from '@sheet/interaction'
import { createWorkbookWithSheet, applyCells, createSheetApi } from '@sheet/api'
import type { CanvasRenderer } from '@sheet/renderer'
import type { Sheet } from '@sheet/core'

const handle = ref<InteractionHandle | null>(null)
let api: ReturnType<typeof createSheetApi> | null = null
let offSel: (() => void) | null = null
const hasSelection = ref(false)
const selectionLabel = ref('')
const formula = ref('')

// Configure grid size and initial cell contents here (app layer)
const rows = ref(1000)
const cols = ref(100)
const cells = ref([
  { r: 0, c: 0, value: 'A1' },
  { r: 1, c: 1, value: 'B2' },
  { r: 2, c: 2, value: 'C3' },
])

// Create workbook/sheet externally and fill initial cells
const { sheet } = createWorkbookWithSheet({ name: 'Sheet1', rows: rows.value, cols: cols.value })
applyCells(sheet, cells.value)

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
  offSel = api.onSelectionChange((sel) => {
    hasSelection.value = !!sel
    // format selection like A1 or A1:B3
    selectionLabel.value = formatSelection(sel)
    const active = api!.getActiveCell()
    if (!active) {
      formula.value = ''
      return
    }
    const v = api!.getCellValue(active.r, active.c)
    formula.value = v == null ? '' : String(v)
  })
}

onBeforeUnmount(() => {
  handle.value?.destroy()
  if (offSel) offSel()
})

const applyFormula = () => api?.setValueInSelection(formula.value)

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
</script>

<template>
  <div style="display: flex; flex-direction: column; height: 100vh">
    <SheetControlLayout
      v-model="formula"
      :selection-text="selectionLabel"
      :disabled="!hasSelection"
      @submit="applyFormula"
    />
    <div style="flex: 1; min-height: 0">
      <SheetCanvas
        :sheet="sheet"
        :header-style="headerStyle"
        :header-labels="headerLabels"
        @ready="onReady"
      />
    </div>
  </div>
</template>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
}
</style>
