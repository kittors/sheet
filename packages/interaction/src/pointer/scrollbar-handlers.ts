import type { Context, State } from '../types'
import { applyHThumb, applyVThumb } from '../scrollbar'
import { computeAvailViewport } from '../viewport'

export function createScrollbarHandlers(
  ctx: Context,
  state: State,
  deps: { schedule: () => void; focusIme?: () => void },
) {
  // Continuous scroll when holding arrow buttons
  let arrowActive = false
  let arrowVX = 0
  let arrowVY = 0
  let arrowTimer: any = 0
  function clampAndSchedule() {
    const { widthAvail, heightAvail, contentWidth, contentHeight } = computeAvailViewport(ctx)
    const maxX = Math.max(0, contentWidth - widthAvail)
    const maxY = Math.max(0, contentHeight - heightAvail)
    state.scroll.x = Math.max(0, Math.min(maxX, state.scroll.x))
    state.scroll.y = Math.max(0, Math.min(maxY, state.scroll.y))
    deps.schedule()
  }
  function arrowStepOnce() {
    state.scroll.x += arrowVX
    state.scroll.y += arrowVY
    clampAndSchedule()
  }
  function startTimer() {
    // Use a timer to avoid relying on pointermove; 60fps is acceptable but a bit fast.
    // 30fps felt smoother for discrete cell stepping.
    clearInterval(arrowTimer)
    arrowTimer = setInterval(arrowStepOnce, 33)
  }
  function startArrowHold(dir: 'v-up' | 'v-down' | 'h-left' | 'h-right') {
    // Use row/col default sizes as step size for predictable movement
    const stepX = Math.max(8, Math.floor(ctx.metrics.defaultColWidth / 4))
    const stepY = Math.max(8, Math.floor(ctx.metrics.defaultRowHeight / 2))
    arrowVX = dir === 'h-left' ? -stepX : dir === 'h-right' ? stepX : 0
    arrowVY = dir === 'v-up' ? -stepY : dir === 'v-down' ? stepY : 0
    arrowActive = true
    // Mark drag mode for consistent cursor/hover state and to prioritize scrollbar interactions
    if (dir === 'v-up' || dir === 'v-down') state.dragMode = 'vscroll'
    if (dir === 'h-left' || dir === 'h-right') state.dragMode = 'hscroll'
    // Immediate feedback
    arrowStepOnce()
    // Then continuous by timer
    startTimer()
  }
  function stopArrowHold() {
    arrowActive = false
    clearInterval(arrowTimer)
    arrowTimer = 0
  }

  function tryPointerDown(x: number, y: number): boolean {
    const sb = ctx.renderer.getScrollbars?.()
    if (!sb) return false
    // Arrow hit-tests first (if present)
    if (sb.vArrowUp && x >= sb.vArrowUp.x && x <= sb.vArrowUp.x + sb.vArrowUp.w && y >= sb.vArrowUp.y && y <= sb.vArrowUp.y + sb.vArrowUp.h) {
      ctx.renderer.setScrollbarState?.({ vActive: true })
      startArrowHold('v-up')
      deps.focusIme?.()
      return true
    }
    if (sb.vArrowDown && x >= sb.vArrowDown.x && x <= sb.vArrowDown.x + sb.vArrowDown.w && y >= sb.vArrowDown.y && y <= sb.vArrowDown.y + sb.vArrowDown.h) {
      ctx.renderer.setScrollbarState?.({ vActive: true })
      startArrowHold('v-down')
      deps.focusIme?.()
      return true
    }
    if (sb.hArrowLeft && x >= sb.hArrowLeft.x && x <= sb.hArrowLeft.x + sb.hArrowLeft.w && y >= sb.hArrowLeft.y && y <= sb.hArrowLeft.y + sb.hArrowLeft.h) {
      ctx.renderer.setScrollbarState?.({ hActive: true })
      startArrowHold('h-left')
      deps.focusIme?.()
      return true
    }
    if (sb.hArrowRight && x >= sb.hArrowRight.x && x <= sb.hArrowRight.x + sb.hArrowRight.w && y >= sb.hArrowRight.y && y <= sb.hArrowRight.y + sb.hArrowRight.h) {
      ctx.renderer.setScrollbarState?.({ hActive: true })
      startArrowHold('h-right')
      deps.focusIme?.()
      return true
    }
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
    // While holding an arrow for continuous scroll, ignore pointer moves to avoid
    // accidental thumb jumps when the pointer leaves the scrollbar area.
    if (arrowActive) {
      deps.schedule()
      return true
    }
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

  return { tryPointerDown, handleMove, stopArrowHold }
}
