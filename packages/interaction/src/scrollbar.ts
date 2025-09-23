import type { Context, State } from './types'
import { computeAvailViewport } from './viewport'

export function applyVThumb(ctx: Context, state: State, newTop: number) {
  const sb = ctx.renderer.getScrollbars?.()
  if (!sb?.vTrack) return
  const trackSpan = sb.vTrack.h
  const thumbLen = sb.vThumb ? sb.vThumb.h : 0
  const maxThumbTop = Math.max(0, trackSpan - thumbLen)
  const frac = maxThumbTop > 0 ? newTop / maxThumbTop : 0
  const { heightAvail: viewportContentHeight, contentHeight, maxScrollY } = computeAvailViewport(ctx)
  const scrollRange =
    typeof maxScrollY === 'number' ? Math.max(0, maxScrollY) : Math.max(0, contentHeight - viewportContentHeight)
  state.scroll.y = Math.max(0, Math.min(scrollRange, Math.floor(frac * scrollRange)))
}

export function applyHThumb(ctx: Context, state: State, newLeft: number) {
  const sb = ctx.renderer.getScrollbars?.()
  if (!sb?.hTrack) return
  const trackSpan = sb.hTrack.w
  const thumbLen = sb.hThumb ? sb.hThumb.w : 0
  const maxThumbLeft = Math.max(0, trackSpan - thumbLen)
  const frac = maxThumbLeft > 0 ? newLeft / maxThumbLeft : 0
  const { widthAvail: viewportContentWidth, contentWidth, maxScrollX } = computeAvailViewport(ctx)
  const scrollRange =
    typeof maxScrollX === 'number' ? Math.max(0, maxScrollX) : Math.max(0, contentWidth - viewportContentWidth)
  state.scroll.x = Math.max(0, Math.min(scrollRange, Math.floor(frac * scrollRange)))
}
