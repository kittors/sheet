<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { SheetCanvas, SheetControlLayout } from '@sheet/ui'
import { attachSheetInteractions, type InteractionHandle } from '@sheet/interaction'
import { createWorkbookWithSheet, applyCells, createSheetApi } from '@sheet/api'

const sheetRef = ref<any>(null)
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

function onReady(payload: { canvas: HTMLCanvasElement; renderer: any; sheet: any }) {
  // attach interactions as soon as child reports ready
  handle.value = attachSheetInteractions(payload)
  // build API and subscribe formula to selection changes
  api = createSheetApi({ sheet: payload.sheet, interaction: handle.value! })
  offSel = api.onSelectionChange((sel) => {
    hasSelection.value = !!sel
    // format selection like A1 or A1:B3
    selectionLabel.value = formatSelection(sel)
    const active = api!.getActiveCell()
    if (!active) { formula.value = ''; return }
    const v = api!.getCellValue(active.r, active.c)
    formula.value = v == null ? '' : String(v)
  })
}

onBeforeUnmount(() => {
  handle.value?.destroy()
  if (offSel) offSel()
})

const onRedText = () => api?.applyTextColor('#ef4444')
const onYellowFill = () => api?.applyFillColor('#fde68a')
const applyFormula = () => api?.setValueInSelection(formula.value)

function colName(n: number) {
  let s = ''
  n = n + 1
  while (n > 0) { const rem = (n - 1) % 26; s = String.fromCharCode(65 + rem) + s; n = Math.floor((n - 1) / 26) }
  return s
}
function formatSelection(sel: any) {
  if (!sel) return ''
  const r0 = Math.min(sel.r0, sel.r1), r1 = Math.max(sel.r0, sel.r1)
  const c0 = Math.min(sel.c0, sel.c1), c1 = Math.max(sel.c0, sel.c1)
  const a = `${colName(c0)}${r0 + 1}`
  const b = `${colName(c1)}${r1 + 1}`
  return a === b ? a : `${a}:${b}`
}
</script>

<template>
  <div style="display:flex; flex-direction:column; height: 100vh;">
    <SheetControlLayout v-model="formula" :selectionText="selectionLabel" :disabled="!hasSelection" @submit="applyFormula" />
    <div style="flex:1; min-height:0;">
      <SheetCanvas ref="sheetRef" :sheet="sheet" @ready="onReady" />
    </div>
  </div>
</template>


<style>
html, body, #app { height: 100%; margin: 0; }
</style>
