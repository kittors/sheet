<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { CanvasRenderer } from '@sheet/renderer'
import type { HeaderStyle, HeaderLabels, WorkerRenderer } from '@sheet/renderer'
import type { Sheet } from '@sheet/core'

// DOM/Renderer refs exposed to parent so interaction layer can attach
const canvasRef = ref<HTMLCanvasElement | null>(null)
// A hidden/native scroll host that captures OS momentum and provides scrollTop/Left
const scrollHostRef = ref<HTMLDivElement | null>(null)
const scrollSpacerRef = ref<HTMLDivElement | null>(null)
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
  headerStyle?: Partial<HeaderStyle>
  headerLabels?: HeaderLabels
  // Infinite scroll: dynamically grow rows/cols as user scrolls
  infiniteScroll?: boolean
}>()

// Use external sheet directly
const sheet = props.sheet

// Minimal initial paint so UI不依赖交互层也能显示基础网格/表头
function renderOnce() {
  const canvas = canvasRef.value
  const renderer = rendererRef.value
  if (!canvas || !renderer) return
  // Measure the scroll host that anchors the canvas overlay
  const host = scrollHostRef.value
  const rect = host?.getBoundingClientRect()
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
  // Sync scroll spacer to renderer metrics so native scroll range matches custom logic
  syncScrollSpacer()
}

type RendererLike = CanvasRenderer | WorkerRenderer
const emit = defineEmits<{
  (e: 'ready', payload: {
    canvas: HTMLCanvasElement
    renderer: RendererLike
    sheet: Sheet
    scrollHost?: HTMLElement | null
    infiniteScroll?: boolean
  }): void
}>()

// Compute content size and update the hidden scroll spacer so that native scrollTop/Left
// exactly matches the renderer's logical scroll range. We add header offsets and conditional
// scrollbar thickness to the spacer so maxScroll = content - avail, consistent with renderer.
function syncScrollSpacer() {
  const host = scrollHostRef.value
  const spacer = scrollSpacerRef.value
  const r = rendererRef.value
  if (!host || !spacer || !r) return
  // Prefer renderer's cached metrics for perfect match
  const m = r.getViewportMetrics?.()
  const headerX = r.opts.headerColWidth ?? props.headerColWidth ?? 48
  const headerY = r.opts.headerRowHeight ?? props.headerRowHeight ?? 28
  const thickness = r.opts.scrollbarThickness ?? props.scrollbarThickness ?? 12
  if (m) {
    const vScrollable = m.contentHeight > m.heightAvail
    const hScrollable = m.contentWidth > m.widthAvail
    const w = headerX + m.contentWidth + (vScrollable ? thickness : 0)
    const h = headerY + m.contentHeight + (hScrollable ? thickness : 0)
    // Only touch DOM when changed to avoid layout churn
    const curW = (spacer.style.width || '').endsWith('px')
      ? parseInt(spacer.style.width)
      : 0
    const curH = (spacer.style.height || '').endsWith('px')
      ? parseInt(spacer.style.height)
      : 0
    if (curW !== w) spacer.style.width = `${w}px`
    if (curH !== h) spacer.style.height = `${h}px`
    return
  }
  // Fallback: compute from DOM sizes + sheet model (used before first paint)
  const hostRect = host.getBoundingClientRect()
  const baseW = Math.max(0, Math.floor(hostRect.width))
  const baseH = Math.max(0, Math.floor(hostRect.height))
  const defaultColWidth = props.defaultColWidth ?? 100
  const defaultRowHeight = props.defaultRowHeight ?? 24
  let contentWidth = sheet.cols * defaultColWidth
  if (sheet.colWidths.size)
    // Only the width delta matters here; avoid unused key var
    for (const w of sheet.colWidths.values()) contentWidth += w - defaultColWidth
  let contentHeight = sheet.rows * defaultRowHeight
  if (sheet.rowHeights.size)
    for (const h of sheet.rowHeights.values()) contentHeight += h - defaultRowHeight
  // Resolve interdependency between v/h scrollbars (mirror of interaction/viewport.ts)
  let widthAvail = Math.max(0, baseW - headerX)
  let heightAvail = Math.max(0, baseH - headerY)
  let vScrollable = contentHeight > heightAvail
  let hScrollable = contentWidth > widthAvail
  for (let i = 0; i < 3; i++) {
    const nextW = Math.max(0, baseW - headerX - (vScrollable ? thickness : 0))
    const nextH = Math.max(0, baseH - headerY - (hScrollable ? thickness : 0))
    const nextV = contentHeight > nextH
    const nextHFlag = contentWidth > nextW
    if (
      nextW === widthAvail &&
      nextH === heightAvail &&
      nextV === vScrollable &&
      nextHFlag === hScrollable
    )
      break
    widthAvail = nextW
    heightAvail = nextH
    vScrollable = nextV
    hScrollable = nextHFlag
  }
  const w = headerX + contentWidth + (vScrollable ? thickness : 0)
  const h = headerY + contentHeight + (hScrollable ? thickness : 0)
  spacer.style.width = `${w}px`
  spacer.style.height = `${h}px`
}

onMounted(() => {
  if (!canvasRef.value) return
  // Keep defaults consistent with renderer's default appearance
  // Prefer worker renderer when OffscreenCanvas is supported
  // Keep main-thread renderer for now (stable across browsers). Worker path can be re-enabled later.
  rendererRef.value = new CanvasRenderer(canvasRef.value, {
    defaultColWidth: props.defaultColWidth ?? 100,
    defaultRowHeight: props.defaultRowHeight ?? 24,
    overscan: props.overscan ?? 1,
    headerColWidth: props.headerColWidth ?? 48,
    headerRowHeight: props.headerRowHeight ?? 28,
    // Thicker scrollbars by default for easier hit/drag
    scrollbarThickness: props.scrollbarThickness ?? 16,
    headerStyle: props.headerStyle,
    headerLabels: props.headerLabels,
    infiniteScroll: !!props.infiniteScroll,
  })
  // Do one passive paint; 交互包挂载后会接管渲染循环
  requestAnimationFrame(() => {
    renderOnce()
    // ensure scroll spacer sized after first paint
    syncScrollSpacer()
  })
  // Sync DPR once at mount for worker renderer (no-op for CanvasRenderer)
  type DprCapable = { setDpr: (dpr: number) => void }
  ;(rendererRef.value as unknown as Partial<DprCapable>).setDpr?.(
    window.devicePixelRatio || 1,
  )
  // Auto-sync DPR on zoom/monitor change
  const dprCap = rendererRef.value as unknown as Partial<DprCapable>
  const syncDpr = () => {
    dprCap.setDpr?.(window.devicePixelRatio || 1)
  }
  const onResize = () => syncDpr()
  window.addEventListener('resize', onResize)
  const dpps = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4]
  const mqls: MediaQueryList[] = []
  const mqlHandlers: Array<{ mql: MediaQueryList; fn: () => void }> = []
  for (const v of dpps) {
    const mql = window.matchMedia(`(resolution: ${v}dppx)`)
    const fn = () => syncDpr()
    mql.addEventListener?.('change', fn)
    // Legacy Safari fallback (deprecated API, still present in types)
    mql.addListener?.(fn)
    mqls.push(mql)
    mqlHandlers.push({ mql, fn })
  }
  const onOrientation = () => syncDpr()
  window.addEventListener('orientationchange', onOrientation)
  onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize)
    window.removeEventListener('orientationchange', onOrientation)
    for (const { mql, fn } of mqlHandlers) {
      mql.removeEventListener?.('change', fn)
      // Legacy Safari fallback
      mql.removeListener?.(fn)
    }
  })
  // Notify parent that canvas+renderer+sheet are ready
  emit('ready', {
    canvas: canvasRef.value,
    renderer: rendererRef.value as unknown as RendererLike,
    sheet,
    scrollHost: scrollHostRef.value,
    infiniteScroll: !!props.infiniteScroll,
  })
  // After parent (interaction) attaches, adjust scroll spacer once more (in case sizes changed)
  nextTick(() => syncScrollSpacer())

  // With canvas inside the scroll host (sticky), let wheel bubble to the host
  // so the browser drives momentum natively.
})

// Expose minimal surface for interaction package to hook into
defineExpose({ canvasRef, rendererRef, sheet })
</script>

<template>
  <div class="sheet-canvas">
    <!-- Native scroll host captures touchpad momentum; scrollbars are hidden. -->
    <div ref="scrollHostRef" class="sheet-scroll-host">
      <!-- Canvas overlay pinned inside scroll host so wheel defaults scroll the host -->
      <canvas ref="canvasRef" class="sheet-canvas-layer"></canvas>
      <!-- Spacer defines scrollable extent (content size + headers + conditional bars) -->
      <div ref="scrollSpacerRef" class="sheet-scroll-spacer" />
    </div>
  </div>
</template>

<style scoped>
.sheet-canvas {
  background: #fff;
  touch-action: none;
  user-select: none;
  /* Prevent wheel from bubbling/triggering page scroll effects and improve scroll feel */
  overscroll-behavior: contain;
  position: relative;
  width: 100%;
  height: 100%;
}

/* Hidden/native scroll host (fills container) */
.sheet-scroll-host {
  position: absolute;
  inset: 0;
  overflow: auto;
  z-index: 0;
  overscroll-behavior: contain;
  /* Hide native scrollbars across browsers; momentum still works */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE 10+ */
}
.sheet-scroll-host::-webkit-scrollbar {
  display: none; /* WebKit */
  width: 0;
  height: 0;
}

/* Spacer gets width/height set in JS to define scroll range */
.sheet-scroll-spacer {
  position: relative;
  z-index: 0;
  width: 1px;
  height: 1px;
}

/* Canvas overlay is pinned within the scroll host and must not scroll with content.
   Use sticky so it stays at the top-left of the scroll viewport; the JS sets
   its pixel size to match the viewport, so no CSS width/height here. */
.sheet-canvas-layer {
  position: sticky;
  top: 0;
  left: 0;
  display: block;
  z-index: 1; /* above spacer */
}
</style>
