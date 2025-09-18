<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import { SheetCanvas } from '@sheet/ui'

const sheetRef = ref<any>(null)
const formula = ref('')

// Configure grid size and initial cell contents here (app layer)
const rows = ref(1000) // default if not provided in component is 100
const cols = ref(100) // default if not provided in component is 100
const cells = ref([
  { r: 0, c: 0, value: 'A1' },
  { r: 1, c: 1, value: 'B2' },
  { r: 2, c: 2, value: 'C3' },
])

function syncFormula() {
  const cell = sheetRef.value?.getFirstSelectedCell?.()
  if (cell) formula.value = sheetRef.value?.getValueAt?.(cell.r, cell.c) || ''
}

const onRedText = () => sheetRef.value?.applyTextColor?.('#ef4444')
const onYellowFill = () => sheetRef.value?.applyFillColor?.('#fde68a')
const applyFormula = () => sheetRef.value?.setValueInSelection?.(formula.value)

watchEffect(() => {
  // attempt to sync on each tick; a more robust way is to emit from SheetCanvas
  syncFormula()
})
</script>

<template>
  <div style="display:flex; flex-direction:column; height: 100vh;">
    <header style="height:48px; display:flex; align-items:center; padding:0 12px; border-bottom:1px solid #e5e7eb; gap: 12px;">
      <strong>Canvas Sheet</strong>
      <button @click="onRedText" style="padding:4px 8px;">A (Red)</button>
      <button @click="onYellowFill" style="padding:4px 8px;">Fill (Yellow)</button>
      <span style="color:#6b7280;">Toolbar (placeholder)</span>
    </header>
    <div style="height:36px; display:flex; align-items:center; gap:8px; padding:0 12px; border-bottom:1px solid #e5e7eb;">
      <span style="width:60px; color:#6b7280;">fx</span>
      <input v-model="formula" @keydown.enter="applyFormula" placeholder="Formula Bar" style="flex:1; height:26px; padding:4px 8px;"/>
    </div>
    <div style="flex:1; min-height:0;">
      <SheetCanvas ref="sheetRef" :rows="rows" :cols="cols" :cells="cells" />
    </div>
  </div>
</template>


<style>
html, body, #app { height: 100%; margin: 0; }
</style>
