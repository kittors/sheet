import type { Layer, RenderContext } from '../types/context'

export class GridLayer implements Layer {
  name = 'grid'
  render(rc: RenderContext) {
    const { ctx, viewport, visible, sheet, defaultColWidth, defaultRowHeight, originX, originY } = rc
    ctx.save()
    ctx.strokeStyle = '#e5e7eb' // light gray
    ctx.lineWidth = 1

    // Vertical grid lines
    let x = originX - visible.offsetX
    for (let c = visible.colStart; c <= visible.colEnd + 1; c++) {
      const w = sheet.colWidths.get(c) ?? defaultColWidth
      ctx.beginPath()
      ctx.moveTo(Math.floor(x) + 0.5, originY)
      ctx.lineTo(Math.floor(x) + 0.5, viewport.height)
      ctx.stroke()
      x += w
    }

    // Horizontal grid lines
    let y = originY - visible.offsetY
    for (let r = visible.rowStart; r <= visible.rowEnd + 1; r++) {
      const h = sheet.rowHeights.get(r) ?? defaultRowHeight
      ctx.beginPath()
      ctx.moveTo(originX, Math.floor(y) + 0.5)
      ctx.lineTo(viewport.width, Math.floor(y) + 0.5)
      ctx.stroke()
      y += h
    }

    ctx.restore()
  }
}
