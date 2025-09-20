import type { Layer, RenderContext } from '../types/context'
import { snapCoord } from '@sheet/shared-utils'

// Draws resize guide lines (bright elegant blue)
export class GuidesLayer implements Layer {
  name = 'guides'
  render(rc: RenderContext) {
    const g = rc.guides
    if (!g) return
    const { ctx, viewport } = rc
    ctx.save()
    ctx.strokeStyle = '#60a5fa' // blue-400
    const lw = 2
    ctx.lineWidth = lw
    ctx.lineCap = 'butt'
    ctx.setLineDash([4, 4])
    if (typeof g.v === 'number') {
      ctx.beginPath()
      const x = snapCoord(g.v, lw)
      ctx.moveTo(x, 0)
      ctx.lineTo(x, viewport.height)
      ctx.stroke()
    }
    if (typeof g.h === 'number') {
      ctx.beginPath()
      const y = snapCoord(g.h, lw)
      ctx.moveTo(0, y)
      ctx.lineTo(viewport.width, y)
      ctx.stroke()
    }
    ctx.restore()
  }
}
