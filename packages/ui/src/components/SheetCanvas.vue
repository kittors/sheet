<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { CanvasRenderer } from '@sheet/renderer'
import { Workbook } from '@sheet/core'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const rendererRef = ref<CanvasRenderer | null>(null)
// Keep renderer & hit-testing sizes consistent
const HEADER_COL_W = 48
const HEADER_ROW_H = 28
const DEFAULT_COL_W = 100
const DEFAULT_ROW_H = 24

// Demo workbook with some data
const wb = new Workbook()
const sheet = wb.addSheet('Sheet1', 100000, 100)
for (let r = 0; r < 100; r++) {
  for (let c = 0; c < 10; c++) {
    if ((r + c) % 7 === 0) sheet.setValue(r, c, `R${r + 1}C${c + 1}`)
  }
}

const scroll = { x: 0, y: 0 }
const selection = ref<{ r0: number; c0: number; r1: number; c1: number } | undefined>()
type DragMode = 'none' | 'select' | 'vscroll' | 'hscroll'
const dragMode = ref<DragMode>('none')
let dragGrabOffset = 0 // for scrollbar dragging (pixels inside thumb)
let raf = 0

function render() {
  const canvas = canvasRef.value!
  const rect = canvas.parentElement!.getBoundingClientRect()
  if (canvas.clientWidth !== Math.floor(rect.width) || canvas.clientHeight !== Math.floor(rect.height)) {
    canvas.style.width = `${Math.floor(rect.width)}px`
    canvas.style.height = `${Math.floor(rect.height)}px`
    rendererRef.value?.resize(Math.floor(rect.width), Math.floor(rect.height))
  }
  rendererRef.value?.setSelection(selection.value)
  rendererRef.value?.render(sheet, scroll.x, scroll.y)
}

function schedule() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(render)
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  scroll.x = Math.max(0, scroll.x + e.deltaX)
  scroll.y = Math.max(0, scroll.y + e.deltaY)
  normalizeScroll()
  schedule()
}

function posToCell(clientX: number, clientY: number): { r: number; c: number } | null {
  const canvas = canvasRef.value!
  const rect = canvas.getBoundingClientRect()
  const x = clientX - rect.left
  const y = clientY - rect.top
  // Map to cell using renderer's knowledge
  const r = rendererRef.value
  if (!r) return null
  // Recompute visible range in sync with last render by calling a cheap render? Avoid; approximate by using internal state.
  // For now, derive by walking from headers origins and sizes.
  const originX = HEADER_COL_W
  const originY = HEADER_ROW_H
  if (x < originX || y < originY) return null
  // Avoid scrollbar areas
  const rctx = rendererRef.value
  const sb = rctx?.getScrollbars?.()
  if (sb) {
    const inV = sb.vTrack && x >= sb.vTrack.x && x <= sb.vTrack.x + sb.vTrack.w && y >= sb.vTrack.y && y <= sb.vTrack.y + sb.vTrack.h
    const inH = sb.hTrack && x >= sb.hTrack.x && x <= sb.hTrack.x + sb.hTrack.w && y >= sb.hTrack.y && y <= sb.hTrack.y + sb.hTrack.h
    if (inV || inH) return null
  }
  const cx = x - originX + scroll.x
  const cy = y - originY + scroll.y
  // Binary-search using cumulative sizes to avoid O(n) scan at large rows/cols
  const cumWidth = (i: number): number => {
    let base = i * DEFAULT_COL_W
    if (sheet.colWidths.size) for (const [c, w] of sheet.colWidths) if (c < i) base += (w - DEFAULT_COL_W)
    return base
  }
  const cumHeight = (i: number): number => {
    let base = i * DEFAULT_ROW_H
    if (sheet.rowHeights.size) for (const [r, h] of sheet.rowHeights) if (r < i) base += (h - DEFAULT_ROW_H)
    return base
  }
  const findIndexByPos = (pos: number, count: number, cumFn: (i: number) => number): number => {
    let lo = 0, hi = count
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      const start = cumFn(mid)
      const end = cumFn(mid + 1)
      if (pos < start) hi = mid
      else if (pos >= end) lo = mid + 1
      else return mid
    }
    return Math.min(count - 1, lo)
  }
  const col = findIndexByPos(cx, sheet.cols, cumWidth)
  const row = findIndexByPos(cy, sheet.rows, cumHeight)
  if (row >= sheet.rows || col >= sheet.cols) return null
  return { r: row, c: col }
}

function onPointerDown(e: PointerEvent) {
  const canvas = canvasRef.value!
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const sb = rendererRef.value?.getScrollbars?.()
  // Prioritize scrollbar hit-testing
  if (sb?.vTrack && x >= sb.vTrack.x && x <= sb.vTrack.x + sb.vTrack.w && y >= sb.vTrack.y && y <= sb.vTrack.y + sb.vTrack.h) {
    dragMode.value = 'vscroll'
    if (sb.vThumb && y >= sb.vThumb.y && y <= sb.vThumb.y + sb.vThumb.h) {
      dragGrabOffset = y - sb.vThumb.y
    } else {
      // Jump to position centered at click
      const trackSpan = sb.vTrack.h
      const thumbLen = sb.vThumb ? sb.vThumb.h : 0
      const newTop = Math.max(0, Math.min(trackSpan - thumbLen, y - sb.vTrack.y - thumbLen / 2))
      applyVThumb(newTop)
    }
    schedule()
    return
  }
  if (sb?.hTrack && x >= sb.hTrack.x && x <= sb.hTrack.x + sb.hTrack.w && y >= sb.hTrack.y && y <= sb.hTrack.y + sb.hTrack.h) {
    dragMode.value = 'hscroll'
    if (sb.hThumb && x >= sb.hThumb.x && x <= sb.hThumb.x + sb.hThumb.w) {
      dragGrabOffset = x - sb.hThumb.x
    } else {
      const trackSpan = sb.hTrack.w
      const thumbLen = sb.hThumb ? sb.hThumb.w : 0
      const newLeft = Math.max(0, Math.min(trackSpan - thumbLen, x - sb.hTrack.x - thumbLen / 2))
      applyHThumb(newLeft)
    }
    schedule()
    return
  }
  // Selection default
  const cell = posToCell(e.clientX, e.clientY)
  if (!cell) return
  selection.value = { r0: cell.r, c0: cell.c, r1: cell.r, c1: cell.c }
  dragMode.value = 'select'
  schedule()
}

function onPointerMove(e: PointerEvent) {
  if (dragMode.value === 'vscroll') {
    const sb = rendererRef.value?.getScrollbars?.()
    if (!sb?.vTrack || !sb?.vThumb) return
    const canvas = canvasRef.value!
    const rect = canvas.getBoundingClientRect()
    const y = e.clientY - rect.top
    const trackSpan = sb.vTrack.h
    const newTop = Math.max(0, Math.min(trackSpan - sb.vThumb.h, y - sb.vTrack.y - dragGrabOffset))
    applyVThumb(newTop)
    schedule()
    return
  }
  if (dragMode.value === 'hscroll') {
    const sb = rendererRef.value?.getScrollbars?.()
    if (!sb?.hTrack || !sb?.hThumb) return
    const canvas = canvasRef.value!
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const trackSpan = sb.hTrack.w
    const newLeft = Math.max(0, Math.min(trackSpan - sb.hThumb.w, x - sb.hTrack.x - dragGrabOffset))
    applyHThumb(newLeft)
    schedule()
    return
  }
  if (dragMode.value === 'select') {
    if (!selection.value) return
    const cell = posToCell(e.clientX, e.clientY)
    if (!cell) return
    selection.value = { ...selection.value, r1: cell.r, c1: cell.c }
    schedule()
  }
}

function onPointerUp() {
  dragMode.value = 'none'
}

onMounted(() => {
  if (!canvasRef.value) return
  rendererRef.value = new CanvasRenderer(canvasRef.value, { defaultColWidth: DEFAULT_COL_W, defaultRowHeight: DEFAULT_ROW_H, overscan: 2, headerColWidth: HEADER_COL_W, headerRowHeight: HEADER_ROW_H })
  schedule()
  window.addEventListener('resize', schedule)
  canvasRef.value.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  canvasRef.value.addEventListener('wheel', onWheel, { passive: false })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', schedule)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  canvasRef.value?.removeEventListener('wheel', onWheel)
  cancelAnimationFrame(raf)
})

// Utilities to operate on selection
function forEachSelected(cb: (r: number, c: number) => void) {
  if (!selection.value) return
  const r0 = Math.max(0, Math.min(selection.value.r0, selection.value.r1))
  const r1 = Math.min(sheet.rows - 1, Math.max(selection.value.r0, selection.value.r1))
  const c0 = Math.max(0, Math.min(selection.value.c0, selection.value.c1))
  const c1 = Math.min(sheet.cols - 1, Math.max(selection.value.c0, selection.value.c1))
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) cb(r, c)
  }
}

function applyTextColor(color: string) {
  const styleId = sheet.defineStyle({ font: { color } })
  forEachSelected((r, c) => sheet.setCellStyle(r, c, styleId))
  schedule()
}

function applyFillColor(backgroundColor: string) {
  const styleId = sheet.defineStyle({ fill: { backgroundColor } })
  forEachSelected((r, c) => sheet.setCellStyle(r, c, styleId))
  schedule()
}

function setValueInSelection(text: string) {
  forEachSelected((r, c) => sheet.setValue(r, c, text))
  schedule()
}

function getFirstSelectedCell(): { r: number; c: number } | null {
  if (!selection.value) return null
  const r = Math.min(selection.value.r0, selection.value.r1)
  const c = Math.min(selection.value.c0, selection.value.c1)
  return { r, c }
}

function getValueAt(r: number, c: number): string {
  const v = sheet.getCell(r, c)?.value
  return v == null ? '' : String(v)
}

defineExpose({ applyTextColor, applyFillColor, setValueInSelection, getFirstSelectedCell, getValueAt })

// Scroll helpers
function normalizeScroll() {
  // Clamp scroll within content bounds
  const r = rendererRef.value
  if (!r) return
  // Recompute metrics via last render assumptions; we can approximate by using sheet sizes
  const contentWidth = sheet.cols * DEFAULT_COL_W + [...sheet.colWidths.entries()].reduce((acc, [c, w]) => acc + (w - DEFAULT_COL_W), 0)
  const contentHeight = sheet.rows * DEFAULT_ROW_H + [...sheet.rowHeights.entries()].reduce((acc, [r, h]) => acc + (h - DEFAULT_ROW_H), 0)
  const canvas = canvasRef.value!
  const viewportContentWidth = Math.max(0, canvas.clientWidth - HEADER_COL_W)
  const viewportContentHeight = Math.max(0, canvas.clientHeight - HEADER_ROW_H)
  const maxX = Math.max(0, contentWidth - viewportContentWidth)
  const maxY = Math.max(0, contentHeight - viewportContentHeight)
  scroll.x = Math.max(0, Math.min(maxX, scroll.x))
  scroll.y = Math.max(0, Math.min(maxY, scroll.y))
}

function applyVThumb(newTop: number) {
  const sb = rendererRef.value?.getScrollbars?.()
  if (!sb?.vTrack) return
  const trackSpan = sb.vTrack.h
  const thumbLen = sb.vThumb ? sb.vThumb.h : 0
  const maxThumbTop = Math.max(0, trackSpan - thumbLen)
  const frac = maxThumbTop > 0 ? newTop / maxThumbTop : 0
  const canvas = canvasRef.value!
  const viewportContentHeight = Math.max(0, canvas.clientHeight - HEADER_ROW_H)
  const contentHeight = sheet.rows * DEFAULT_ROW_H + [...sheet.rowHeights.entries()].reduce((acc, [r, h]) => acc + (h - DEFAULT_ROW_H), 0)
  const maxScrollY = Math.max(0, contentHeight - viewportContentHeight)
  scroll.y = Math.max(0, Math.min(maxScrollY, Math.floor(frac * maxScrollY)))
}

function applyHThumb(newLeft: number) {
  const sb = rendererRef.value?.getScrollbars?.()
  if (!sb?.hTrack) return
  const trackSpan = sb.hTrack.w
  const thumbLen = sb.hThumb ? sb.hThumb.w : 0
  const maxThumbLeft = Math.max(0, trackSpan - thumbLen)
  const frac = maxThumbLeft > 0 ? newLeft / maxThumbLeft : 0
  const canvas = canvasRef.value!
  const viewportContentWidth = Math.max(0, canvas.clientWidth - HEADER_COL_W)
  const contentWidth = sheet.cols * DEFAULT_COL_W + [...sheet.colWidths.entries()].reduce((acc, [c, w]) => acc + (w - DEFAULT_COL_W), 0)
  const maxScrollX = Math.max(0, contentWidth - viewportContentWidth)
  scroll.x = Math.max(0, Math.min(maxScrollX, Math.floor(frac * maxScrollX)))
}
</script>

<template>
  <div class="sheet-canvas" style="position: relative; width: 100%; height: 100%; overflow: hidden; cursor: crosshair;">
    <canvas ref="canvasRef" style="display:block; width:100%; height:100%;"></canvas>
  </div>
</template>

<style scoped>
.sheet-canvas { background: #fff; }
</style>
