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

  // Compute total content size (defaults + overrides delta)
  const totalWidth =
    p.colCount * p.defaultColWidth +
    (p.colWidths
      ? Array.from(p.colWidths.values()).reduce((acc, w) => acc + (w - p.defaultColWidth), 0)
      : 0)
  const totalHeight =
    p.rowCount * p.defaultRowHeight +
    (p.rowHeights
      ? Array.from(p.rowHeights.values()).reduce((acc, h) => acc + (h - p.defaultRowHeight), 0)
      : 0)

  const maxScrollX = Math.max(0, totalWidth - p.viewportWidth)
  const maxScrollY = Math.max(0, totalHeight - p.viewportHeight)
  const sX = Math.max(0, Math.min(p.scrollX, maxScrollX))
  const sY = Math.max(0, Math.min(p.scrollY, maxScrollY))

  // Prepare prefix over deltas (override - default) for binary search cumulative
  const prep = (m: Map<number, number> | undefined, def: number) => {
    if (!m || m.size === 0) return { keys: [] as number[], pref: [] as number[] }
    const keys = Array.from(m.keys()).sort((a, b) => a - b)
    const pref: number[] = new Array(keys.length)
    let s = 0
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]
      const v = m.get(k) ?? def
      s += v - def
      pref[i] = s
    }
    return { keys, pref }
  }
  const colP = prep(p.colWidths, p.defaultColWidth)
  const rowP = prep(p.rowHeights, p.defaultRowHeight)
  const sumDeltaBefore = (keys: number[], pref: number[], idx: number) => {
    // sum of deltas for keys < idx
    if (keys.length === 0) return 0
    let lo = 0,
      hi = keys.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (keys[mid] < idx) lo = mid + 1
      else hi = mid
    }
    return lo > 0 ? pref[lo - 1] : 0
  }
  const cumAt = (idx: number, def: number, keys: number[], pref: number[]) =>
    idx * def + sumDeltaBefore(keys, pref, idx)
  const sizeAt = (i: number, def: number, m?: Map<number, number>) => m?.get(i) ?? def

  // Find starting column/row by binary search on cumulative sums
  const findStart = (sPos: number, count: number, def: number, keys: number[], pref: number[], m?: Map<number, number>) => {
    let lo = 0,
      hi = count
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      const x = cumAt(mid, def, keys, pref)
      if (x <= sPos) lo = mid + 1
      else hi = mid
    }
    const idx = Math.max(0, lo - 1)
    const base = cumAt(idx, def, keys, pref)
    return { start: idx, offset: sPos - base }
  }

  const colRes = findStart(sX, p.colCount, p.defaultColWidth, colP.keys, colP.pref, p.colWidths)
  const rowRes = findStart(sY, p.rowCount, p.defaultRowHeight, rowP.keys, rowP.pref, p.rowHeights)
  let colStart = colRes.start
  let rowStart = rowRes.start
  let offsetX = colRes.offset
  let offsetY = rowRes.offset

  // Compute end indices by accumulating sizes from the start until viewport spans
  let colEnd = colStart
  let widthAccum = -offsetX
  for (let c = colStart; c < p.colCount && widthAccum < p.viewportWidth; c++) {
    widthAccum += sizeAt(c, p.defaultColWidth, p.colWidths)
    colEnd = c
  }
  let rowEnd = rowStart
  let heightAccum = -offsetY
  for (let r = rowStart; r < p.rowCount && heightAccum < p.viewportHeight; r++) {
    heightAccum += sizeAt(r, p.defaultRowHeight, p.rowHeights)
    rowEnd = r
  }

  // Apply overscan and adjust offsets to remain relative to the NEW starts
  const prevColStart = colStart
  const prevRowStart = rowStart
  colStart = Math.max(0, colStart - overscan)
  rowStart = Math.max(0, rowStart - overscan)
  if (prevColStart > colStart) {
    for (let c = colStart; c < prevColStart; c++) offsetX += sizeAt(c, p.defaultColWidth, p.colWidths)
  }
  if (prevRowStart > rowStart) {
    for (let r = rowStart; r < prevRowStart; r++) offsetY += sizeAt(r, p.defaultRowHeight, p.rowHeights)
  }
  colEnd = Math.min(p.colCount - 1, colEnd + overscan)
  rowEnd = Math.min(p.rowCount - 1, rowEnd + overscan)

  return { colStart, colEnd, rowStart, rowEnd, offsetX, offsetY }
}
