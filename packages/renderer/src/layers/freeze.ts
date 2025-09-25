import type { Layer, RenderContext } from '../types/context'

// Draw persistent freeze split lines between frozen panes and scrollable panes
export class FreezeLayer implements Layer {
  name = 'freeze'
  render(rc: RenderContext) {
    const z = rc.zoom ?? 1
    const fr = Math.max(0, Math.min(rc.sheet.rows, rc.sheet.frozenRows || 0))
    const fc = Math.max(0, Math.min(rc.sheet.cols, rc.sheet.frozenCols || 0))
    if (fr <= 0 && fc <= 0) return
    // Compute split positions in canvas coords
    let leftPx = 0
    for (let c = 0; c < fc; c++) leftPx += (rc.sheet.colWidths.get(c) ?? rc.defaultColWidth) * z
    let topPx = 0
    for (let r = 0; r < fr; r++) topPx += (rc.sheet.rowHeights.get(r) ?? rc.defaultRowHeight) * z
    const x = Math.floor(rc.originX + leftPx) + 0.5
    const y = Math.floor(rc.originY + topPx) + 0.5
    const vGap = rc.scrollbar.vTrack ? rc.scrollbar.thickness : 0
    const hGap = rc.scrollbar.hTrack ? rc.scrollbar.thickness : 0
    const contentRight = rc.viewport.width - vGap
    const contentBottom = rc.viewport.height - hGap
    const ctx = rc.ctx
    ctx.save()
    ctx.strokeStyle = '#059669' // emerald-600
    ctx.lineWidth = 2
    ctx.setLineDash([])
    if (fc > 0) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, contentBottom)
      ctx.stroke()
    }
    if (fr > 0) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(contentRight, y)
      ctx.stroke()
    }
    ctx.restore()
  }
}
