import type { AttachArgs, Context, InteractionHandle } from './types'
export type { InteractionHandle } from './types'
export type { CanvasRenderer } from '@sheet/renderer'
import { createState } from './state'
import { createRender } from './render'
import { computeAvailViewport } from './viewport'
import { createWheelHandler } from './wheel'
import { createPointerHandlers } from './pointer'
import { createCommands } from './commands'

export function attachSheetInteractions(args: AttachArgs): InteractionHandle {
  const ctx: Context = {
    canvas: args.canvas,
    renderer: args.renderer,
    sheet: args.sheet,
    debug: !!args.debug,
    metrics: {
      defaultColWidth: args.renderer.opts.defaultColWidth,
      defaultRowHeight: args.renderer.opts.defaultRowHeight,
      headerColWidth: args.renderer.opts.headerColWidth,
      headerRowHeight: args.renderer.opts.headerRowHeight,
      scrollbarThickness: args.renderer.opts.scrollbarThickness,
    },
  }

  const state = createState()
  const { render, schedule } = createRender(ctx, state)

  function normalizeScroll() {
    const { widthAvail, heightAvail, contentWidth, contentHeight } = computeAvailViewport(ctx)
    const maxX = Math.max(0, contentWidth - widthAvail)
    const maxY = Math.max(0, contentHeight - heightAvail)
    state.scroll.x = Math.max(0, Math.min(maxX, state.scroll.x))
    state.scroll.y = Math.max(0, Math.min(maxY, state.scroll.y))
  }

  const { onWheel } = createWheelHandler(ctx, state, { schedule, normalizeScroll })
  const { onPointerDown, onPointerMove, onPointerUp, onPointerLeave } = createPointerHandlers(ctx, state, { schedule })

  // prevent browser defaults that interfere with pointer interactions
  ctx.canvas.style.touchAction = 'none'
  ctx.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  ;(ctx.canvas as any).onwheel = onWheel as any // fallback
  schedule()
  window.addEventListener('resize', schedule)
  ctx.canvas.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  ctx.canvas.addEventListener('pointerleave', onPointerLeave)
  ctx.canvas.addEventListener('wheel', onWheel, { passive: false })

  const cmds = createCommands(ctx, state, { schedule })
  return {
    destroy() {
      window.removeEventListener('resize', schedule)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      ctx.canvas.removeEventListener('pointerleave', onPointerLeave)
      ctx.canvas.removeEventListener('wheel', onWheel)
      cancelAnimationFrame(state.raf)
    },
    ...cmds,
  }
}
