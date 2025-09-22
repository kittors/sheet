import type { Context, State } from './types'

export function createRender(ctx: Context, state: State) {
  // Prefer measuring the root container that defines the visible area
  const parent =
    (ctx.canvas.closest('.sheet-canvas') as HTMLElement | null) ||
    (ctx.canvas.parentElement as HTMLElement)
  let lastW = 0
  let lastH = 0

  function syncSize() {
    // Measure container only when it actually changes (via ResizeObserver)
    const rect = parent.getBoundingClientRect()
    const w = Math.floor(rect.width)
    const h = Math.floor(rect.height)
    if (w === lastW && h === lastH) return
    lastW = w
    lastH = h
    if (ctx.canvas.clientWidth !== w || ctx.canvas.clientHeight !== h) {
      ctx.canvas.style.width = `${w}px`
      ctx.canvas.style.height = `${h}px`
      ctx.renderer.resize(w, h)
    }
  }

  // Keep canvas size in sync using ResizeObserver to avoid per-frame layout reads
  const ro = new ResizeObserver(() => {
    syncSize()
    // After resize, force a render to reflect new metrics quickly
    render()
  })
  ro.observe(parent)
  // Initial sync
  syncSize()

  function render() {
    ctx.renderer.setSelection(state.selection, state.selectAnchor)
    ctx.renderer.render(ctx.sheet, state.scroll.x, state.scroll.y)
  }

  function schedule() {
    cancelAnimationFrame(state.raf)
    state.raf = requestAnimationFrame(render)
  }

  function destroy() {
    try {
      ro.disconnect()
    } catch {
      /* no-op */
    }
  }

  return { render, schedule, destroy }
}
