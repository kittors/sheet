import type { Context, State } from '../types'
import { applyHThumb, applyVThumb } from '../scrollbar'

export function createScrollbarHandlers(
  ctx: Context,
  state: State,
  deps: { schedule: () => void; focusIme?: () => void },
) {
  function tryPointerDown(x: number, y: number): boolean {
    const sb = ctx.renderer.getScrollbars?.()
    if (!sb) return false
    // Vertical
    if (
      sb.vTrack &&
      x >= sb.vTrack.x &&
      x <= sb.vTrack.x + sb.vTrack.w &&
      y >= sb.vTrack.y &&
      y <= sb.vTrack.y + sb.vTrack.h
    ) {
      state.dragMode = 'vscroll'
      ctx.renderer.setScrollbarState?.({ vActive: true })
      if (sb.vThumb && y >= sb.vThumb.y && y <= sb.vThumb.y + sb.vThumb.h) {
        state.dragGrabOffset = y - sb.vThumb.y
      } else {
        const trackSpan = sb.vTrack.h
        const thumbLen = sb.vThumb ? sb.vThumb.h : 0
        const newTop = Math.max(0, Math.min(trackSpan - thumbLen, y - sb.vTrack.y - thumbLen / 2))
        applyVThumb(ctx, state, newTop)
      }
      deps.schedule()
      deps.focusIme?.()
      return true
    }
    // Horizontal
    if (
      sb.hTrack &&
      x >= sb.hTrack.x &&
      x <= sb.hTrack.x + sb.hTrack.w &&
      y >= sb.hTrack.y &&
      y <= sb.hTrack.y + sb.hTrack.h
    ) {
      state.dragMode = 'hscroll'
      ctx.renderer.setScrollbarState?.({ hActive: true })
      if (sb.hThumb && x >= sb.hThumb.x && x <= sb.hThumb.x + sb.hThumb.w) {
        state.dragGrabOffset = x - sb.hThumb.x
      } else {
        const trackSpan = sb.hTrack.w
        const thumbLen = sb.hThumb ? sb.hThumb.w : 0
        const newLeft = Math.max(0, Math.min(trackSpan - thumbLen, x - sb.hTrack.x - thumbLen / 2))
        applyHThumb(ctx, state, newLeft)
      }
      deps.schedule()
      deps.focusIme?.()
      return true
    }
    return false
  }

  function handleMove(e: PointerEvent, rect: DOMRect): boolean {
    if (state.dragMode === 'vscroll') {
      const sb = ctx.renderer.getScrollbars?.()
      if (!sb?.vTrack || !sb?.vThumb) return true
      const y = e.clientY - rect.top
      const trackSpan = sb.vTrack.h
      const newTop = Math.max(
        0,
        Math.min(trackSpan - sb.vThumb.h, y - sb.vTrack.y - state.dragGrabOffset),
      )
      applyVThumb(ctx, state, newTop)
      deps.schedule()
      return true
    }
    if (state.dragMode === 'hscroll') {
      const sb = ctx.renderer.getScrollbars?.()
      if (!sb?.hTrack || !sb?.hThumb) return true
      const x = e.clientX - rect.left
      const trackSpan = sb.hTrack.w
      const newLeft = Math.max(
        0,
        Math.min(trackSpan - sb.hThumb.w, x - sb.hTrack.x - state.dragGrabOffset),
      )
      applyHThumb(ctx, state, newLeft)
      deps.schedule()
      return true
    }
    return false
  }

  return { tryPointerDown, handleMove }
}
