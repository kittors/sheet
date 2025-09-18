<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { SheetCanvas } from '@sheet/ui'
import { attachSheetInteractions, type InteractionHandle } from '@sheet/interaction'
import { createWorkbookWithSheet, applyCells, createSheetApi } from '@sheet/api'

const sheetRef = ref<any>(null)
const handle = ref<InteractionHandle | null>(null)
let api: ReturnType<typeof createSheetApi> | null = null
let offSel: (() => void) | null = null
const hasSelection = ref(false)
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
</script>

<template>
  <div style="display:flex; flex-direction:column; height: 100vh;">
    <header style="height:48px; display:flex; align-items:center; padding:0 12px; border-bottom:1px solid #e5e7eb; gap: 12px;">
      <strong>Canvas Sheet</strong>
      <button @click="onRedText" :disabled="!hasSelection" style="padding:4px 8px;">A (Red)</button>
      <button @click="onYellowFill" :disabled="!hasSelection" style="padding:4px 8px;">Fill (Yellow)</button>
      <span style="color:#6b7280;">Toolbar (placeholder)</span>
    </header>
    <div style="height:36px; display:flex; align-items:center; gap:8px; padding:0 12px; border-bottom:1px solid #e5e7eb;">
      <span style="width:60px; color:#6b7280;">fx</span>
      <input v-model="formula" :disabled="!hasSelection" @keydown.enter="applyFormula" placeholder="Formula Bar" style="flex:1; height:26px; padding:4px 8px;"/>
    </div>
    <div style="flex:1; min-height:0;">
      <SheetCanvas ref="sheetRef" :sheet="sheet" @ready="onReady" />
    </div>
  </div>
</template>


<style>
html, body, #app { height: 100%; margin: 0; }
</style>
