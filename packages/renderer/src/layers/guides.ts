import type { Layer, RenderContext } from '../types/context'

// Draws resize guide lines (bright elegant blue)
export class GuidesLayer implements Layer {
  name = 'guides'
  render(rc: RenderContext) {
    const g = rc.guides
    if (!g) return
    const { ctx, viewport } = rc
    ctx.save()
    ctx.strokeStyle = '#60a5fa' // blue-400
    ctx.lineWidth = 2
    ctx.setLineDash([4, 4])
    if (typeof g.v === 'number') {
      ctx.beginPath()
      const x = Math.floor(g.v) + 0.5
      ctx.moveTo(x, 0)
      ctx.lineTo(x, viewport.height)
      ctx.stroke()
    }
    if (typeof g.h === 'number') {
      ctx.beginPath()
      const y = Math.floor(g.h) + 0.5
      ctx.moveTo(0, y)
      ctx.lineTo(viewport.width, y)
      ctx.stroke()
    }
    ctx.restore()
  }
}

