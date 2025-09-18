<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { CanvasRenderer } from '@sheet/renderer'
import { Workbook } from '@sheet/core'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const rendererRef = ref<CanvasRenderer | null>(null)
// Keep renderer & hit-testing sizes consistent
const HEADER_COL_W = 48
const HEADER_ROW_H = 28
const DEFAULT_COL_W = 100
const DEFAULT_ROW_H = 24

// Props to drive grid size and initial cell values from app layer
interface InitCell { r: number; c: number; value: string | number | boolean | null }
const props = defineProps<{ rows?: number; cols?: number; cells?: InitCell[] }>()
const wb = new Workbook()
let sheet = wb.addSheet('Sheet1', props.rows ?? 100, props.cols ?? 100)
// Apply initial cell values
if (props.cells?.length) {
  for (const it of props.cells) {
    if (it.r >= 0 && it.r < sheet.rows && it.c >= 0 && it.c < sheet.cols) {
      sheet.setValue(it.r, it.c, it.value)
    }
  }
}
// If app changes cells prop, reflect new values
watch(() => props.cells, (arr) => {
  if (!arr) return
  for (const it of arr) {
    if (it.r >= 0 && it.r < sheet.rows && it.c >= 0 && it.c < sheet.cols) sheet.setValue(it.r, it.c, it.value)
  }
  schedule()
}, { deep: true })

const scroll = { x: 0, y: 0 }
const selection = ref<{ r0: number; c0: number; r1: number; c1: number } | undefined>()
type DragMode = 'none' | 'select' | 'vscroll' | 'hscroll' | 'colheader' | 'rowheader'
const dragMode = ref<DragMode>('none')
let dragGrabOffset = 0 // for scrollbar dragging (pixels inside thumb)
let raf = 0
// UI-side scrollbar thickness should match renderer default unless overridden
const SCROLL_THICKNESS = 12

function computeAvailViewport(canvas: HTMLCanvasElement) {
  const viewW = canvas.clientWidth
  const viewH = canvas.clientHeight
  const baseW = Math.max(0, viewW - HEADER_COL_W)
  const baseH = Math.max(0, viewH - HEADER_ROW_H)
  const contentWidth = sheet.cols * DEFAULT_COL_W + [...sheet.colWidths.entries()].reduce((acc, [c, w]) => acc + (w - DEFAULT_COL_W), 0)
  const contentHeight = sheet.rows * DEFAULT_ROW_H + [...sheet.rowHeights.entries()].reduce((acc, [r, h]) => acc + (h - DEFAULT_ROW_H), 0)
  let widthAvail = baseW
  let heightAvail = baseH
  let vScrollable = contentHeight > heightAvail
  let hScrollable = contentWidth > widthAvail
  for (let i = 0; i < 3; i++) {
    const nextW = Math.max(0, baseW - (vScrollable ? SCROLL_THICKNESS : 0))
    const nextH = Math.max(0, baseH - (hScrollable ? SCROLL_THICKNESS : 0))
    const nextV = contentHeight > nextH
    const nextHFlag = contentWidth > nextW
    if (nextW === widthAvail && nextH === heightAvail && nextV === vScrollable && nextHFlag === hScrollable) break
    widthAvail = nextW
    heightAvail = nextH
    vScrollable = nextV
    hScrollable = nextHFlag
  }
  return { widthAvail, heightAvail }
}

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
  // Clamp scroll-equivalent positions within content bounds to avoid indexing drift near edges
  // Reuse same formulas as normalizeScroll but without mutating state
  const contentWidth = sheet.cols * DEFAULT_COL_W + [...sheet.colWidths.entries()].reduce((acc, [c, w]) => acc + (w - DEFAULT_COL_W), 0)
  const contentHeight = sheet.rows * DEFAULT_ROW_H + [...sheet.rowHeights.entries()].reduce((acc, [r, h]) => acc + (h - DEFAULT_ROW_H), 0)
  const { widthAvail: viewportContentWidth, heightAvail: viewportContentHeight } = computeAvailViewport(canvas)
  const maxX = Math.max(0, contentWidth - viewportContentWidth)
  const maxY = Math.max(0, contentHeight - viewportContentHeight)
  const sX = Math.max(0, Math.min(scroll.x, maxX))
  const sY = Math.max(0, Math.min(scroll.y, maxY))

  const cx = x - originX + sX
  const cy = y - originY + sY
  // Binary-search using cumulative sizes to avoid O(n) scan at large rows/cols
  const cumWidth = (i: number): number => {
    let base = i * DEFAULT_COL_W
    if (sheet.colWidths.size) for (const [c, w] of sheet.colWidths) { if (c < i) base += (w - DEFAULT_COL_W) }
    return base
  }
  const cumHeight = (i: number): number => {
    let base = i * DEFAULT_ROW_H
    if (sheet.rowHeights.size) for (const [r, h] of sheet.rowHeights) { if (r < i) base += (h - DEFAULT_ROW_H) }
    return base
  }
  const findIndexByPos = (pos: number, count: number, cumFn: (i: number) => number): number => {
    // clamp pos within content
    const total = cumFn(count)
    const p = Math.max(0, Math.min(total - 1, pos))
    let lo = 0, hi = count
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      const start = cumFn(mid)
      const end = cumFn(mid + 1)
      if (p < start) hi = mid
      else if (p >= end) lo = mid + 1
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
    rendererRef.value?.setScrollbarState?.({ vActive: true })
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
  // Header hit-testing (after scrollbars)
  const rightBound = sb?.vTrack ? sb.vTrack.x : canvas.clientWidth
  const bottomBound = sb?.hTrack ? sb.hTrack.y : canvas.clientHeight
  // Corner (select all)
  if (x >= 0 && x < HEADER_COL_W && y >= 0 && y < HEADER_ROW_H) {
    selection.value = { r0: 0, c0: 0, r1: sheet.rows - 1, c1: sheet.cols - 1 }
    dragMode.value = 'none'
    schedule()
    return
  }
  // Column header band
  if (y >= 0 && y < HEADER_ROW_H && x >= HEADER_COL_W && x < rightBound) {
    // Map x to column index using clamped scroll X
    const { widthAvail: viewportContentWidth } = computeAvailViewport(canvas)
    const contentWidth = sheet.cols * DEFAULT_COL_W + [...sheet.colWidths.entries()].reduce((acc, [c, w]) => acc + (w - DEFAULT_COL_W), 0)
    const maxX = Math.max(0, contentWidth - viewportContentWidth)
    const sX = Math.max(0, Math.min(scroll.x, maxX))
    const cx = x - HEADER_COL_W + sX
    const cumWidth = (i: number): number => {
      let base = i * DEFAULT_COL_W
      if (sheet.colWidths.size) for (const [c, w] of sheet.colWidths) { if (c < i) base += (w - DEFAULT_COL_W) }
      return base
    }
    const findIndexByPos = (pos: number, count: number, cumFn: (i: number) => number): number => {
      const total = cumFn(count)
      const p = Math.max(0, Math.min(total - 1, pos))
      let lo = 0, hi = count
      while (lo < hi) {
        const mid = (lo + hi) >>> 1
        const start = cumFn(mid)
        const end = cumFn(mid + 1)
        if (p < start) hi = mid
        else if (p >= end) lo = mid + 1
        else return mid
      }
      return Math.min(count - 1, lo)
    }
    const col = findIndexByPos(cx, sheet.cols, cumWidth)
    selection.value = { r0: 0, r1: sheet.rows - 1, c0: col, c1: col }
    dragMode.value = 'colheader'
    schedule()
    return
  }
  // Row header band
  if (x >= 0 && x < HEADER_COL_W && y >= HEADER_ROW_H && y < bottomBound) {
    // Map y to row index using clamped scroll Y
    const { heightAvail: viewportContentHeight } = computeAvailViewport(canvas)
    const contentHeight = sheet.rows * DEFAULT_ROW_H + [...sheet.rowHeights.entries()].reduce((acc, [r, h]) => acc + (h - DEFAULT_ROW_H), 0)
    const maxY = Math.max(0, contentHeight - viewportContentHeight)
    const sY = Math.max(0, Math.min(scroll.y, maxY))
    const cy = y - HEADER_ROW_H + sY
    const cumHeight = (i: number): number => {
      let base = i * DEFAULT_ROW_H
      if (sheet.rowHeights.size) for (const [r, h] of sheet.rowHeights) { if (r < i) base += (h - DEFAULT_ROW_H) }
      return base
    }
    const findIndexByPos = (pos: number, count: number, cumFn: (i: number) => number): number => {
      const total = cumFn(count)
      const p = Math.max(0, Math.min(total - 1, pos))
      let lo = 0, hi = count
      while (lo < hi) {
        const mid = (lo + hi) >>> 1
        const start = cumFn(mid)
        const end = cumFn(mid + 1)
        if (p < start) hi = mid
        else if (p >= end) lo = mid + 1
        else return mid
      }
      return Math.min(count - 1, lo)
    }
    const row = findIndexByPos(cy, sheet.rows, cumHeight)
    selection.value = { r0: row, r1: row, c0: 0, c1: sheet.cols - 1 }
    dragMode.value = 'rowheader'
    schedule()
    return
  }
  if (sb?.hTrack && x >= sb.hTrack.x && x <= sb.hTrack.x + sb.hTrack.w && y >= sb.hTrack.y && y <= sb.hTrack.y + sb.hTrack.h) {
    dragMode.value = 'hscroll'
    rendererRef.value?.setScrollbarState?.({ hActive: true })
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
  // Update hover state & cursor when not dragging
  const canvas = canvasRef.value!
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const sb0 = rendererRef.value?.getScrollbars?.()
  let cursor = 'default'
  if (dragMode.value === 'none' && sb0) {
    const inV = !!(sb0.vTrack && x >= sb0.vTrack.x && x <= sb0.vTrack.x + sb0.vTrack.w && y >= sb0.vTrack.y && y <= sb0.vTrack.y + sb0.vTrack.h)
    const inH = !!(sb0.hTrack && x >= sb0.hTrack.x && x <= sb0.hTrack.x + sb0.hTrack.w && y >= sb0.hTrack.y && y <= sb0.hTrack.y + sb0.hTrack.h)
    rendererRef.value?.setScrollbarState?.({ vHover: inV, hHover: inH })
    schedule()
    if (inV || inH) cursor = 'pointer'
  }
  ;(canvas.parentElement as HTMLElement).style.cursor = cursor
  if (dragMode.value === 'vscroll') {
    const sb = rendererRef.value?.getScrollbars?.()
    if (!sb?.vTrack || !sb?.vThumb) return
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
    const x = e.clientX - rect.left
    const trackSpan = sb.hTrack.w
    const newLeft = Math.max(0, Math.min(trackSpan - sb.hThumb.w, x - sb.hTrack.x - dragGrabOffset))
    applyHThumb(newLeft)
    schedule()
    return
  }
  if (dragMode.value === 'colheader') {
    const sb = rendererRef.value?.getScrollbars?.()
    const rightBound = sb?.vTrack ? sb.vTrack.x : canvasRef.value!.clientWidth
    // Only respond while within header band horizontally, but allow dragging beyond bounds to clamp
    const canvas = canvasRef.value!
    const { widthAvail: viewportContentWidth } = computeAvailViewport(canvas)
    const contentWidth = sheet.cols * DEFAULT_COL_W + [...sheet.colWidths.entries()].reduce((acc, [c, w]) => acc + (w - DEFAULT_COL_W), 0)
    const maxX = Math.max(0, contentWidth - viewportContentWidth)
    const sX = Math.max(0, Math.min(scroll.x, maxX))
    const cx = Math.max(HEADER_COL_W, Math.min(x, rightBound)) - HEADER_COL_W + sX
    const cumWidth = (i: number): number => {
      let base = i * DEFAULT_COL_W
      if (sheet.colWidths.size) for (const [c, w] of sheet.colWidths) { if (c < i) base += (w - DEFAULT_COL_W) }
      return base
    }
    const findIndexByPos = (pos: number, count: number, cumFn: (i: number) => number): number => {
      const total = cumFn(count)
      const p = Math.max(0, Math.min(total - 1, pos))
      let lo = 0, hi = count
      while (lo < hi) {
        const mid = (lo + hi) >>> 1
        const start = cumFn(mid)
        const end = cumFn(mid + 1)
        if (p < start) hi = mid
        else if (p >= end) lo = mid + 1
        else return mid
      }
      return Math.min(count - 1, lo)
    }
    const startCol = Math.min(selection.value!.c0, selection.value!.c1)
    const endCol = findIndexByPos(cx, sheet.cols, cumWidth)
    selection.value = { r0: 0, r1: sheet.rows - 1, c0: startCol, c1: endCol }
    schedule()
    return
  }
  if (dragMode.value === 'rowheader') {
    const sb = rendererRef.value?.getScrollbars?.()
    const bottomBound = sb?.hTrack ? sb.hTrack.y : canvasRef.value!.clientHeight
    const canvas = canvasRef.value!
    const { heightAvail: viewportContentHeight } = computeAvailViewport(canvas)
    const contentHeight = sheet.rows * DEFAULT_ROW_H + [...sheet.rowHeights.entries()].reduce((acc, [r, h]) => acc + (h - DEFAULT_ROW_H), 0)
    const maxY = Math.max(0, contentHeight - viewportContentHeight)
    const sY = Math.max(0, Math.min(scroll.y, maxY))
    const cy = Math.max(HEADER_ROW_H, Math.min(y, bottomBound)) - HEADER_ROW_H + sY
    const cumHeight = (i: number): number => {
      let base = i * DEFAULT_ROW_H
      if (sheet.rowHeights.size) for (const [r, h] of sheet.rowHeights) { if (r < i) base += (h - DEFAULT_ROW_H) }
      return base
    }
    const findIndexByPos = (pos: number, count: number, cumFn: (i: number) => number): number => {
      const total = cumFn(count)
      const p = Math.max(0, Math.min(total - 1, pos))
      let lo = 0, hi = count
      while (lo < hi) {
        const mid = (lo + hi) >>> 1
        const start = cumFn(mid)
        const end = cumFn(mid + 1)
        if (p < start) hi = mid
        else if (p >= end) lo = mid + 1
        else return mid
      }
      return Math.min(count - 1, lo)
    }
    const startRow = Math.min(selection.value!.r0, selection.value!.r1)
    const endRow = findIndexByPos(cy, sheet.rows, cumHeight)
    selection.value = { r0: startRow, r1: endRow, c0: 0, c1: sheet.cols - 1 }
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
  rendererRef.value?.setScrollbarState?.({ vActive: false, hActive: false })
  schedule()
}

function onPointerLeave() {
  const canvas = canvasRef.value!
  ;(canvas.parentElement as HTMLElement).style.cursor = 'default'
  rendererRef.value?.setScrollbarState?.({ vHover: false, hHover: false, vActive: false, hActive: false })
  schedule()
}

onMounted(() => {
  if (!canvasRef.value) return
  rendererRef.value = new CanvasRenderer(canvasRef.value, { defaultColWidth: DEFAULT_COL_W, defaultRowHeight: DEFAULT_ROW_H, overscan: 2, headerColWidth: HEADER_COL_W, headerRowHeight: HEADER_ROW_H })
  schedule()
  window.addEventListener('resize', schedule)
  canvasRef.value.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  canvasRef.value.addEventListener('pointerleave', onPointerLeave)
  canvasRef.value.addEventListener('wheel', onWheel, { passive: false })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', schedule)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  canvasRef.value?.removeEventListener('pointerleave', onPointerLeave)
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
  const { widthAvail: viewportContentWidth, heightAvail: viewportContentHeight } = computeAvailViewport(canvas)
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
  const { heightAvail: viewportContentHeight } = computeAvailViewport(canvas)
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
  const { widthAvail: viewportContentWidth } = computeAvailViewport(canvas)
  const contentWidth = sheet.cols * DEFAULT_COL_W + [...sheet.colWidths.entries()].reduce((acc, [c, w]) => acc + (w - DEFAULT_COL_W), 0)
  const maxScrollX = Math.max(0, contentWidth - viewportContentWidth)
  scroll.x = Math.max(0, Math.min(maxScrollX, Math.floor(frac * maxScrollX)))
}
</script>

<template>
  <div class="sheet-canvas" style="position: relative; width: 100%; height: 100%; overflow: hidden;">
    <canvas ref="canvasRef" style="display:block; width:100%; height:100%;"></canvas>
  </div>
</template>

<style scoped>
.sheet-canvas { background: #fff; }
</style>
