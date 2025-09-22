import type { Context, State } from '../types'
import { caretIndexFromPoint } from '@sheet/api'

export function createTextSelectHandlers(
  ctx: Context,
  state: State,
  deps: { setSelectionRange?: (a: number, b: number) => void; schedule: () => void },
) {
  async function tryBeginFromPointer(e: PointerEvent): Promise<boolean> {
    if (!state.editor) return false
    const ed = state.editor
    const rect = ctx.canvas.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top
    const originX = ctx.metrics.headerColWidth
    const originY = ctx.metrics.headerRowHeight
    let x0 = originX
    for (let cc = 0; cc < ed.c; cc++)
      x0 += ctx.sheet.colWidths.get(cc) ?? ctx.metrics.defaultColWidth
    x0 -= state.scroll.x
    let y0 = originY
    for (let rr = 0; rr < ed.r; rr++)
      y0 += ctx.sheet.rowHeights.get(rr) ?? ctx.metrics.defaultRowHeight
    y0 -= state.scroll.y
    let w = ctx.sheet.colWidths.get(ed.c) ?? ctx.metrics.defaultColWidth
    let h = ctx.sheet.rowHeights.get(ed.r) ?? ctx.metrics.defaultRowHeight
    const m = ctx.sheet.getMergeAt(ed.r, ed.c)
    if (m && m.r === ed.r && m.c === ed.c) {
      w = 0
      for (let cc = m.c; cc < m.c + m.cols; cc++)
        w += ctx.sheet.colWidths.get(cc) ?? ctx.metrics.defaultColWidth
      h = 0
      for (let rr = m.r; rr < m.r + m.rows; rr++)
        h += ctx.sheet.rowHeights.get(rr) ?? ctx.metrics.defaultRowHeight
    }
    let inside = clickX >= x0 && clickX <= x0 + w && clickY >= y0 && clickY <= y0 + h
    const style = ctx.sheet.getStyleAt(ed.r, ed.c)
    const wrap = !!style?.alignment?.wrapText
    const paddingX = 4
    const paddingY = 3
    // Outside cell box: allow starting selection in the overflow area only for wrap=false by
    // reusing single-line caret mapping later (here we keep conservative and require inside box)
    // This avoids depending on renderer.ctx in the main thread.
    if (!inside && !wrap) {
      // keep 'inside' as false; double-click path handles entering via overflow
    }
    if (!inside) return false
    const relX = Math.max(0, clickX - (x0 + paddingX))
    const relY = Math.max(0, clickY - (y0 + paddingY))
    let caret = ed.caret
    const text = ed.text || ''
    const wr: any = ctx.renderer as any
    if (wrap) {
      const maxW = Math.max(0, w - 8)
      const sizePx = style?.font?.size ?? 14
      const lineH = Math.max(12, Math.round(sizePx * 1.25))
      caret =
        (wr.caretIndexFromPoint
          ? await wr.caretIndexFromPoint(text, relX, relY, {
              maxWidth: maxW,
              font: style?.font,
              defaultSize: 14,
              lineHeight: lineH,
            })
          : caretIndexFromPoint(text, relX, relY, {
              maxWidth: maxW,
              font: style?.font,
              defaultSize: 14,
              lineHeight: lineH,
            })) ?? 0
    } else {
      caret =
        (wr.caretIndexFromPoint
          ? await wr.caretIndexFromPoint(text, relX, 0, {
              maxWidth: 1e9,
              font: style?.font,
              defaultSize: 14,
              lineHeight: (style?.font?.size ?? 14) * 1.25,
            })
          : caretIndexFromPoint(text, relX, 0, {
              maxWidth: 1e9,
              font: style?.font,
              defaultSize: 14,
              lineHeight: (style?.font?.size ?? 14) * 1.25,
            })) ?? 0
    }
    state.textSelectAnchor = caret
    deps.setSelectionRange?.(caret, caret)
    deps.schedule()
    state.dragMode = 'textselect'
    return true
  }

  async function handleMove(e: PointerEvent): Promise<boolean> {
    if (!(state.dragMode === 'textselect' && state.editor)) return false
    const ed = state.editor
    const rect = ctx.canvas.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top
    const originX = ctx.metrics.headerColWidth
    const originY = ctx.metrics.headerRowHeight
    let x0 = originX
    for (let cc = 0; cc < ed.c; cc++)
      x0 += ctx.sheet.colWidths.get(cc) ?? ctx.metrics.defaultColWidth
    x0 -= state.scroll.x
    let y0 = originY
    for (let rr = 0; rr < ed.r; rr++)
      y0 += ctx.sheet.rowHeights.get(rr) ?? ctx.metrics.defaultRowHeight
    y0 -= state.scroll.y
    let w = ctx.sheet.colWidths.get(ed.c) ?? ctx.metrics.defaultColWidth
    const m = ctx.sheet.getMergeAt(ed.r, ed.c)
    if (m && m.r === ed.r && m.c === ed.c) {
      w = 0
      for (let cc = m.c; cc < m.c + m.cols; cc++)
        w += ctx.sheet.colWidths.get(cc) ?? ctx.metrics.defaultColWidth
    }
    const style = ctx.sheet.getStyleAt(ed.r, ed.c)
    const wrap = !!style?.alignment?.wrapText
    const paddingX = 4
    const paddingY = 3
    const relX = Math.max(0, clickX - (x0 + paddingX))
    const relY = Math.max(0, clickY - (y0 + paddingY))
    const text = ed.text || ''
    let caret = ed.caret
    if (wrap) {
      const maxW = Math.max(0, w - 8)
      const sizePx = style?.font?.size ?? 14
      const lineH = Math.max(12, Math.round(sizePx * 1.25))
      caret = caretIndexFromPoint(text, relX, relY, {
        maxWidth: maxW,
        font: style?.font,
        defaultSize: 14,
        lineHeight: lineH,
      })
    } else {
      caret = caretIndexFromPoint(text, relX, 0, {
        maxWidth: 1e9,
        font: style?.font,
        defaultSize: 14,
        lineHeight: (style?.font?.size ?? 14) * 1.25,
      })
    }
    const anchor = state.textSelectAnchor != null ? state.textSelectAnchor : ed.caret
    deps.setSelectionRange?.(anchor, caret)
    deps.schedule()
    return true
  }

  return { tryBeginFromPointer, handleMove }
}
