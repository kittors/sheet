import type { Context, State } from './types'

export function createWheelHandler(
  ctx: Context,
  state: State,
  deps: { schedule: () => void; normalizeScroll: (prevX: number, prevY: number) => boolean },
) {
  const DOM_DELTA_LINE = 1
  const DOM_DELTA_PAGE = 2
  // Keep horizontal shift reasonably fast but not excessive (3 felt too slippery on trackpads)
  const SHIFT_HORIZONTAL_MULTIPLIER = 2

  function toPixels(mode: number, delta: number, lineSize: number, pageSize: number) {
    if (!delta) return 0
    switch (mode) {
      case DOM_DELTA_LINE:
        return delta * lineSize
      case DOM_DELTA_PAGE:
        return delta * pageSize
      default:
        return delta
    }
  }

  // Accumulate deltas and apply in next RAF to keep handler minimal
  let accX = 0
  let accY = 0
  let flushing = false
  function flush() {
    flushing = false
    if (!accX && !accY) return
    const prevX = state.scroll.x
    const prevY = state.scroll.y
    state.scroll.x = prevX + accX
    state.scroll.y = prevY + accY
    accX = 0
    accY = 0
    if (deps.normalizeScroll(prevX, prevY)) deps.schedule()
  }

  function onWheel(e: WheelEvent) {
    // Ignore pinch-zoom (ctrl+wheel) – let browser handle it natively
    if (e.ctrlKey) return

    let deltaX = e.deltaX
    let deltaY = e.deltaY

    if (e.shiftKey && Math.abs(deltaY) > Math.abs(deltaX)) {
      deltaX = deltaY * SHIFT_HORIZONTAL_MULTIPLIER
      deltaY = 0
    }

    const mode = e.deltaMode
    // Prefer cached viewport metrics from renderer to avoid layout thrash while scrolling
    const vp = ctx.renderer.getViewportMetrics?.()
    const pageW = (vp?.viewportWidth ?? ctx.canvas.clientWidth) || ctx.metrics.defaultColWidth * 20
    const pageH = (vp?.viewportHeight ?? ctx.canvas.clientHeight) || ctx.metrics.defaultRowHeight * 20
    const pixelX = toPixels(mode, deltaX, ctx.metrics.defaultColWidth, pageW)
    const pixelY = toPixels(mode, deltaY, ctx.metrics.defaultRowHeight, pageH)

    if (!pixelX && !pixelY) return
    // Prevent page from scrolling; canvas owns the scroll
    e.preventDefault()
    // Accumulate and flush in next RAF
    accX += pixelX
    accY += pixelY
    // Kick a UI-only quick paint immediately to keep scrollbars/headers in sync.
    // Kick a lightweight UI repaint (headers/scrollbars) to keep in sync while accumulating.
    // Both CanvasRenderer and WorkerRenderer support `render(..., 'ui')`.
    const predX = state.scroll.x + accX
    const predY = state.scroll.y + accY
    ctx.renderer.render(ctx.sheet, predX, predY, 'ui')
    if (!flushing) {
      flushing = true
      requestAnimationFrame(flush)
    }
  }
  return { onWheel }
}
