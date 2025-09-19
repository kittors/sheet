import type { Context, State } from '../types'
import { posToCell, colAtX, rowAtY } from '../hit'
import { expandSelectionByMerges as expandSel } from '../merge-util'

export function createSelectionHandlers(
  ctx: Context,
  state: State,
  deps: {
    schedule: () => void
    previewAt?: (r: number, c: number) => void
    prepareImeAt?: (r: number, c: number) => void
    clearPreview?: () => void
    updateAutoScrollVelocity: (x: number, y: number) => void
  },
) {
  function handlePointerDown(x: number, y: number, clientX: number, clientY: number): boolean {
    const sb = ctx.renderer.getScrollbars?.()
    // Corner select-all
    if (x >= 0 && x < ctx.metrics.headerColWidth && y >= 0 && y < ctx.metrics.headerRowHeight) {
      state.selection = { r0: 0, c0: 0, r1: ctx.sheet.rows - 1, c1: ctx.sheet.cols - 1 }
      state.selectAnchor = { r: 0, c: 0 }
      state.dragMode = 'none'
      deps.clearPreview?.(); deps.schedule(); return true
    }
    // Column header band
    const rightBound = sb?.vTrack ? sb.vTrack.x : ctx.canvas.clientWidth
    if (y >= 0 && y < ctx.metrics.headerRowHeight && x >= ctx.metrics.headerColWidth && x < rightBound) {
      const col = colAtX(ctx, state, x)
      state.selection = { r0: 0, r1: ctx.sheet.rows - 1, c0: col, c1: col }
      state.selectAnchor = { r: 0, c: col }
      state.dragMode = 'colheader'
      deps.clearPreview?.(); deps.schedule(); return true
    }
    // Row header band
    const bottomBound = sb?.hTrack ? sb.hTrack.y : ctx.canvas.clientHeight
    if (x >= 0 && x < ctx.metrics.headerColWidth && y >= ctx.metrics.headerRowHeight && y < bottomBound) {
      const row = rowAtY(ctx, state, y)
      state.selection = { r0: row, r1: row, c0: 0, c1: ctx.sheet.cols - 1 }
      state.selectAnchor = { r: row, c: 0 }
      state.dragMode = 'rowheader'
      deps.clearPreview?.(); deps.schedule(); return true
    }
    // Default cell selection
    const cell = posToCell(ctx, state, clientX, clientY)
    if (!cell) return false
    state.selectAnchor = { r: cell.r, c: cell.c }
    const m = ctx.sheet.getMergeAt?.(cell.r, cell.c)
    if (m) {
      state.selection = { r0: m.r, c0: m.c, r1: m.r + m.rows - 1, c1: m.c + m.cols - 1 }
      deps.previewAt?.(m.r, m.c); deps.prepareImeAt?.(m.r, m.c)
    } else {
      state.selection = { r0: cell.r, c0: cell.c, r1: cell.r, c1: cell.c }
      deps.previewAt?.(cell.r, cell.c); deps.prepareImeAt?.(cell.r, cell.c)
    }
    state.dragMode = 'select'
    deps.schedule(); deps.updateAutoScrollVelocity(x, y)
    return true
  }

  function handlePointerMove(x: number, y: number, e: PointerEvent): boolean {
    if (state.dragMode === 'colheader') {
      const sb = ctx.renderer.getScrollbars?.()
      const rightBound = sb?.vTrack ? sb.vTrack.x : ctx.canvas.clientWidth
      const clampedX = Math.max(ctx.metrics.headerColWidth, Math.min(x, rightBound))
      const startCol = state.selection ? Math.min(state.selection.c0, state.selection.c1) : 0
      const endCol = colAtX(ctx, state, clampedX)
      state.selection = { r0: 0, r1: ctx.sheet.rows - 1, c0: startCol, c1: endCol }
      deps.schedule(); deps.updateAutoScrollVelocity(x, y); return true
    }
    if (state.dragMode === 'rowheader') {
      const sb = ctx.renderer.getScrollbars?.()
      const bottomBound = sb?.hTrack ? sb.hTrack.y : ctx.canvas.clientHeight
      const clampedY = Math.max(ctx.metrics.headerRowHeight, Math.min(y, bottomBound))
      const startRow = state.selection ? Math.min(state.selection.r0, state.selection.r1) : 0
      const endRow = rowAtY(ctx, state, clampedY)
      state.selection = { r0: startRow, r1: endRow, c0: 0, c1: ctx.sheet.cols - 1 }
      deps.schedule(); deps.updateAutoScrollVelocity(x, y); return true
    }
    if (state.dragMode === 'select') {
      if (!state.selection) return true
      const cell = posToCell(ctx, state, e.clientX, e.clientY)
      if (cell) {
        const anchor = state.selectAnchor ?? { r: state.selection.r0, c: state.selection.c0 }
        const next = { r0: anchor.r, c0: anchor.c, r1: cell.r, c1: cell.c }
        expandSel(ctx, next)
        state.selection = next
        deps.schedule()
      }
      deps.updateAutoScrollVelocity(x, y)
      return true
    }
    return false
  }

  return { handlePointerDown, handlePointerMove }
}
