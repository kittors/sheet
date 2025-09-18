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

    // Vertical grid lines
    let x = originX - visible.offsetX
    for (let c = visible.colStart; c <= visible.colEnd + 1; c++) {
      const w = sheet.colWidths.get(c) ?? defaultColWidth
      ctx.beginPath()
      ctx.moveTo(Math.floor(x) + 0.5, originY)
      ctx.lineTo(Math.floor(x) + 0.5, viewport.height - hGap)
      ctx.stroke()
      x += w
    }

    // Horizontal grid lines
    let y = originY - visible.offsetY
    for (let r = visible.rowStart; r <= visible.rowEnd + 1; r++) {
      const h = sheet.rowHeights.get(r) ?? defaultRowHeight
      ctx.beginPath()
      ctx.moveTo(originX, Math.floor(y) + 0.5)
      ctx.lineTo(viewport.width - vGap, Math.floor(y) + 0.5)
      ctx.stroke()
      y += h
    }

    ctx.restore()
  }
}
