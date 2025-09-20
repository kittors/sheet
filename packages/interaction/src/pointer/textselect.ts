import type { Context, State } from '../types'
import { caretIndexFromPoint, fontStringFromStyle } from '@sheet/api'

export function createTextSelectHandlers(
  ctx: Context,
  state: State,
  deps: { setSelectionRange?: (a: number, b: number) => void; schedule: () => void },
) {
  function tryBeginFromPointer(e: PointerEvent): boolean {
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
    if (!inside && !wrap) {
      const ctx2 = ctx.renderer.ctx as CanvasRenderingContext2D
      ctx2.save()
      ctx2.font = fontStringFromStyle(style?.font, 14)
      const textW = ctx2.measureText(ed.text || '').width
      ctx2.restore()
      const tx = x0 + paddingX
      const rightX = tx + textW + 2
      if (clickY >= y0 && clickY <= y0 + h && clickX >= tx && clickX <= rightX) inside = true
    }
    if (!inside) return false
    const relX = Math.max(0, clickX - (x0 + paddingX))
    const relY = Math.max(0, clickY - (y0 + paddingY))
    let caret = ed.caret
    const text = ed.text || ''
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
      const ctx2 = ctx.renderer.ctx as CanvasRenderingContext2D
      ctx2.save()
      ctx2.font = fontStringFromStyle(style?.font, 14)
      let acc = 0
      caret = 0
      for (let i = 0; i < text.length; i++) {
        const wch = ctx2.measureText(text[i]).width
        if (acc + wch / 2 >= relX) {
          caret = i
          break
        }
        acc += wch
        caret = i + 1
      }
      ctx2.restore()
    }
    state.textSelectAnchor = caret
    deps.setSelectionRange?.(caret, caret)
    deps.schedule()
    state.dragMode = 'textselect'
    return true
  }

  function handleMove(e: PointerEvent): boolean {
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
      const ctx2 = ctx.renderer.ctx as CanvasRenderingContext2D
      ctx2.save()
      ctx2.font = fontStringFromStyle(style?.font, 14)
      let acc = 0
      caret = 0
      for (let i = 0; i < text.length; i++) {
        const wch = ctx2.measureText(text[i]).width
        if (acc + wch / 2 >= relX) {
          caret = i
          break
        }
        acc += wch
        caret = i + 1
      }
      ctx2.restore()
    }
    const anchor = state.textSelectAnchor != null ? state.textSelectAnchor : ed.caret
    deps.setSelectionRange?.(anchor, caret)
    deps.schedule()
    return true
  }

  return { tryBeginFromPointer, handleMove }
}
