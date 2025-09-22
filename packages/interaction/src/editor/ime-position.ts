import type { Context, State } from '../types'
import type { Style } from '@sheet/core'
import { wrapTextIndices, measureText } from '@sheet/api'
import { colLeftFor, rowTopFor } from '@sheet/shared-utils'

export async function computeImeGeometry(
  ctx: Context,
  state: State,
  src: { r: number; c: number; text: string; caret: number },
) {
  const originX = ctx.metrics.headerColWidth
  const originY = ctx.metrics.headerRowHeight
  const x0 =
    originX + colLeftFor(src.c, ctx.metrics.defaultColWidth, ctx.sheet.colWidths) - state.scroll.x
  const y0 =
    originY + rowTopFor(src.r, ctx.metrics.defaultRowHeight, ctx.sheet.rowHeights) - state.scroll.y
  let w = ctx.sheet.colWidths.get(src.c) ?? ctx.metrics.defaultColWidth
  let h = ctx.sheet.rowHeights.get(src.r) ?? ctx.metrics.defaultRowHeight
  const m = ctx.sheet.getMergeAt(src.r, src.c)
  if (m && m.r === src.r && m.c === src.c) {
    w = 0
    for (let cc = m.c; cc < m.c + m.cols; cc++)
      w += ctx.sheet.colWidths.get(cc) ?? ctx.metrics.defaultColWidth
    h = 0
    for (let rr = m.r; rr < m.r + m.rows; rr++)
      h += ctx.sheet.rowHeights.get(rr) ?? ctx.metrics.defaultRowHeight
  }
  const paddingX = 4
  const style = ctx.sheet.getStyleAt(src.r, src.c)
  const wrap = !!style?.alignment?.wrapText
  const sizePx = style?.font?.size ?? 14
  const lineH = Math.max(12, Math.round(sizePx * 1.25))
  let caretX = x0 + paddingX
  let caretY = y0 + (wrap ? 3 : Math.floor(h / 2))
  const wr: any = ctx.renderer as any
  if (wrap) {
    const maxW = Math.max(0, w - 8)
    const lines = (wr.wrapTextIndices
      ? await wr.wrapTextIndices(src.text, maxW, style?.font, 14)
      : wrapTextIndices(src.text, maxW, style?.font, 14)) as Array<{ start: number; end: number }>
    let lineIndex = 0
    for (let li = 0; li < lines.length; li++) {
      if (src.caret <= lines[li].end) {
        lineIndex = li
        break
      }
      lineIndex = li
    }
    const seg = lines[Math.min(lineIndex, Math.max(0, lines.length - 1))]
    const head = src.text.slice(seg.start, Math.min(seg.end, src.caret))
    const advance = wr.measureText ? await wr.measureText(head, style?.font, 14) : measureText(head, style?.font, 14)
    caretX = Math.floor(x0 + paddingX + advance)
    caretY = Math.floor(y0 + 3 + lineIndex * lineH)
    return { caretX, caretY, lineH, hostWidth: Math.max(16, Math.floor(maxW)), sizePx, style }
  } else {
    const head = src.text.substring(0, src.caret)
    const advance = wr.measureText ? await wr.measureText(head, style?.font, 14) : measureText(head, style?.font, 14)
    caretX = Math.floor(x0 + paddingX + advance)
    caretY = Math.floor(y0 + (h - lineH) / 2)
    return { caretX, caretY, lineH, hostWidth: 480, sizePx, style }
  }
}

export function placeImeHost(
  ctx: Context,
  imeEl: HTMLTextAreaElement,
  geom: {
    caretX: number
    caretY: number
    lineH: number
    hostWidth: number
    sizePx: number
    style?: Style
  },
) {
  const fontFamily =
    geom.style?.font?.family ??
    'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
  const fontWeight = geom.style?.font?.bold ? 'bold' : 'normal'
  const fontItalic = geom.style?.font?.italic ? 'italic ' : ''
  imeEl.style.font = `${fontItalic}${fontWeight} ${geom.sizePx}px ${fontFamily}`
  imeEl.style.lineHeight = `${geom.lineH}px`
  const rect = ctx.canvas.getBoundingClientRect()
  const left = rect.left + geom.caretX
  const top = rect.top + geom.caretY
  imeEl.style.left = `${Math.round(left)}px`
  imeEl.style.top = `${Math.round(top)}px`
  imeEl.style.width = `${geom.hostWidth}px`
  imeEl.style.height = `${geom.lineH}px`
}
