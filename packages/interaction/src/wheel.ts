import type { Context, State } from './types'

export function createWheelHandler(
  ctx: Context,
  state: State,
  deps: { schedule: () => void; normalizeScroll: () => void },
) {
  function onWheel(e: WheelEvent) {
    e.preventDefault()
    state.scroll.x = Math.max(0, state.scroll.x + e.deltaX)
    state.scroll.y = Math.max(0, state.scroll.y + e.deltaY)
    deps.normalizeScroll()
    deps.schedule()
  }
  return { onWheel }
}
