import type { Context } from './types'

type CachedMetrics = ReturnType<Context['renderer']['getViewportMetrics']>

export function computeAvailViewport(ctx: Context) {
  const { canvas, sheet, metrics } = ctx
  // Fast path: trust renderer's cached metrics when available to avoid layout reads
  const cached: CachedMetrics =
    typeof ctx.renderer?.getViewportMetrics === 'function'
      ? ctx.renderer.getViewportMetrics()
      : null
  if (cached) return cached

  // Fallback path (e.g., before first render): compute from DOM sizes
  const viewW = canvas.clientWidth
  const viewH = canvas.clientHeight

  const baseW = Math.max(0, viewW - metrics.headerColWidth)
  const baseH = Math.max(0, viewH - metrics.headerRowHeight)
  const contentWidth =
    sheet.cols * metrics.defaultColWidth +
    Array.from(sheet.colWidths.values()).reduce((acc, w) => acc + (w - metrics.defaultColWidth), 0)
  const contentHeight =
    sheet.rows * metrics.defaultRowHeight +
    Array.from(sheet.rowHeights.values()).reduce(
      (acc, h) => acc + (h - metrics.defaultRowHeight),
      0,
    )
  let widthAvail = baseW
  let heightAvail = baseH
  let vScrollable = contentHeight > heightAvail
  let hScrollable = contentWidth > widthAvail
  for (let i = 0; i < 3; i++) {
    const nextW = Math.max(0, baseW - (vScrollable ? metrics.scrollbarThickness : 0))
    const nextH = Math.max(0, baseH - (hScrollable ? metrics.scrollbarThickness : 0))
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
  const maxScrollX = Math.max(0, contentWidth - widthAvail)
  const maxScrollY = Math.max(0, contentHeight - heightAvail)
  return {
    widthAvail,
    heightAvail,
    contentWidth,
    contentHeight,
    maxScrollX,
    maxScrollY,
    viewportWidth: viewW,
    viewportHeight: viewH,
  }
}
