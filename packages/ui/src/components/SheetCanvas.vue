<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { CanvasRenderer } from '@sheet/renderer'
import type { Sheet } from '@sheet/core'
import { Workbook } from '@sheet/core'

// DOM/Renderer refs exposed to parent so interaction layer can attach
const canvasRef = ref<HTMLCanvasElement | null>(null)
const rendererRef = ref<CanvasRenderer | null>(null)

// Props: grid size and initial cell values (UI remains presentational)
interface InitCell { r: number; c: number; value: string | number | boolean | null }
const props = defineProps<{ rows?: number; cols?: number; cells?: InitCell[] }>()

// Create a default workbook/sheet for convenience; expose to parent
const wb = new Workbook()
let sheet = wb.addSheet('Sheet1', props.rows ?? 100, props.cols ?? 100)

// Apply initial/updated cells (data-only; no interaction here)
function applyCells(arr?: InitCell[]) {
  if (!arr) return
  for (const it of arr) {
    if (it.r >= 0 && it.r < sheet.rows && it.c >= 0 && it.c < sheet.cols) sheet.setValue(it.r, it.c, it.value)
  }
}
applyCells(props.cells)
watch(
  () => props.cells,
  (arr) => {
    applyCells(arr)
    // Trigger a passive re-render so users see updated data even未绑定交互时
    renderOnce()
  },
  { deep: true }
)

// Minimal initial paint so UI不依赖交互层也能显示基础网格/表头
function renderOnce() {
  const canvas = canvasRef.value
  const renderer = rendererRef.value
  if (!canvas || !renderer) return
  const rect = canvas.parentElement?.getBoundingClientRect()
  if (!rect) return
  const w = Math.max(1, Math.floor(rect.width))
  const h = Math.max(1, Math.floor(rect.height))
  if (canvas.clientWidth !== w || canvas.clientHeight !== h) {
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    renderer.resize(w, h)
  }
  renderer.setSelection(undefined)
  renderer.render(sheet, 0, 0)
}

const emit = defineEmits<{ (e: 'ready', payload: { canvas: HTMLCanvasElement; renderer: CanvasRenderer; sheet: Sheet }): void }>()

onMounted(() => {
  if (!canvasRef.value) return
  // Keep defaults consistent with renderer's default appearance
  rendererRef.value = new CanvasRenderer(canvasRef.value, {
    defaultColWidth: 100,
    defaultRowHeight: 24,
    overscan: 2,
    headerColWidth: 48,
    headerRowHeight: 28,
  })
  // Do one passive paint; 交互包挂载后会接管渲染循环
  requestAnimationFrame(renderOnce)
  // Notify parent that canvas+renderer+sheet are ready
  emit('ready', { canvas: canvasRef.value, renderer: rendererRef.value, sheet })
})

// Expose minimal surface for interaction package to hook into
defineExpose({ canvasRef, rendererRef, sheet })
</script>

<template>
  <div class="sheet-canvas" style="position: relative; width: 100%; height: 100%; overflow: hidden;">
    <canvas ref="canvasRef" style="display:block; width:100%; height:100%;"></canvas>
  </div>
</template>

<style scoped>
.sheet-canvas { background: #fff; touch-action: none; user-select: none; }
</style>
