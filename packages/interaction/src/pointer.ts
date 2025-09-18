import type { Context, State } from './types'
import { posToCell, colAtX, rowAtY } from './hit'
import { applyHThumb, applyVThumb } from './scrollbar'
import { computeAvailViewport } from './viewport'

export function createPointerHandlers(ctx: Context, state: State, deps: { schedule: () => void }) {
  function stopAutoScroll() {
    if (state.autoRaf) { cancelAnimationFrame(state.autoRaf); state.autoRaf = 0 }
    state.autoVX = 0
    state.autoVY = 0
  }

  function startAutoScroll() {
    if (state.autoRaf) return
    const step = () => {
      state.autoRaf = 0
      if (state.dragMode === 'none') { stopAutoScroll(); return }
      if (state.autoVX === 0 && state.autoVY === 0) { stopAutoScroll(); return }

      const { widthAvail, heightAvail, contentWidth, contentHeight } = computeAvailViewport(ctx)
      const maxX = Math.max(0, contentWidth - widthAvail)
      const maxY = Math.max(0, contentHeight - heightAvail)
      state.scroll.x = Math.max(0, Math.min(maxX, state.scroll.x + state.autoVX))
      state.scroll.y = Math.max(0, Math.min(maxY, state.scroll.y + state.autoVY))

      const rect = ctx.canvas.getBoundingClientRect()
      const sb = ctx.renderer.getScrollbars?.()
      const contentLeft = ctx.metrics.headerColWidth
      const contentRight = sb?.vTrack ? sb.vTrack.x : ctx.canvas.clientWidth
      const contentTop = ctx.metrics.headerRowHeight
      const contentBottom = sb?.hTrack ? sb.hTrack.y : ctx.canvas.clientHeight
      const clampX = Math.max(contentLeft, Math.min(state.lastClientX - rect.left, contentRight - 1))
      const clampY = Math.max(contentTop, Math.min(state.lastClientY - rect.top, contentBottom - 1))
      const clientX = rect.left + clampX
      const clientY = rect.top + clampY

      if (state.dragMode === 'select') {
        const cell = posToCell(ctx, state, clientX, clientY)
        if (cell && state.selection) state.selection = { ...state.selection, r1: cell.r, c1: cell.c }
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
    const speed = (d: number) => Math.min(40, 4 + d * 0.25)
    let vx = 0, vy = 0
    if (state.dragMode === 'select' || state.dragMode === 'colheader') {
      if (x > rightBound) vx = speed(x - rightBound)
      else if (x < leftBound) vx = -speed(leftBound - x)
    }
    if (state.dragMode === 'select' || state.dragMode === 'rowheader') {
      if (y > bottomBound) vy = speed(y - bottomBound)
      else if (y < topBound) vy = -speed(topBound - y)
    }
    state.autoVX = Math.trunc(vx)
    state.autoVY = Math.trunc(vy)
    if (state.autoVX !== 0 || state.autoVY !== 0) startAutoScroll()
    else stopAutoScroll()
  }

  function onPointerDown(e: PointerEvent) {
    try { ctx.canvas.setPointerCapture(e.pointerId) } catch {}
    const rect = ctx.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    state.lastClientX = e.clientX
    state.lastClientY = e.clientY
    const sb = ctx.renderer.getScrollbars?.()

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
      return
    }
    // Corner select-all
    if (x >= 0 && x < ctx.metrics.headerColWidth && y >= 0 && y < ctx.metrics.headerRowHeight) {
      state.selection = { r0: 0, c0: 0, r1: ctx.sheet.rows - 1, c1: ctx.sheet.cols - 1 }
      state.dragMode = 'none'
      deps.schedule()
      return
    }
    // Column header band
    const rightBound = sb?.vTrack ? sb.vTrack.x : ctx.canvas.clientWidth
    if (y >= 0 && y < ctx.metrics.headerRowHeight && x >= ctx.metrics.headerColWidth && x < rightBound) {
      const col = colAtX(ctx, state, x)
      state.selection = { r0: 0, r1: ctx.sheet.rows - 1, c0: col, c1: col }
      state.dragMode = 'colheader'
      deps.schedule()
      return
    }
    // Row header band
    const bottomBound = sb?.hTrack ? sb.hTrack.y : ctx.canvas.clientHeight
    if (x >= 0 && x < ctx.metrics.headerColWidth && y >= ctx.metrics.headerRowHeight && y < bottomBound) {
      const row = rowAtY(ctx, state, y)
      state.selection = { r0: row, r1: row, c0: 0, c1: ctx.sheet.cols - 1 }
      state.dragMode = 'rowheader'
      deps.schedule()
      return
    }
    // Default cell selection
    const cell = posToCell(ctx, state, e.clientX, e.clientY)
    if (!cell) return
    state.selection = { r0: cell.r, c0: cell.c, r1: cell.r, c1: cell.c }
    state.dragMode = 'select'
    deps.schedule()
  }

  function onPointerMove(e: PointerEvent) {
    const rect = ctx.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    state.lastClientX = e.clientX
    state.lastClientY = e.clientY
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
      // autoscroll if beyond edges
      updateAutoScrollVelocity(x, y)
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
      updateAutoScrollVelocity(x, y)
      return
    }
    if (state.dragMode === 'select') {
      if (!state.selection) return
      const cell = posToCell(ctx, state, e.clientX, e.clientY)
      if (cell) {
        state.selection = { ...state.selection, r1: cell.r, c1: cell.c }
        deps.schedule()
      }
      updateAutoScrollVelocity(x, y)
    }
  }

  function onPointerUp(e?: PointerEvent) {
    if (e) { try { ctx.canvas.releasePointerCapture(e.pointerId) } catch {} }
    state.dragMode = 'none'
    ctx.renderer.setScrollbarState?.({ vActive: false, hActive: false })
    deps.schedule()
    stopAutoScroll()
  }

  function onPointerLeave() {
    ;(ctx.canvas.parentElement as HTMLElement).style.cursor = 'default'
    ctx.renderer.setScrollbarState?.({ vHover: false, hHover: false, vActive: false, hActive: false })
    deps.schedule()
    stopAutoScroll()
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerLeave }
}
