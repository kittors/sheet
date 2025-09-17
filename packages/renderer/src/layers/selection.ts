import type { Layer, RenderContext } from '../types/context'

export class SelectionLayer implements Layer {
  name = 'selection'
  render(rc: RenderContext) {
    const { ctx, visible, sheet, defaultColWidth, defaultRowHeight, originX, originY, selection } = rc
    if (!selection) return

    // Normalize selection
    const r0 = Math.max(0, Math.min(selection.r0, selection.r1))
    const r1 = Math.min(sheet.rows - 1, Math.max(selection.r0, selection.r1))
    const c0 = Math.max(0, Math.min(selection.c0, selection.c1))
    const c1 = Math.min(sheet.cols - 1, Math.max(selection.c0, selection.c1))

    // Compute rectangle in pixels relative to canvas
    // Find top-left position
    let x = originX - visible.offsetX
    for (let c = visible.colStart; c < c0; c++) {
      x += sheet.colWidths.get(c) ?? defaultColWidth
    }
    let y = originY - visible.offsetY
    for (let r = visible.rowStart; r < r0; r++) {
      y += sheet.rowHeights.get(r) ?? defaultRowHeight
    }

    // Compute width and height
    let w = 0
    for (let c = c0; c <= Math.min(c1, visible.colEnd); c++) {
      w += sheet.colWidths.get(c) ?? defaultColWidth
    }
    let h = 0
    for (let r = r0; r <= Math.min(r1, visible.rowEnd); r++) {
      h += sheet.rowHeights.get(r) ?? defaultRowHeight
    }

    ctx.save()
    // Fill with a subtle translucent overlay
    ctx.fillStyle = 'rgba(59, 130, 246, 0.08)'
    ctx.fillRect(Math.floor(x) + 1, Math.floor(y) + 1, Math.max(0, Math.floor(w) - 2), Math.max(0, Math.floor(h) - 2))
    // Outline
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.strokeRect(Math.floor(x) + 0.5, Math.floor(y) + 0.5, Math.floor(w) - 1, Math.floor(h) - 1)
    ctx.restore()
  }
}
