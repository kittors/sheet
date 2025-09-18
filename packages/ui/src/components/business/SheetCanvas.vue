<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { CanvasRenderer } from '@sheet/renderer'
import type { Sheet } from '@sheet/core'

// DOM/Renderer refs exposed to parent so interaction layer can attach
const canvasRef = ref<HTMLCanvasElement | null>(null)
const rendererRef = ref<CanvasRenderer | null>(null)

// Props: external sheet provided by app/API (UI remains presentational)
const props = defineProps<{
  sheet: Sheet
  defaultColWidth?: number
  defaultRowHeight?: number
  headerColWidth?: number
  headerRowHeight?: number
  overscan?: number
  scrollbarThickness?: number
}>()

// Use external sheet directly
const sheet = props.sheet

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
    defaultColWidth: props.defaultColWidth ?? 100,
    defaultRowHeight: props.defaultRowHeight ?? 24,
    overscan: props.overscan ?? 2,
    headerColWidth: props.headerColWidth ?? 48,
    headerRowHeight: props.headerRowHeight ?? 28,
    scrollbarThickness: props.scrollbarThickness ?? 12,
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
