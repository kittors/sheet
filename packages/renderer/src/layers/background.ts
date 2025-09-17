import type { Layer, RenderContext } from '../types/context'

export class BackgroundLayer implements Layer {
  name = 'background'
  render(rc: RenderContext) {
    const { ctx, viewport } = rc
    ctx.save()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, viewport.width, viewport.height)
    ctx.restore()
  }
}
