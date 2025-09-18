import type { Context, State } from './types'

export function createRender(ctx: Context, state: State) {
  function render() {
    const rect = ctx.canvas.parentElement!.getBoundingClientRect()
    const w = Math.floor(rect.width)
    const h = Math.floor(rect.height)
    if (ctx.canvas.clientWidth !== w || ctx.canvas.clientHeight !== h) {
      ctx.canvas.style.width = `${w}px`
      ctx.canvas.style.height = `${h}px`
      ctx.renderer.resize(w, h)
    }
    ctx.renderer.setSelection(state.selection)
    ctx.renderer.render(ctx.sheet, state.scroll.x, state.scroll.y)
    if (ctx.debug) {
      const sb = ctx.renderer.getScrollbars?.()
      // eslint-disable-next-line no-console
      console.log('[sheet] render', { size: { w, h }, scroll: { ...state.scroll }, sb })
    }
  }

  function schedule() {
    cancelAnimationFrame(state.raf)
    state.raf = requestAnimationFrame(render)
  }

  return { render, schedule }
}

