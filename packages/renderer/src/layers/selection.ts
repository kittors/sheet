import type { Layer, RenderContext } from '../types/context'

export class SelectionLayer implements Layer {
  name = 'selection'
  render(rc: RenderContext) {
    const { ctx, sheet, defaultColWidth, defaultRowHeight, originX, originY, selection, scroll, viewport } = rc
    if (!selection) return

    // Normalize selection (0-based inclusive indices)
    const r0 = Math.max(0, Math.min(selection.r0, selection.r1))
    const r1 = Math.min(sheet.rows - 1, Math.max(selection.r0, selection.r1))
    const c0 = Math.max(0, Math.min(selection.c0, selection.c1))
    const c1 = Math.min(sheet.cols - 1, Math.max(selection.c0, selection.c1))

    // Compute cumulative sizes helpers (defaults + overrides delta)
    const cumWidth = (i: number): number => {
      let base = i * defaultColWidth
      if (sheet.colWidths.size) for (const [c, w] of sheet.colWidths) { if (c < i) base += (w - defaultColWidth) }
      return base
    }
    const cumHeight = (i: number): number => {
      let base = i * defaultRowHeight
      if (sheet.rowHeights.size) for (const [r, h] of sheet.rowHeights) { if (r < i) base += (h - defaultRowHeight) }
      return base
    }

    // Selection rect in canvas pixels, independent of overscan math
    const x0 = originX + cumWidth(c0) - scroll.x
    const x1 = originX + cumWidth(c1 + 1) - scroll.x
    const y0 = originY + cumHeight(r0) - scroll.y
    const y1 = originY + cumHeight(r1 + 1) - scroll.y

    // Clip to viewport content area (exclude headers)
    const clipLeft = originX
    const clipTop = originY
    const vGap = rc.scrollbar.vTrack ? rc.scrollbar.thickness : 0
    const hGap = rc.scrollbar.hTrack ? rc.scrollbar.thickness : 0
    const clipRight = viewport.width - vGap
    const clipBottom = viewport.height - hGap
    const left = Math.max(x0, clipLeft)
    const top = Math.max(y0, clipTop)
    const right = Math.min(x1, clipRight)
    const bottom = Math.min(y1, clipBottom)
    const w = right - left
    const h = bottom - top
    if (w <= 0 || h <= 0) return

    ctx.save()
    ctx.fillStyle = 'rgba(59, 130, 246, 0.08)'
    ctx.fillRect(Math.floor(left) + 1, Math.floor(top) + 1, Math.max(0, Math.floor(w) - 2), Math.max(0, Math.floor(h) - 2))
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.strokeRect(Math.floor(left) + 0.5, Math.floor(top) + 0.5, Math.floor(w) - 1, Math.floor(h) - 1)
    ctx.restore()
  }
}
