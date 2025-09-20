import type { Context, State } from '../types'
import { posToCell, colAtX, rowAtY } from '../hit'
import { computeAvailViewport } from '../viewport'
import { expandSelectionByMerges as expandSel } from '../merge-util'

export function createAutoScroll(
  ctx: Context,
  state: State,
  deps: {
    schedule: () => void
    config?: {
      edgeMargin?: number
      maxV?: number
      ease?: number
      stopThreshold?: number
      dtClampMin?: number
      dtClampMax?: number
    }
  },
) {
  const edgeMargin = deps.config?.edgeMargin ?? 48
  const maxV = deps.config?.maxV ?? 24
  const ease = deps.config?.ease ?? 0.2
  const stopThreshold = deps.config?.stopThreshold ?? 0.1
  const dtClampMin = deps.config?.dtClampMin ?? 0.5
  const dtClampMax = deps.config?.dtClampMax ?? 2
  function stopAutoScroll() {
    if (state.autoRaf) {
      cancelAnimationFrame(state.autoRaf)
      state.autoRaf = 0
    }
    state.autoVX = 0
    state.autoVY = 0
    state.autoTargetVX = 0
    state.autoTargetVY = 0
    state.autoTs = 0
  }

  function startAutoScroll() {
    if (state.autoRaf) return
    const step = () => {
      state.autoRaf = 0
      if (state.dragMode === 'none') {
        stopAutoScroll()
        return
      }
      // ease velocities toward targets (smooth start/stop)
      state.autoVX += (state.autoTargetVX - state.autoVX) * ease
      state.autoVY += (state.autoTargetVY - state.autoVY) * ease
      if (Math.abs(state.autoVX) < stopThreshold) state.autoVX = 0
      if (Math.abs(state.autoVY) < stopThreshold) state.autoVY = 0
      if (state.autoVX === 0 && state.autoVY === 0) {
        stopAutoScroll()
        return
      }

      const { widthAvail, heightAvail, contentWidth, contentHeight } = computeAvailViewport(ctx)
      const maxX = Math.max(0, contentWidth - widthAvail)
      const maxY = Math.max(0, contentHeight - heightAvail)
      const now = performance.now()
      const dt = state.autoTs
        ? Math.max(dtClampMin, Math.min(dtClampMax, (now - state.autoTs) / 16.67))
        : 1
      state.autoTs = now
      state.scroll.x = Math.max(0, Math.min(maxX, state.scroll.x + state.autoVX * dt))
      state.scroll.y = Math.max(0, Math.min(maxY, state.scroll.y + state.autoVY * dt))

      const rect = ctx.canvas.getBoundingClientRect()
      const sb = ctx.renderer.getScrollbars?.()
      const contentLeft = ctx.metrics.headerColWidth
      const contentRight = sb?.vTrack ? sb.vTrack.x : ctx.canvas.clientWidth
      const contentTop = ctx.metrics.headerRowHeight
      const contentBottom = sb?.hTrack ? sb.hTrack.y : ctx.canvas.clientHeight
      const clampX = Math.max(
        contentLeft,
        Math.min(state.lastClientX - rect.left, contentRight - 1),
      )
      const clampY = Math.max(contentTop, Math.min(state.lastClientY - rect.top, contentBottom - 1))
      const clientX = rect.left + clampX
      const clientY = rect.top + clampY

      if (state.dragMode === 'select') {
        const cell = posToCell(ctx, state, clientX, clientY)
        if (cell && state.selection) {
          const anchor = state.selectAnchor ?? { r: state.selection.r0, c: state.selection.c0 }
          const next = { r0: anchor.r, c0: anchor.c, r1: cell.r, c1: cell.c }
          // During auto-scroll dragging, also expand selection to include merges
          expandSel(ctx, next)
          state.selection = next
        }
      } else if (state.dragMode === 'colheader') {
        const endCol = colAtX(ctx, state, clampX)
        const startCol = state.selection ? Math.min(state.selection.c0, state.selection.c1) : 0
        state.selection = { r0: 0, r1: ctx.sheet.rows - 1, c0: startCol, c1: endCol }
      } else if (state.dragMode === 'rowheader') {
        const endRow = rowAtY(ctx, state, clampY)
        const startRow = state.selection ? Math.min(state.selection.r0, state.selection.r1) : 0
        state.selection = { r0: startRow, r1: endRow, c0: 0, c1: ctx.sheet.cols - 1 }
      }

      deps.schedule()
      state.autoRaf = requestAnimationFrame(step)
    }
    state.autoRaf = requestAnimationFrame(step)
  }

  function updateAutoScrollVelocity(x: number, y: number) {
    const sb = ctx.renderer.getScrollbars?.()
    const rightBound = sb?.vTrack ? sb.vTrack.x : ctx.canvas.clientWidth
    const bottomBound = sb?.hTrack ? sb.hTrack.y : ctx.canvas.clientHeight
    const leftBound = ctx.metrics.headerColWidth
    const topBound = ctx.metrics.headerRowHeight
    const margin = edgeMargin // px soft zone near edges
    const curve = (r: number) => r * r // ease-in
    let targetVX = 0,
      targetVY = 0
    if (state.dragMode === 'select' || state.dragMode === 'colheader') {
      if (x > rightBound - 1) {
        const r = Math.min(1, (x - (rightBound - margin)) / margin)
        targetVX = maxV * curve(Math.max(0, r))
      } else if (x < leftBound + 1) {
        const r = Math.min(1, (leftBound + margin - x) / margin)
        targetVX = -maxV * curve(Math.max(0, r))
      }
    }
    if (state.dragMode === 'select' || state.dragMode === 'rowheader') {
      if (y > bottomBound - 1) {
        const r = Math.min(1, (y - (bottomBound - margin)) / margin)
        targetVY = maxV * curve(Math.max(0, r))
      } else if (y < topBound + 1) {
        const r = Math.min(1, (topBound + margin - y) / margin)
        targetVY = -maxV * curve(Math.max(0, r))
      }
    }
    state.autoTargetVX = targetVX
    state.autoTargetVY = targetVY
    if (!state.autoRaf && (targetVX !== 0 || targetVY !== 0)) {
      state.autoTs = performance.now()
      startAutoScroll()
    } else if (targetVX === 0 && targetVY === 0) {
      // allow easing to bring velocity to zero, then stop in step
    }
  }

  return { stopAutoScroll, startAutoScroll, updateAutoScrollVelocity }
}
