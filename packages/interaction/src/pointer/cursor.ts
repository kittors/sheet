import type { Context, State } from '../types'

export function createCursorHandlers(
  ctx: Context,
  state: State,
  deps: {
    schedule: () => void
    hitColResize: (x: number, y: number) => number | null
    hitRowResize: (x: number, y: number) => number | null
  },
  opts?: {
    names?: { default: string; pointer: string; colResize: string; rowResize: string }
    hoverPointerOnScrollbar?: boolean
  },
) {
  const names = opts?.names ?? {
    default: 'default',
    pointer: 'pointer',
    colResize: 'col-resize',
    rowResize: 'row-resize',
  }
  const hoverOnSb = opts?.hoverPointerOnScrollbar ?? true

  function update(x: number, y: number) {
    let cursor = names.default
    // keep resize cursor while dragging
    if (state.dragMode === 'colresize') cursor = names.colResize
    if (state.dragMode === 'rowresize') cursor = names.rowResize

    // Scrollbar hover state (only when not dragging anything else)
    const sb0 = ctx.renderer.getScrollbars?.()
    if (state.dragMode === 'none' && sb0) {
      const inVTrack = !!(
        sb0.vTrack &&
        x >= sb0.vTrack.x &&
        x <= sb0.vTrack.x + sb0.vTrack.w &&
        y >= sb0.vTrack.y &&
        y <= sb0.vTrack.y + sb0.vTrack.h
      )
      const inVThumb = !!(
        sb0.vThumb &&
        x >= sb0.vThumb.x &&
        x <= sb0.vThumb.x + sb0.vThumb.w &&
        y >= sb0.vThumb.y &&
        y <= sb0.vThumb.y + sb0.vThumb.h
      )
      const inVArrowUp = !!(
        sb0.vArrowUp &&
        x >= sb0.vArrowUp.x &&
        x <= sb0.vArrowUp.x + sb0.vArrowUp.w &&
        y >= sb0.vArrowUp.y &&
        y <= sb0.vArrowUp.y + sb0.vArrowUp.h
      )
      const inVArrowDown = !!(
        sb0.vArrowDown &&
        x >= sb0.vArrowDown.x &&
        x <= sb0.vArrowDown.x + sb0.vArrowDown.w &&
        y >= sb0.vArrowDown.y &&
        y <= sb0.vArrowDown.y + sb0.vArrowDown.h
      )
      const inVArrow = inVArrowUp || inVArrowDown
      const inV = inVTrack || inVThumb || inVArrow
      const inHTrack = !!(
        sb0.hTrack &&
        x >= sb0.hTrack.x &&
        x <= sb0.hTrack.x + sb0.hTrack.w &&
        y >= sb0.hTrack.y &&
        y <= sb0.hTrack.y + sb0.hTrack.h
      )
      const inHThumb = !!(
        sb0.hThumb &&
        x >= sb0.hThumb.x &&
        x <= sb0.hThumb.x + sb0.hThumb.w &&
        y >= sb0.hThumb.y &&
        y <= sb0.hThumb.y + sb0.hThumb.h
      )
      const inHArrowLeft = !!(
        sb0.hArrowLeft &&
        x >= sb0.hArrowLeft.x &&
        x <= sb0.hArrowLeft.x + sb0.hArrowLeft.w &&
        y >= sb0.hArrowLeft.y &&
        y <= sb0.hArrowLeft.y + sb0.hArrowLeft.h
      )
      const inHArrowRight = !!(
        sb0.hArrowRight &&
        x >= sb0.hArrowRight.x &&
        x <= sb0.hArrowRight.x + sb0.hArrowRight.w &&
        y >= sb0.hArrowRight.y &&
        y <= sb0.hArrowRight.y + sb0.hArrowRight.h
      )
      const inHArrow = inHArrowLeft || inHArrowRight
      const inH = inHTrack || inHThumb || inHArrow
      ctx.renderer.setScrollbarState?.({
        vHover: inV,
        hHover: inH,
        vArrowHoverUp: inVArrowUp,
        vArrowHoverDown: inVArrowDown,
        hArrowHoverLeft: inHArrowLeft,
        hArrowHoverRight: inHArrowRight,
      })
      deps.schedule()
      if (hoverOnSb && (inV || inH)) cursor = names.pointer
    }

    // Resize handles hover
    if (state.dragMode === 'none') {
      const cIdx = deps.hitColResize(x, y)
      const rIdx = deps.hitRowResize(x, y)
      if (cIdx != null) cursor = names.colResize
      else if (rIdx != null) cursor = names.rowResize
    }

    ;(ctx.canvas.parentElement as HTMLElement).style.cursor = cursor
  }

  return { update }
}
