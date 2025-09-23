import type { Context, State } from '../types'
import { computeAvailViewport } from '../viewport'

export function getScrollClamped(ctx: Context, state: State) {
  try {
    ;(ctx as any).infiniteScroll && ctx.renderer.render(ctx.sheet, state.scroll.x, state.scroll.y, 'ui')
  } catch (e) {
    void e
  }
  const { widthAvail, heightAvail, contentWidth, contentHeight } = computeAvailViewport(ctx)
  const maxX = Math.max(0, contentWidth - widthAvail)
  const maxY = Math.max(0, contentHeight - heightAvail)
  return {
    sX: Math.max(0, Math.min(state.scroll.x, maxX)),
    sY: Math.max(0, Math.min(state.scroll.y, maxY)),
  }
}
