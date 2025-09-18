import type { Layer, RenderContext } from '../types/context'

export class ScrollbarLayer implements Layer {
  name = 'scrollbar'
  render(rc: RenderContext) {
    const { ctx, scrollbar, scrollbarState } = rc
    const { vTrack, vThumb, hTrack, hThumb, thickness } = scrollbar
    if (!vTrack && !hTrack) return

    ctx.save()
    ctx.globalAlpha = 1

    // Draw vertical track and thumb
    if (vTrack) {
      ctx.fillStyle = scrollbarState.vHover || scrollbarState.vActive ? '#e5e7eb' : '#f3f4f6' // track hover/active darker
      ctx.fillRect(vTrack.x, vTrack.y, vTrack.w, vTrack.h)
      // border inner edge against content
      ctx.fillStyle = '#e5e7eb'
      ctx.fillRect(vTrack.x, vTrack.y, 1, vTrack.h)
      if (vThumb) {
        ctx.fillStyle = scrollbarState.vActive ? '#4b5563' : (scrollbarState.vHover ? '#6b7280' : '#9ca3af') // active darker
        const r = Math.floor(thickness / 2)
        this.roundRect(ctx, vThumb.x, vThumb.y, vThumb.w, vThumb.h, r)
        ctx.fill()
      }
    }

    // Draw horizontal track and thumb
    if (hTrack) {
      ctx.fillStyle = scrollbarState.hHover || scrollbarState.hActive ? '#e5e7eb' : '#f3f4f6'
      ctx.fillRect(hTrack.x, hTrack.y, hTrack.w, hTrack.h)
      ctx.fillStyle = '#e5e7eb'
      ctx.fillRect(hTrack.x, hTrack.y, hTrack.w, 1)
      if (hThumb) {
        ctx.fillStyle = scrollbarState.hActive ? '#4b5563' : (scrollbarState.hHover ? '#6b7280' : '#9ca3af')
        const r = Math.floor(thickness / 2)
        this.roundRect(ctx, hThumb.x, hThumb.y, hThumb.w, hThumb.h, r)
        ctx.fill()
      }
    }

    // Corner square where both scrollbars meet
    if (vTrack && hTrack) {
      ctx.fillStyle = '#e5e7eb'
      ctx.fillRect(vTrack.x, hTrack.y, thickness, thickness)
    }

    ctx.restore()
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, Math.floor(Math.min(w, h) / 2))
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + w, y, x + w, y + h, rr)
    ctx.arcTo(x + w, y + h, x, y + h, rr)
    ctx.arcTo(x, y + h, x, y, rr)
    ctx.arcTo(x, y, x + w, y, rr)
    ctx.closePath()
  }
}
