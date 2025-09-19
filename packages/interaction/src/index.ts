import type { AttachArgs, Context, InteractionHandle } from './types'
export type { InteractionHandle } from './types'
export type { CanvasRenderer } from '@sheet/renderer'
import { createState } from './state'
import { createRender } from './render'
import { computeAvailViewport } from './viewport'
import { createWheelHandler } from './wheel'
import { createPointerHandlers } from './pointer'
import { createCommands } from './commands'
import { attachKeyboard } from './keyboard'
import { posToCell } from './hit'
import { caretIndexFromPoint, fontStringFromStyle, wrapTextIndices } from '@sheet/api'

export function attachSheetInteractions(args: AttachArgs): InteractionHandle {
  const ctx: Context = {
    canvas: args.canvas,
    renderer: args.renderer,
    sheet: args.sheet,
    metrics: {
      defaultColWidth: args.renderer.opts.defaultColWidth!,
      defaultRowHeight: args.renderer.opts.defaultRowHeight!,
      headerColWidth: args.renderer.opts.headerColWidth!,
      headerRowHeight: args.renderer.opts.headerRowHeight!,
      scrollbarThickness: args.renderer.opts.scrollbarThickness!,
    },
  }

  const state = createState()
  const { schedule } = createRender(ctx, state)

  function normalizeScroll() {
    const { widthAvail, heightAvail, contentWidth, contentHeight } = computeAvailViewport(ctx)
    const maxX = Math.max(0, contentWidth - widthAvail)
    const maxY = Math.max(0, contentHeight - heightAvail)
    state.scroll.x = Math.max(0, Math.min(maxX, state.scroll.x))
    state.scroll.y = Math.max(0, Math.min(maxY, state.scroll.y))
  }

  const { onWheel } = createWheelHandler(ctx, state, { schedule, normalizeScroll })
  const { onPointerDown, onPointerMove, onPointerUp, onPointerLeave } = createPointerHandlers(ctx, state, { schedule })
  const kb = attachKeyboard(ctx, state, { schedule })

  // prevent browser defaults that interfere with pointer interactions
  ctx.canvas.style.touchAction = 'none'
  ctx.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  // wheel handler attached via addEventListener below (no onwheel fallback needed)
  schedule()
  window.addEventListener('resize', schedule)
  ctx.canvas.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  ctx.canvas.addEventListener('pointerleave', onPointerLeave)
  ctx.canvas.addEventListener('wheel', onWheel, { passive: false })
  ctx.canvas.addEventListener('dblclick', onDblClick)

  function colLeft(index: number): number {
    let base = index * ctx.metrics.defaultColWidth
    if (ctx.sheet.colWidths.size) for (const [c, w] of ctx.sheet.colWidths) { if (c < index) base += (w - ctx.metrics.defaultColWidth) }
    return base
  }
  function rowTop(index: number): number {
    let base = index * ctx.metrics.defaultRowHeight
    if (ctx.sheet.rowHeights.size) for (const [r, h] of ctx.sheet.rowHeights) { if (r < index) base += (h - ctx.metrics.defaultRowHeight) }
    return base
  }
  function onDblClick(e: MouseEvent) {
    const cell = posToCell(ctx, state, e.clientX, e.clientY)
    if (!cell) return
    // resolve anchor if merged
    const m = ctx.sheet.getMergeAt(cell.r, cell.c)
    const ar = m ? m.r : cell.r
    const ac = m ? m.c : cell.c
    const style = ctx.sheet.getStyleAt(ar, ac)
    // compute cell rect in canvas coords
    const originX = ctx.metrics.headerColWidth
    const originY = ctx.metrics.headerRowHeight
    const x0 = originX + colLeft(ac) - state.scroll.x
    const y0 = originY + rowTop(ar) - state.scroll.y
    let w = ctx.sheet.colWidths.get(ac) ?? ctx.metrics.defaultColWidth
    let h = ctx.sheet.rowHeights.get(ar) ?? ctx.metrics.defaultRowHeight
    if (m) {
      w = 0; for (let cc = m.c; cc < m.c + m.cols; cc++) w += ctx.sheet.colWidths.get(cc) ?? ctx.metrics.defaultColWidth
      h = 0; for (let rr = m.r; rr < m.r + m.rows; rr++) h += ctx.sheet.rowHeights.get(rr) ?? ctx.metrics.defaultRowHeight
    }
    // map click x to caret index
    const rect = ctx.canvas.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top
    const paddingX = 4
    const paddingY = 3
    const relX = Math.max(0, clickX - (x0 + paddingX))
    const relY = Math.max(0, clickY - (y0 + paddingY))
    const v = ctx.sheet.getValueAt(ar, ac)
    const text = v == null ? '' : String(v)
    // use same font as editor layer for measurement
    ctx.renderer.ctx.save()
    // Use shared API for text layout mapping
    const wrap = !!style?.alignment?.wrapText
    let caret = 0
    if (text) {
      if (wrap) {
        const maxW = Math.max(0, w - 8)
        const sizePx = style?.font?.size ?? 14
        const lineH = Math.max(12, Math.round(sizePx * 1.25))
        caret = caretIndexFromPoint(text, relX, relY, { maxWidth: maxW, font: style?.font, defaultSize: 14, lineHeight: lineH })
      } else {
        // map single line using shared measure
        const font = fontStringFromStyle(style?.font, 14)
        // get measuring context
        const ctx2 = (ctx.renderer.ctx as CanvasRenderingContext2D)
        ctx2.save()
        ctx2.font = font
        let acc = 0
        for (let i = 0; i < text.length; i++) {
          const wch = ctx2.measureText(text[i]).width
          if (acc + wch / 2 >= relX) { caret = i; break }
          acc += wch
          caret = i + 1
        }
        ctx2.restore()
      }
    }
    ctx.renderer.ctx.restore()
    // begin editing and set caret at computed position
    kb.editor.beginAt(ar, ac)
    kb.editor.setCaret(caret)
  }

  const cmds = createCommands(ctx, state, { schedule })
  return {
    destroy() {
      window.removeEventListener('resize', schedule)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      ctx.canvas.removeEventListener('pointerleave', onPointerLeave)
      ctx.canvas.removeEventListener('wheel', onWheel)
      ctx.canvas.removeEventListener('dblclick', onDblClick)
      kb.destroy()
      cancelAnimationFrame(state.raf)
    },
    ...cmds,
    getSelection() { return state.selection },
    getScroll() { return { ...state.scroll } },
  }
}
