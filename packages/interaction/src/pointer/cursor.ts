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
      const inV = !!(
        sb0.vTrack &&
        x >= sb0.vTrack.x &&
        x <= sb0.vTrack.x + sb0.vTrack.w &&
        y >= sb0.vTrack.y &&
        y <= sb0.vTrack.y + sb0.vTrack.h
      )
      const inH = !!(
        sb0.hTrack &&
        x >= sb0.hTrack.x &&
        x <= sb0.hTrack.x + sb0.hTrack.w &&
        y >= sb0.hTrack.y &&
        y <= sb0.hTrack.y + sb0.hTrack.h
      )
      ctx.renderer.setScrollbarState?.({ vHover: inV, hHover: inH })
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
