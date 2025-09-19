import type { Layer, RenderContext } from '../types/context'

export class EditorLayer implements Layer {
  name = 'editor'
  render(rc: RenderContext) {
    const ed = rc.editor
    if (!ed) return
    const { ctx } = rc
    ctx.save()
    const { sheet, defaultColWidth, defaultRowHeight, originX, originY } = rc
    const { r, c } = ed
    // compute cell position
    if (r < 0 || c < 0 || r >= sheet.rows || c >= sheet.cols) return

    // If cell is within a merge, anchor is top-left; this layer is called with anchor coords
    // compute x,y,width,height summing through possible merged span
    let x = originX
    for (let cc = 0; cc < c; cc++) x += sheet.colWidths.get(cc) ?? defaultColWidth
    let y = originY
    for (let rr = 0; rr < r; rr++) y += sheet.rowHeights.get(rr) ?? defaultRowHeight
    let w = sheet.colWidths.get(c) ?? defaultColWidth
    let h = sheet.rowHeights.get(r) ?? defaultRowHeight
    const m = sheet.getMergeAt(r, c)
    if (m && m.r === r && m.c === c) {
      w = 0
      for (let cc = m.c; cc < m.c + m.cols; cc++) w += sheet.colWidths.get(cc) ?? defaultColWidth
      h = 0
      for (let rr = m.r; rr < m.r + m.rows; rr++) h += sheet.rowHeights.get(rr) ?? defaultRowHeight
    }

    // draw background same as cell fill (cover selection highlight)
    const style = sheet.getStyleAt(r, c)
    const bg = style?.fill?.backgroundColor ?? '#ffffff'
    ctx.save()
    ctx.beginPath()
    // Clip only for background so it doesn't spill; text/caret may overflow if needed
    ctx.rect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2))
    ctx.clip()
    ctx.fillStyle = bg
    ctx.fillRect(Math.floor(x) + 1, Math.floor(y) + 1, Math.max(0, Math.floor(w) - 2), Math.max(0, Math.floor(h) - 2))
    ctx.restore()

    // draw caret (and position) without clipping
    // font from style if provided
    if (style?.font) {
      const size = style.font.size ?? 14
      const family = style.font.family ?? 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
      const weight = style.font.bold ? 'bold' : 'normal'
      const italic = style.font.italic ? 'italic ' : ''
      ctx.font = `${italic}${weight} ${size}px ${family}`
    } else {
      ctx.font = 'normal 14px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
    }
    const paddingX = 4
    const tx = x + paddingX
    const wrap = !!style?.alignment?.wrapText
    const fontSize = style?.font?.size ?? 14
    const lineH = Math.max(12, Math.round(fontSize * 1.25))
    ctx.textAlign = 'left'
    ctx.textBaseline = wrap ? 'top' : 'middle'

    // Draw current editing text (clipped within cell); caret may overflow separately
    const text = ed.text || ''
    ctx.fillStyle = style?.font?.color ?? '#111827'
    ctx.save()
    ctx.beginPath()
    ctx.rect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2))
    ctx.clip()
    if (wrap) {
      const maxW = Math.max(0, w - 8)
      let i = 0
      const nAll = text.length
      let cursorY2 = y + 3
      while (i < nAll && cursorY2 <= y + h - 3) {
        let lo2 = i + 1, hi2 = nAll
        while (lo2 <= hi2) {
          const mid2 = Math.min(nAll, Math.max(i + 1, Math.floor((lo2 + hi2) / 2)))
          const seg2 = text.slice(i, mid2)
          const wSeg2 = ctx.measureText(seg2).width
          if (wSeg2 <= maxW) lo2 = mid2 + 1
          else hi2 = mid2 - 1
        }
        const k2 = Math.max(i + 1, hi2)
        ctx.fillText(text.slice(i, k2), tx, cursorY2)
        cursorY2 += lineH
        i = k2
      }
    } else {
      const ty = y + h / 2
      ctx.fillText(text, tx, ty)
    }
    ctx.restore()

    // When wrapping, compute caret line based on available width
    let caretX = tx
    let caretY = wrap ? (y + 3) : (y + h / 2)
    if (wrap) {
      const maxW = Math.max(0, w - 8)
      let i = 0
      const n = text.length
      let cy = y + 3
      while (i < Math.min(ed.caret, n)) {
        // find longest substring from i that fits
        let lo = i + 1, hi = Math.min(ed.caret, n)
        while (lo <= hi) {
          const mid = Math.min(Math.min(ed.caret, n), Math.max(i + 1, Math.floor((lo + hi) / 2)))
          const seg = text.slice(i, mid)
          const wSeg = ctx.measureText(seg).width
          if (wSeg <= maxW) lo = mid + 1
          else hi = mid - 1
        }
        const k = Math.max(i + 1, hi)
        // if caret is within this segment, measure head
        if (ed.caret <= k) {
          const head = text.slice(i, ed.caret)
          caretX = Math.floor(tx + ctx.measureText(head).width) + 0.5
          caretY = cy
          break
        }
        // advance to next line
        cy += lineH
        i = k
      }
      // if caret is at end and loop didn't set it
      if (i >= Math.min(ed.caret, n)) {
        const head = text.slice(i, Math.min(ed.caret, n))
        caretX = Math.floor(tx + ctx.measureText(head).width) + 0.5
        caretY = cy
      }
    } else {
      // single line: caret x is width of head
      const head = ed.text?.substring(0, Math.max(0, Math.min(ed.caret, ed.text.length))) ?? ''
      const advance = head ? ctx.measureText(head).width : 0
      caretX = Math.floor(tx + advance) + 0.5
    }

    // Draw caret (may overflow horizontally)
    if (ed.caretVisible) {
      const caretHeight = 16
      const top = wrap ? Math.floor(caretY) + 0.5 : Math.floor(y + (h - caretHeight) / 2) + 0.5
      const bottom = wrap ? top + lineH : top + caretHeight
      ctx.strokeStyle = '#1f2937'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(caretX, top)
      ctx.lineTo(caretX, bottom)
      ctx.stroke()
    }
    ctx.restore()
  }
}
