export interface VirtualParams {
  scrollX: number
  scrollY: number
  viewportWidth: number
  viewportHeight: number
  colCount: number
  rowCount: number
  defaultColWidth: number
  defaultRowHeight: number
  colWidths?: Map<number, number>
  rowHeights?: Map<number, number>
  overscan?: number // number of rows/cols to extend for buffering
}

export interface VisibleRange {
  colStart: number
  colEnd: number // inclusive
  rowStart: number
  rowEnd: number // inclusive
  offsetX: number // pixel offset from the start of colStart to scrollX
  offsetY: number // pixel offset from the start of rowStart to scrollY
}

// Compute visible range of rows/columns given scroll offsets and size maps.
export function computeVisibleRange(p: VirtualParams): VisibleRange {
  const overscan = Math.max(0, p.overscan ?? 2)

  // Compute total content size to clamp scroll offsets and avoid boundary bugs
  const totalWidth = p.colCount * p.defaultColWidth +
    (p.colWidths ? [...p.colWidths.entries()].reduce((acc, [c, w]) => acc + (w - p.defaultColWidth), 0) : 0)
  const totalHeight = p.rowCount * p.defaultRowHeight +
    (p.rowHeights ? [...p.rowHeights.entries()].reduce((acc, [r, h]) => acc + (h - p.defaultRowHeight), 0) : 0)

  const maxScrollX = Math.max(0, totalWidth - p.viewportWidth)
  const maxScrollY = Math.max(0, totalHeight - p.viewportHeight)
  const sX = Math.max(0, Math.min(p.scrollX, maxScrollX))
  const sY = Math.max(0, Math.min(p.scrollY, maxScrollY))

  // Find starting column index and pixel offset within that column
  let x = 0
  let colStart = 0
  let offsetX = 0
  for (let c = 0; c < p.colCount; c++) {
    const w = p.colWidths?.get(c) ?? p.defaultColWidth
    if (x + w >= sX) {
      colStart = c
      offsetX = sX - x
      break
    }
    x += w
  }

  // Find end column index (inclusive)
  let colEnd = colStart
  let widthAccum = -offsetX
  for (let c = colStart; c < p.colCount && widthAccum < p.viewportWidth; c++) {
    widthAccum += p.colWidths?.get(c) ?? p.defaultColWidth
    colEnd = c
  }

  // Find starting row index and pixel offset within that row
  let y = 0
  let rowStart = 0
  let offsetY = 0
  for (let r = 0; r < p.rowCount; r++) {
    const h = p.rowHeights?.get(r) ?? p.defaultRowHeight
    if (y + h >= sY) {
      rowStart = r
      offsetY = sY - y
      break
    }
    y += h
  }

  // Find end row index (inclusive)
  let rowEnd = rowStart
  let heightAccum = -offsetY
  for (let r = rowStart; r < p.rowCount && heightAccum < p.viewportHeight; r++) {
    heightAccum += p.rowHeights?.get(r) ?? p.defaultRowHeight
    rowEnd = r
  }

  // Apply overscan
  colStart = Math.max(0, colStart - overscan)
  rowStart = Math.max(0, rowStart - overscan)
  colEnd = Math.min(p.colCount - 1, colEnd + overscan)
  rowEnd = Math.min(p.rowCount - 1, rowEnd + overscan)

  return { colStart, colEnd, rowStart, rowEnd, offsetX, offsetY }
}
