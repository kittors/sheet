import type { Context, State } from '../types'
import { colLeftFor, rowTopFor } from '@sheet/shared-utils'

export function createCursorHandlers(
  ctx: Context,
  state: State,
  deps: {
    schedule: () => void
    hitColResize: (x: number, y: number) => number | null
    hitRowResize: (x: number, y: number) => number | null
  },
  opts?: {
    names?: { default: string; pointer: string; colResize: string; rowResize: string }
    hoverPointerOnScrollbar?: boolean
  },
) {
  const names = opts?.names ?? {
    default: 'default',
    pointer: 'pointer',
    colResize: 'col-resize',
    rowResize: 'row-resize',
  }
  const hoverOnSb = opts?.hoverPointerOnScrollbar ?? true

  function update(x: number, y: number) {
    let cursor = names.default
    // keep resize cursor while dragging
    if (state.dragMode === 'colresize') cursor = names.colResize
    if (state.dragMode === 'rowresize') cursor = names.rowResize

    // Scrollbar hover state (only when not dragging anything else)
    const sb0 = ctx.renderer.getScrollbars?.()
    if (state.dragMode === 'none' && sb0) {
      const inVTrack = !!(
        sb0.vTrack &&
        x >= sb0.vTrack.x &&
        x <= sb0.vTrack.x + sb0.vTrack.w &&
        y >= sb0.vTrack.y &&
        y <= sb0.vTrack.y + sb0.vTrack.h
      )
      const inVThumb = !!(
        sb0.vThumb &&
        x >= sb0.vThumb.x &&
        x <= sb0.vThumb.x + sb0.vThumb.w &&
        y >= sb0.vThumb.y &&
        y <= sb0.vThumb.y + sb0.vThumb.h
      )
      const inVArrowUp = !!(
        sb0.vArrowUp &&
        x >= sb0.vArrowUp.x &&
        x <= sb0.vArrowUp.x + sb0.vArrowUp.w &&
        y >= sb0.vArrowUp.y &&
        y <= sb0.vArrowUp.y + sb0.vArrowUp.h
      )
      const inVArrowDown = !!(
        sb0.vArrowDown &&
        x >= sb0.vArrowDown.x &&
        x <= sb0.vArrowDown.x + sb0.vArrowDown.w &&
        y >= sb0.vArrowDown.y &&
        y <= sb0.vArrowDown.y + sb0.vArrowDown.h
      )
      const inVArrow = inVArrowUp || inVArrowDown
      const inV = inVTrack || inVThumb || inVArrow
      const inHTrack = !!(
        sb0.hTrack &&
        x >= sb0.hTrack.x &&
        x <= sb0.hTrack.x + sb0.hTrack.w &&
        y >= sb0.hTrack.y &&
        y <= sb0.hTrack.y + sb0.hTrack.h
      )
      const inHThumb = !!(
        sb0.hThumb &&
        x >= sb0.hThumb.x &&
        x <= sb0.hThumb.x + sb0.hThumb.w &&
        y >= sb0.hThumb.y &&
        y <= sb0.hThumb.y + sb0.hThumb.h
      )
      const inHArrowLeft = !!(
        sb0.hArrowLeft &&
        x >= sb0.hArrowLeft.x &&
        x <= sb0.hArrowLeft.x + sb0.hArrowLeft.w &&
        y >= sb0.hArrowLeft.y &&
        y <= sb0.hArrowLeft.y + sb0.hArrowLeft.h
      )
      const inHArrowRight = !!(
        sb0.hArrowRight &&
        x >= sb0.hArrowRight.x &&
        x <= sb0.hArrowRight.x + sb0.hArrowRight.w &&
        y >= sb0.hArrowRight.y &&
        y <= sb0.hArrowRight.y + sb0.hArrowRight.h
      )
      const inHArrow = inHArrowLeft || inHArrowRight
      const inH = inHTrack || inHThumb || inHArrow
      ctx.renderer.setScrollbarState?.({
        vHover: inV,
        hHover: inH,
        vArrowHoverUp: inVArrowUp,
        vArrowHoverDown: inVArrowDown,
        hArrowHoverLeft: inHArrowLeft,
        hArrowHoverRight: inHArrowRight,
      })
      deps.schedule()
      if (hoverOnSb && (inV || inH)) cursor = names.pointer
    }

    // Resize handles hover
    if (state.dragMode === 'none') {
      const z = (ctx.renderer as unknown as { getZoom?: () => number }).getZoom?.() ?? 1
      const originX = ctx.metrics.headerColWidth * z
      const originY = ctx.metrics.headerRowHeight * z
      const grip = Math.max(6, Math.floor(6 * z))
      const frozenCols = Math.max(0, Math.min(ctx.sheet.cols, ctx.sheet.frozenCols || 0))
      const frozenRows = Math.max(0, Math.min(ctx.sheet.rows, ctx.sheet.frozenRows || 0))
      let handled = false
      if (!handled && frozenCols > 0) {
        const frozenWidth = colLeftFor(frozenCols, ctx.metrics.defaultColWidth, ctx.sheet.colWidths) * z
        const splitX = originX + frozenWidth
        if (Math.abs(x - splitX) <= grip) {
          cursor = names.colResize
          handled = true
        }
      }
      if (!handled && frozenRows > 0) {
        const frozenHeight =
          rowTopFor(frozenRows, ctx.metrics.defaultRowHeight, ctx.sheet.rowHeights) * z
        const splitY = originY + frozenHeight
        if (Math.abs(y - splitY) <= grip) {
          cursor = names.rowResize
          handled = true
        }
      }
      if (!handled) {
        const cIdx = deps.hitColResize(x, y)
        const rIdx = deps.hitRowResize(x, y)
        if (cIdx != null) cursor = names.colResize
        else if (rIdx != null) cursor = names.rowResize
        else {
          const nearRightEdge =
            x >= Math.max(0, originX - grip) && x <= originX && y >= 0 && y <= originY
          const nearBottomEdge =
            y >= Math.max(0, originY - grip) && y <= originY && x >= 0 && x <= originX
          if (nearRightEdge) cursor = names.colResize
          else if (nearBottomEdge) cursor = names.rowResize
        }
      }
    }

    ;(ctx.canvas.parentElement as HTMLElement).style.cursor = cursor
  }

  return { update }
}
