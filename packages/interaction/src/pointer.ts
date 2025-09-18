import type { Context, State } from './types'
import { posToCell, colAtX, rowAtY } from './hit'
import { applyHThumb, applyVThumb } from './scrollbar'

export function createPointerHandlers(ctx: Context, state: State, deps: { schedule: () => void }) {
  function onPointerDown(e: PointerEvent) {
    try { ctx.canvas.setPointerCapture(e.pointerId) } catch {}
    const rect = ctx.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const sb = ctx.renderer.getScrollbars?.()
    if (ctx.debug) console.log('[sheet] down', { x: Math.floor(x), y: Math.floor(y), sb })
    // Vertical scrollbar
    if (sb?.vTrack && x >= sb.vTrack.x && x <= sb.vTrack.x + sb.vTrack.w && y >= sb.vTrack.y && y <= sb.vTrack.y + sb.vTrack.h) {
      state.dragMode = 'vscroll'
      ctx.renderer.setScrollbarState?.({ vActive: true })
      if (sb.vThumb && y >= sb.vThumb.y && y <= sb.vThumb.y + sb.vThumb.h) {
        state.dragGrabOffset = y - sb.vThumb.y
      } else {
        const trackSpan = sb.vTrack.h
        const thumbLen = sb.vThumb ? sb.vThumb.h : 0
        const newTop = Math.max(0, Math.min(trackSpan - thumbLen, y - sb.vTrack.y - thumbLen / 2))
        applyVThumb(ctx, state, newTop)
      }
      deps.schedule()
      if (ctx.debug) console.log('[sheet] hit v scrollbar -> drag')
      return
    }
    // Horizontal scrollbar
    if (sb?.hTrack && x >= sb.hTrack.x && x <= sb.hTrack.x + sb.hTrack.w && y >= sb.hTrack.y && y <= sb.hTrack.y + sb.hTrack.h) {
      state.dragMode = 'hscroll'
      ctx.renderer.setScrollbarState?.({ hActive: true })
      if (sb.hThumb && x >= sb.hThumb.x && x <= sb.hThumb.x + sb.hThumb.w) {
        state.dragGrabOffset = x - sb.hThumb.x
      } else {
        const trackSpan = sb.hTrack.w
        const thumbLen = sb.hThumb ? sb.hThumb.w : 0
        const newLeft = Math.max(0, Math.min(trackSpan - thumbLen, x - sb.hTrack.x - thumbLen / 2))
        applyHThumb(ctx, state, newLeft)
      }
      deps.schedule()
      if (ctx.debug) console.log('[sheet] hit h scrollbar -> drag')
      return
    }
    // Corner select-all
    if (x >= 0 && x < ctx.metrics.headerColWidth && y >= 0 && y < ctx.metrics.headerRowHeight) {
      state.selection = { r0: 0, c0: 0, r1: ctx.sheet.rows - 1, c1: ctx.sheet.cols - 1 }
      state.dragMode = 'none'
      deps.schedule()
      if (ctx.debug) console.log('[sheet] hit corner -> select all')
      return
    }
    // Column header band
    const rightBound = sb?.vTrack ? sb.vTrack.x : ctx.canvas.clientWidth
    if (y >= 0 && y < ctx.metrics.headerRowHeight && x >= ctx.metrics.headerColWidth && x < rightBound) {
      const col = colAtX(ctx, state, x)
      state.selection = { r0: 0, r1: ctx.sheet.rows - 1, c0: col, c1: col }
      state.dragMode = 'colheader'
      deps.schedule()
      if (ctx.debug) console.log('[sheet] hit col header -> start drag select col', { col })
      return
    }
    // Row header band
    const bottomBound = sb?.hTrack ? sb.hTrack.y : ctx.canvas.clientHeight
    if (x >= 0 && x < ctx.metrics.headerColWidth && y >= ctx.metrics.headerRowHeight && y < bottomBound) {
      const row = rowAtY(ctx, state, y)
      state.selection = { r0: row, r1: row, c0: 0, c1: ctx.sheet.cols - 1 }
      state.dragMode = 'rowheader'
      deps.schedule()
      if (ctx.debug) console.log('[sheet] hit row header -> start drag select row', { row })
      return
    }
    // Default cell selection
    const cell = posToCell(ctx, state, e.clientX, e.clientY)
    if (!cell) return
    state.selection = { r0: cell.r, c0: cell.c, r1: cell.r, c1: cell.c }
    state.dragMode = 'select'
    deps.schedule()
    if (ctx.debug) console.log('[sheet] hit cell -> start select', cell)
  }

  function onPointerMove(e: PointerEvent) {
    const rect = ctx.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const sb0 = ctx.renderer.getScrollbars?.()
    let cursor = 'default'
    if (state.dragMode === 'none' && sb0) {
      const inV = !!(sb0.vTrack && x >= sb0.vTrack.x && x <= sb0.vTrack.x + sb0.vTrack.w && y >= sb0.vTrack.y && y <= sb0.vTrack.y + sb0.vTrack.h)
      const inH = !!(sb0.hTrack && x >= sb0.hTrack.x && x <= sb0.hTrack.x + sb0.hTrack.w && y >= sb0.hTrack.y && y <= sb0.hTrack.y + sb0.hTrack.h)
      ctx.renderer.setScrollbarState?.({ vHover: inV, hHover: inH })
      deps.schedule()
      if (inV || inH) cursor = 'pointer'
    }
    ;(ctx.canvas.parentElement as HTMLElement).style.cursor = cursor
    if (state.dragMode === 'vscroll') {
      const sb = ctx.renderer.getScrollbars?.()
      if (!sb?.vTrack || !sb?.vThumb) return
      const y = e.clientY - rect.top
      const trackSpan = sb.vTrack.h
      const newTop = Math.max(0, Math.min(trackSpan - sb.vThumb.h, y - sb.vTrack.y - state.dragGrabOffset))
      applyVThumb(ctx, state, newTop)
      deps.schedule()
      if (ctx.debug) console.log('[sheet] drag vscroll', { newTop })
      return
    }
    if (state.dragMode === 'hscroll') {
      const sb = ctx.renderer.getScrollbars?.()
      if (!sb?.hTrack || !sb?.hThumb) return
      const x = e.clientX - rect.left
      const trackSpan = sb.hTrack.w
      const newLeft = Math.max(0, Math.min(trackSpan - sb.hThumb.w, x - sb.hTrack.x - state.dragGrabOffset))
      applyHThumb(ctx, state, newLeft)
      deps.schedule()
      if (ctx.debug) console.log('[sheet] drag hscroll', { newLeft })
      return
    }
    if (state.dragMode === 'colheader') {
      const sb = ctx.renderer.getScrollbars?.()
      const rightBound = sb?.vTrack ? sb.vTrack.x : ctx.canvas.clientWidth
      const clampedX = Math.max(ctx.metrics.headerColWidth, Math.min(x, rightBound))
      const startCol = state.selection ? Math.min(state.selection.c0, state.selection.c1) : 0
      const endCol = colAtX(ctx, state, clampedX)
      state.selection = { r0: 0, r1: ctx.sheet.rows - 1, c0: startCol, c1: endCol }
      deps.schedule()
      if (ctx.debug) console.log('[sheet] drag col header', { startCol, endCol })
      return
    }
    if (state.dragMode === 'rowheader') {
      const sb = ctx.renderer.getScrollbars?.()
      const bottomBound = sb?.hTrack ? sb.hTrack.y : ctx.canvas.clientHeight
      const clampedY = Math.max(ctx.metrics.headerRowHeight, Math.min(y, bottomBound))
      const startRow = state.selection ? Math.min(state.selection.r0, state.selection.r1) : 0
      const endRow = rowAtY(ctx, state, clampedY)
      state.selection = { r0: startRow, r1: endRow, c0: 0, c1: ctx.sheet.cols - 1 }
      deps.schedule()
      if (ctx.debug) console.log('[sheet] drag row header', { startRow, endRow })
      return
    }
    if (state.dragMode === 'select') {
      if (!state.selection) return
      const cell = posToCell(ctx, state, e.clientX, e.clientY)
      if (!cell) return
      state.selection = { ...state.selection, r1: cell.r, c1: cell.c }
      deps.schedule()
      if (ctx.debug) console.log('[sheet] drag select to', cell)
    }
  }

  function onPointerUp(e?: PointerEvent) {
    if (e) { try { ctx.canvas.releasePointerCapture(e.pointerId) } catch {} }
    state.dragMode = 'none'
    ctx.renderer.setScrollbarState?.({ vActive: false, hActive: false })
    deps.schedule()
    if (ctx.debug) console.log('[sheet] up')
  }

  function onPointerLeave() {
    ;(ctx.canvas.parentElement as HTMLElement).style.cursor = 'default'
    ctx.renderer.setScrollbarState?.({ vHover: false, hHover: false, vActive: false, hActive: false })
    deps.schedule()
    if (ctx.debug) console.log('[sheet] leave')
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerLeave }
}

