import type { Context, State } from '../types'
import { colAtX, rowAtY } from '../hit'

export function createResizeHitters(
  ctx: Context,
  state: State,
  deps: {
    getScrollClamped: () => { sX: number; sY: number }
    colLeft: (index: number) => number
    rowTop: (index: number) => number
  },
  opts?: { hitMargin?: number },
) {
  const MARGIN = opts?.hitMargin ?? 4

  function hitColResize(xCanvas: number, yCanvas: number): number | null {
    const z = (ctx.renderer as unknown as { getZoom?: () => number }).getZoom?.() ?? 1
    if (yCanvas < 0 || yCanvas > ctx.metrics.headerRowHeight * z) return null
    const sb = ctx.renderer.getScrollbars?.()
    const rightBound = sb?.vTrack ? sb.vTrack.x : ctx.canvas.clientWidth
    if (xCanvas < ctx.metrics.headerColWidth * z || xCanvas > rightBound) return null
    const { sX } = deps.getScrollClamped()
    const col = colAtX(ctx, state, xCanvas)
    const left = deps.colLeft(col)
    const w = ctx.sheet.colWidths.get(col) ?? ctx.metrics.defaultColWidth
    const right = left + w
    const xRightCanvas = ctx.metrics.headerColWidth * z + right * z - sX
    if (Math.abs(xCanvas - xRightCanvas) <= MARGIN) return col
    const xLeftCanvas = ctx.metrics.headerColWidth * z + left * z - sX
    if (col > 0 && Math.abs(xCanvas - xLeftCanvas) <= MARGIN) return col - 1
    return null
  }

  function hitRowResize(xCanvas: number, yCanvas: number): number | null {
    const z = (ctx.renderer as unknown as { getZoom?: () => number }).getZoom?.() ?? 1
    if (xCanvas < 0 || xCanvas > ctx.metrics.headerColWidth * z) return null
    const sb = ctx.renderer.getScrollbars?.()
    const bottomBound = sb?.hTrack ? sb.hTrack.y : ctx.canvas.clientHeight
    if (yCanvas < ctx.metrics.headerRowHeight * z || yCanvas > bottomBound) return null
    const { sY } = deps.getScrollClamped()
    const row = rowAtY(ctx, state, yCanvas)
    const top = deps.rowTop(row)
    const h = ctx.sheet.rowHeights.get(row) ?? ctx.metrics.defaultRowHeight
    const bottom = top + h
    const yBottomCanvas = ctx.metrics.headerRowHeight * z + bottom * z - sY
    if (Math.abs(yCanvas - yBottomCanvas) <= MARGIN) return row
    const yTopCanvas = ctx.metrics.headerRowHeight * z + top * z - sY
    if (row > 0 && Math.abs(yCanvas - yTopCanvas) <= MARGIN) return row - 1
    return null
  }

  return { hitColResize, hitRowResize }
}
