import type { Layer, RenderContext } from '../types/context'

export class GridLayer implements Layer {
  name = 'grid'
  render(rc: RenderContext) {
    const { ctx, viewport, visible, sheet, defaultColWidth, defaultRowHeight, originX, originY } = rc
    const vGap = rc.scrollbar.vTrack ? rc.scrollbar.thickness : 0
    const hGap = rc.scrollbar.hTrack ? rc.scrollbar.thickness : 0
    ctx.save()
    // Clip to content area (exclude headers and scrollbars)
    ctx.beginPath()
    ctx.rect(originX, originY, Math.max(0, viewport.width - originX - vGap), Math.max(0, viewport.height - originY - hGap))
    ctx.clip()
    ctx.strokeStyle = '#e5e7eb' // light gray
    ctx.lineWidth = 1

    // Helpers to test if a grid boundary sits inside a merge interior
    // Vertical boundary at column index b (line at start of column b)
    function isVBoundaryBlockedAtRow(b: number, r: number) {
      // interior boundaries for a merge m are at b in (m.c, m.c + m.cols)
      for (const m of sheet.merges) {
        // skip only degenerate 1x1 (not a merge). 1xN or Nx1 should still suppress interior lines
        if (m.rows === 1 && m.cols === 1) continue
        if (r < m.r || r > m.r + m.rows - 1) continue
        // boundary index b represents the line at start of column b
        if (b <= m.c || b >= m.c + m.cols) continue
        return true
      }
      return false
    }

    // Horizontal boundary at row index b (line at start of row b)
    function isHBoundaryBlockedAtCol(b: number, c: number) {
      // interior boundaries for a merge m are at b in (m.r, m.r + m.rows)
      for (const m of sheet.merges) {
        if (m.rows === 1 && m.cols === 1) continue
        if (c < m.c || c > m.c + m.cols - 1) continue
        // boundary index b represents the line at start of row b
        if (b <= m.r || b >= m.r + m.rows) continue
        return true
      }
      return false
    }

    // Vertical grid lines (skip interior segments within merges)
    let x = originX - visible.offsetX
    for (let b = visible.colStart; b <= visible.colEnd + 1; b++) {
      const w = sheet.colWidths.get(b) ?? defaultColWidth
      ctx.beginPath()
      let y = originY - visible.offsetY
      for (let r = visible.rowStart; r <= visible.rowEnd; r++) {
        const h = sheet.rowHeights.get(r) ?? defaultRowHeight
        if (!isVBoundaryBlockedAtRow(b, r)) {
          const xx = Math.floor(x) + 0.5
          const y0 = Math.floor(y)
          const y1 = Math.floor(y + h)
          ctx.moveTo(xx, y0 + 0.5)
          ctx.lineTo(xx, y1 + 0.5)
        }
        y += h
      }
      ctx.stroke()
      x += w
    }

    // Horizontal grid lines (skip interior segments within merges)
    let y = originY - visible.offsetY
    for (let b = visible.rowStart; b <= visible.rowEnd + 1; b++) {
      const h = sheet.rowHeights.get(b) ?? defaultRowHeight
      ctx.beginPath()
      let x2 = originX - visible.offsetX
      for (let c = visible.colStart; c <= visible.colEnd; c++) {
        const w2 = sheet.colWidths.get(c) ?? defaultColWidth
        if (!isHBoundaryBlockedAtCol(b, c)) {
          const yy = Math.floor(y) + 0.5
          const xL = Math.floor(x2)
          const xR = Math.floor(x2 + w2)
          ctx.moveTo(xL + 0.5, yy)
          ctx.lineTo(xR + 0.5, yy)
        }
        x2 += w2
      }
      ctx.stroke()
      y += h
    }

    ctx.restore()
  }
}
