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
  const z = (ctx.renderer as unknown as { getZoom?: () => number }).getZoom?.() ?? 1
  const viewWBase = canvas.clientWidth
  const viewHBase = canvas.clientHeight

  const baseW = Math.max(0, viewWBase - metrics.headerColWidth * z)
  const baseH = Math.max(0, viewHBase - metrics.headerRowHeight * z)
  const contentWidth =
    (sheet.cols * metrics.defaultColWidth +
      Array.from(sheet.colWidths.values()).reduce(
        (acc, w) => acc + (w - metrics.defaultColWidth),
        0,
      )) * z
  const contentHeight =
    (sheet.rows * metrics.defaultRowHeight +
      Array.from(sheet.rowHeights.values()).reduce(
        (acc, h) => acc + (h - metrics.defaultRowHeight),
        0,
      )) * z
  // Subtract frozen panes from available scrollable viewport and effective content for scrollbar math
  let leftFrozenPx = 0
  for (let c = 0; c < (sheet.frozenCols || 0); c++)
    leftFrozenPx += (sheet.colWidths.get(c) ?? metrics.defaultColWidth) * z
  let topFrozenPx = 0
  for (let r = 0; r < (sheet.frozenRows || 0); r++)
    topFrozenPx += (sheet.rowHeights.get(r) ?? metrics.defaultRowHeight) * z
  const baseWMain = Math.max(0, baseW - leftFrozenPx)
  const baseHMain = Math.max(0, baseH - topFrozenPx)
  const contentWidthEff = Math.max(0, contentWidth - leftFrozenPx)
  const contentHeightEff = Math.max(0, contentHeight - topFrozenPx)
  let widthAvail = baseWMain
  let heightAvail = baseHMain
  let vScrollable = contentHeightEff > heightAvail
  let hScrollable = contentWidthEff > widthAvail
  for (let i = 0; i < 3; i++) {
    const nextW = Math.max(0, baseWMain - (vScrollable ? metrics.scrollbarThickness : 0))
    const nextH = Math.max(0, baseHMain - (hScrollable ? metrics.scrollbarThickness : 0))
    const nextV = contentHeightEff > nextH
    const nextHFlag = contentWidthEff > nextW
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
  const maxScrollX = Math.max(0, contentWidthEff - widthAvail)
  const maxScrollY = Math.max(0, contentHeightEff - heightAvail)
  return {
    widthAvail,
    heightAvail,
    contentWidth: contentWidthEff,
    contentHeight: contentHeightEff,
    maxScrollX,
    maxScrollY,
    viewportWidth: viewWBase,
    viewportHeight: viewHBase,
  }
}
