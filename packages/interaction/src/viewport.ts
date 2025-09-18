import type { Context } from './types'

export function computeAvailViewport(ctx: Context) {
  const { canvas, sheet, metrics } = ctx
  const viewW = canvas.clientWidth
  const viewH = canvas.clientHeight
  const baseW = Math.max(0, viewW - metrics.headerColWidth)
  const baseH = Math.max(0, viewH - metrics.headerRowHeight)
  const contentWidth = sheet.cols * metrics.defaultColWidth + [...sheet.colWidths.entries()].reduce((acc, [c, w]) => acc + (w - metrics.defaultColWidth), 0)
  const contentHeight = sheet.rows * metrics.defaultRowHeight + [...sheet.rowHeights.entries()].reduce((acc, [r, h]) => acc + (h - metrics.defaultRowHeight), 0)
  let widthAvail = baseW
  let heightAvail = baseH
  let vScrollable = contentHeight > heightAvail
  let hScrollable = contentWidth > widthAvail
  for (let i = 0; i < 3; i++) {
    const nextW = Math.max(0, baseW - (vScrollable ? metrics.scrollbarThickness : 0))
    const nextH = Math.max(0, baseH - (hScrollable ? metrics.scrollbarThickness : 0))
    const nextV = contentHeight > nextH
    const nextHFlag = contentWidth > nextW
    if (nextW === widthAvail && nextH === heightAvail && nextV === vScrollable && nextHFlag === hScrollable) break
    widthAvail = nextW
    heightAvail = nextH
    vScrollable = nextV
    hScrollable = nextHFlag
  }
  return { widthAvail, heightAvail, contentWidth, contentHeight }
}

