import type { Layer, RenderContext } from '../types/context'
import type { Canvas2DContext } from '@sheet/shared-utils'

export class ScrollbarLayer implements Layer {
  name = 'scrollbar'
  render(rc: RenderContext) {
    const { ctx, scrollbar, scrollbarState } = rc
    const { vTrack, vThumb, hTrack, hThumb, thickness, vArrowUp, vArrowDown, hArrowLeft, hArrowRight } = scrollbar
    if (!vTrack && !hTrack) return

    ctx.save()
    ctx.globalAlpha = 1

    // Draw vertical arrows, track and thumb
    if (vTrack) {
      // Arrows (optional)
      if (vArrowUp) {
        // Base background same as track so arrow area visually belongs to scrollbar
        ctx.fillStyle = '#f3f4f6'
        ctx.fillRect(vArrowUp.x, vArrowUp.y, vArrowUp.w, vArrowUp.h)
        // Hover/active background for arrow: rounded light gray capsule
        const hover = !!rc.scrollbarState.vArrowHoverUp
        if (hover) {
          ctx.fillStyle = '#e5e7eb'
          this.roundRect(
            ctx,
            vArrowUp.x + 2,
            vArrowUp.y + 2,
            Math.max(0, vArrowUp.w - 4),
            Math.max(0, vArrowUp.h - 4),
            Math.floor(Math.min(vArrowUp.w, vArrowUp.h) / 5),
          )
          ctx.fill()
        }
        this.drawArrowUp(ctx, vArrowUp.x, vArrowUp.y, vArrowUp.w, vArrowUp.h)
      }
      if (vArrowDown) {
        ctx.fillStyle = '#f3f4f6'
        ctx.fillRect(vArrowDown.x, vArrowDown.y, vArrowDown.w, vArrowDown.h)
        const hover = !!rc.scrollbarState.vArrowHoverDown
        if (hover) {
          ctx.fillStyle = '#e5e7eb'
          this.roundRect(
            ctx,
            vArrowDown.x + 2,
            vArrowDown.y + 2,
            Math.max(0, vArrowDown.w - 4),
            Math.max(0, vArrowDown.h - 4),
            Math.floor(Math.min(vArrowDown.w, vArrowDown.h) / 5),
          )
          ctx.fill()
        }
        this.drawArrowDown(ctx, vArrowDown.x, vArrowDown.y, vArrowDown.w, vArrowDown.h)
      }
      // Track
      // Do not change track color on hover; keep a constant neutral background
      ctx.fillStyle = '#f3f4f6'
      ctx.fillRect(vTrack.x, vTrack.y, vTrack.w, vTrack.h)
      // No inner edge/border line
      if (vThumb) {
        ctx.fillStyle = scrollbarState.vActive
          ? '#4b5563'
          : scrollbarState.vHover
            ? '#6b7280'
            : '#9ca3af' // active darker
        const r = Math.floor(Math.min(vThumb.w, vThumb.h) / 2)
        this.roundRect(ctx, vThumb.x, vThumb.y, vThumb.w, vThumb.h, r)
        ctx.fill()
      }
    }

    // Draw horizontal arrows, track and thumb
    if (hTrack) {
      if (hArrowLeft) {
        ctx.fillStyle = '#f3f4f6'
        ctx.fillRect(hArrowLeft.x, hArrowLeft.y, hArrowLeft.w, hArrowLeft.h)
        const hover = !!rc.scrollbarState.hArrowHoverLeft
        if (hover) {
          ctx.fillStyle = '#e5e7eb'
          this.roundRect(
            ctx,
            hArrowLeft.x + 2,
            hArrowLeft.y + 2,
            Math.max(0, hArrowLeft.w - 4),
            Math.max(0, hArrowLeft.h - 4),
            Math.floor(Math.min(hArrowLeft.w, hArrowLeft.h) / 5),
          )
          ctx.fill()
        }
        this.drawArrowLeft(ctx, hArrowLeft.x, hArrowLeft.y, hArrowLeft.w, hArrowLeft.h)
      }
      if (hArrowRight) {
        ctx.fillStyle = '#f3f4f6'
        ctx.fillRect(hArrowRight.x, hArrowRight.y, hArrowRight.w, hArrowRight.h)
        const hover = !!rc.scrollbarState.hArrowHoverRight
        if (hover) {
          ctx.fillStyle = '#e5e7eb'
          this.roundRect(
            ctx,
            hArrowRight.x + 2,
            hArrowRight.y + 2,
            Math.max(0, hArrowRight.w - 4),
            Math.max(0, hArrowRight.h - 4),
            Math.floor(Math.min(hArrowRight.w, hArrowRight.h) / 5),
          )
          ctx.fill()
        }
        this.drawArrowRight(ctx, hArrowRight.x, hArrowRight.y, hArrowRight.w, hArrowRight.h)
      }
      // Constant track color regardless of hover/active
      ctx.fillStyle = '#f3f4f6'
      ctx.fillRect(hTrack.x, hTrack.y, hTrack.w, hTrack.h)
      // No top separator line
      if (hThumb) {
        ctx.fillStyle = scrollbarState.hActive
          ? '#4b5563'
          : scrollbarState.hHover
            ? '#6b7280'
            : '#9ca3af'
        const r = Math.floor(Math.min(hThumb.w, hThumb.h) / 2)
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

  private roundRect(
    ctx: Canvas2DContext,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    const rr = Math.min(r, Math.floor(Math.min(w, h) / 2))
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + w, y, x + w, y + h, rr)
    ctx.arcTo(x + w, y + h, x, y + h, rr)
    ctx.arcTo(x, y + h, x, y, rr)
    ctx.arcTo(x, y, x + w, y, rr)
    ctx.closePath()
  }

  private drawRoundedTriangle(
    ctx: Canvas2DContext,
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number },
    r: number,
  ) {
    // Helper to move from p->q by distance d
    const moveToward = (p: { x: number; y: number }, q: { x: number; y: number }, d: number) => {
      const vx = q.x - p.x
      const vy = q.y - p.y
      const L = Math.hypot(vx, vy) || 1
      const t = Math.min(0.5, Math.max(0, d / L))
      return { x: p.x + vx * t, y: p.y + vy * t }
    }
    // Per-corner distances (cap by adjacent edge length * 0.3 to avoid overlap)
    const lenAB = Math.hypot(b.x - a.x, b.y - a.y)
    const lenBC = Math.hypot(c.x - b.x, c.y - b.y)
    const lenCA = Math.hypot(a.x - c.x, a.y - c.y)
    const dA = Math.min(r, lenAB * 0.3, lenCA * 0.3)
    const dB = Math.min(r, lenBC * 0.3, lenAB * 0.3)
    const dC = Math.min(r, lenCA * 0.3, lenBC * 0.3)
    // Offset points along edges around each corner
    const Aab = moveToward(a, b, dA)
    const Aca = moveToward(a, c, dA)
    const Bbc = moveToward(b, c, dB)
    const Bab = moveToward(b, a, dB)
    const Cca = moveToward(c, a, dC)
    const Ccb = moveToward(c, b, dC)
    ctx.fillStyle = '#6b7280'
    ctx.beginPath()
    // Start on AB near A, go to AB near B
    ctx.moveTo(Aab.x, Aab.y)
    ctx.lineTo(Bab.x, Bab.y)
    // Round corner at B
    ctx.quadraticCurveTo(b.x, b.y, Bbc.x, Bbc.y)
    // Edge BC to near C
    ctx.lineTo(Ccb.x, Ccb.y)
    // Round corner at C
    ctx.quadraticCurveTo(c.x, c.y, Cca.x, Cca.y)
    // Edge CA to near A
    ctx.lineTo(Aca.x, Aca.y)
    // Round corner at A
    ctx.quadraticCurveTo(a.x, a.y, Aab.x, Aab.y)
    ctx.closePath()
    ctx.fill()
  }
  private drawArrowUp(ctx: Canvas2DContext, x: number, y: number, w: number, h: number) {
    // Slightly shrink icon without changing clickable area
    const pad = Math.floor(Math.min(w, h) * 0.24)
    const availW = Math.max(0, w - 2 * pad)
    const availH = Math.max(0, h - 2 * pad)
    // Equilateral: height = sqrt(3)/2 * s
    const s = Math.max(1, Math.floor(Math.min(availW, (2 / Math.sqrt(3)) * availH)))
    const heq = (Math.sqrt(3) / 2) * s
    const cx = x + w / 2
    const cy = y + h / 2
    const apexY = cy - heq / 2
    const baseY = cy + heq / 2
    const r = Math.floor(Math.min(w, h) * 0.12)
    this.drawRoundedTriangle(
      ctx,
      { x: cx - s / 2, y: baseY },
      { x: cx + s / 2, y: baseY },
      { x: cx, y: apexY },
      r,
    )
  }
  private drawArrowDown(ctx: Canvas2DContext, x: number, y: number, w: number, h: number) {
    const pad = Math.floor(Math.min(w, h) * 0.24)
    const availW = Math.max(0, w - 2 * pad)
    const availH = Math.max(0, h - 2 * pad)
    const s = Math.max(1, Math.floor(Math.min(availW, (2 / Math.sqrt(3)) * availH)))
    const heq = (Math.sqrt(3) / 2) * s
    const cx = x + w / 2
    const cy = y + h / 2
    const apexY = cy + heq / 2
    const baseY = cy - heq / 2
    const r = Math.floor(Math.min(w, h) * 0.12)
    this.drawRoundedTriangle(
      ctx,
      { x: cx - s / 2, y: baseY },
      { x: cx + s / 2, y: baseY },
      { x: cx, y: apexY },
      r,
    )
  }
  private drawArrowLeft(ctx: Canvas2DContext, x: number, y: number, w: number, h: number) {
    const pad = Math.floor(Math.min(w, h) * 0.24)
    const availW = Math.max(0, w - 2 * pad)
    const availH = Math.max(0, h - 2 * pad)
    const s = Math.max(1, Math.floor(Math.min(availH, (2 / Math.sqrt(3)) * availW)))
    const heq = (Math.sqrt(3) / 2) * s
    const cx = x + w / 2
    const cy = y + h / 2
    const apexX = cx - heq / 2
    const baseX = cx + heq / 2
    const r = Math.floor(Math.min(w, h) * 0.12)
    this.drawRoundedTriangle(
      ctx,
      { x: baseX, y: cy - s / 2 },
      { x: baseX, y: cy + s / 2 },
      { x: apexX, y: cy },
      r,
    )
  }
  private drawArrowRight(ctx: Canvas2DContext, x: number, y: number, w: number, h: number) {
    const pad = Math.floor(Math.min(w, h) * 0.24)
    const availW = Math.max(0, w - 2 * pad)
    const availH = Math.max(0, h - 2 * pad)
    const s = Math.max(1, Math.floor(Math.min(availH, (2 / Math.sqrt(3)) * availW)))
    const heq = (Math.sqrt(3) / 2) * s
    const cx = x + w / 2
    const cy = y + h / 2
    const apexX = cx + heq / 2
    const baseX = cx - heq / 2
    const r = Math.floor(Math.min(w, h) * 0.12)
    this.drawRoundedTriangle(
      ctx,
      { x: baseX, y: cy - s / 2 },
      { x: baseX, y: cy + s / 2 },
      { x: apexX, y: cy },
      r,
    )
  }
}
