import type { Layer, RenderContext } from '../types/context'
import { wrapTextIndices } from '@sheet/api'

export class EditorLayer implements Layer {
  name = 'editor'
  render(rc: RenderContext) {
    const ed = rc.editor
    if (!ed) return
    // Only render when actively editing (selection range present). For "preview" overlay
    // on single-click selection, let ContentLayer render the text (so overflow remains visible).
    const isActiveEditing = ed.selStart != null && ed.selEnd != null
    if (!isActiveEditing) return
    const { ctx } = rc
    ctx.save()
    // Clip editor rendering to content area so it never intrudes into headers bands
    const vGap = rc.scrollbar.vTrack ? rc.scrollbar.thickness : 0
    const hGap = rc.scrollbar.hTrack ? rc.scrollbar.thickness : 0
    ctx.beginPath()
    ctx.rect(
      rc.originX,
      rc.originY,
      Math.max(0, rc.viewport.width - rc.originX - vGap),
      Math.max(0, rc.viewport.height - rc.originY - hGap),
    )
    ctx.clip()

    const { sheet, defaultColWidth, defaultRowHeight, originX, originY } = rc
    const { r, c } = ed
    // compute cell position
    if (r < 0 || c < 0 || r >= sheet.rows || c >= sheet.cols) return

    // If cell is within a merge, anchor is top-left; this layer is called with anchor coords
    // compute x,y using cumulative sizes minus scroll offsets so editor follows scroll
    const cumCol = (i: number) => {
      let sum = 0
      for (let cc = 0; cc < i; cc++) sum += sheet.colWidths.get(cc) ?? defaultColWidth
      return sum
    }
    const cumRow = (i: number) => {
      let sum = 0
      for (let rr = 0; rr < i; rr++) sum += sheet.rowHeights.get(rr) ?? defaultRowHeight
      return sum
    }
    const x = originX + cumCol(c) - rc.scroll.x
    const y = originY + cumRow(r) - rc.scroll.y
    let w = sheet.colWidths.get(c) ?? defaultColWidth
    let h = sheet.rowHeights.get(r) ?? defaultRowHeight
    const m = sheet.getMergeAt(r, c)
    if (m && m.r === r && m.c === c) {
      w = 0
      for (let cc = m.c; cc < m.c + m.cols; cc++) w += sheet.colWidths.get(cc) ?? defaultColWidth
      h = 0
      for (let rr = m.r; rr < m.r + m.rows; rr++) h += sheet.rowHeights.get(rr) ?? defaultRowHeight
    }

    // Draw background same as cell fill when actively editing only.
    // When not editing (preview overlay), do NOT paint a background so overflow text
    // from adjacent cells remains visible when selecting an empty neighbor.
    const style = sheet.getStyleAt(r, c)
    const bg = style?.fill?.backgroundColor ?? '#ffffff'
    const isEditing = isActiveEditing
    if (isEditing) {
      ctx.save()
      // Fill the full cell box to avoid gaps, while still keeping editor text/caret allowed to overflow
      ctx.fillStyle = bg
      ctx.fillRect(
        Math.floor(x),
        Math.floor(y),
        Math.max(0, Math.floor(w)),
        Math.max(0, Math.floor(h)),
      )
      ctx.restore()
    }

    // draw caret (and position), and overlay text; ensure我们优先显示编辑内容，并在需要时遮挡右侧固定内容
    // font from style if provided
    if (style?.font) {
      const size = style.font.size ?? 14
      const family =
        style.font.family ??
        'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
      const weight = style.font.bold ? 'bold' : 'normal'
      const italic = style.font.italic ? 'italic ' : ''
      ctx.font = `${italic}${weight} ${size}px ${family}`
    } else {
      ctx.font =
        'normal 14px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
    }
    const paddingX = 4
    const tx = x + paddingX
    const wrap = !!style?.alignment?.wrapText
    const fontSize = style?.font?.size ?? 14
    const lineH = Math.max(12, Math.round(fontSize * 1.25))
    ctx.textAlign = 'left'
    ctx.textBaseline = wrap ? 'top' : 'middle'

    // Prepare text to draw
    const textToDraw = ed.text || ''
    // Detect whether we should allow overlay text to extend beyond the anchor cell box.
    // If there is a non-empty cell immediately to the left, we keep the editor text
    // clipped within the anchor cell to avoid occluding left cell overflow (e.g. editing B8 while A8 overflows).
    let allowExtend = true
    if (c - 1 >= 0) {
      const leftVal = rc.sheet.getValueAt(r, c - 1)
      const hasLeft = leftVal != null && String(leftVal) !== ''
      if (hasLeft) allowExtend = false
    }

    // Draw overlay text within allowed region (for single-line); wrap stays within cell anyway
    ctx.save()
    if (!wrap) {
      // Compute dynamic right limit when extending is allowed; otherwise clip to cell box.
      let clipRightX = x + w
      if (allowExtend) {
        const vGap2 = rc.scrollbar.vTrack ? rc.scrollbar.thickness : 0
        const viewportRight = rc.viewport.width - vGap2
        // base desired right by measuring text
        const desiredRight = tx + (textToDraw ? ctx.measureText(textToDraw).width : 0) + 2
        // scan to find first blocker (occupied cell) to the right
        let aw = sheet.colWidths.get(c) ?? defaultColWidth
        const am = sheet.getMergeAt(r, c)
        if (am && am.r === r && am.c === c) {
          aw = 0
          for (let cc = am.c; cc < am.c + am.cols; cc++) aw += sheet.colWidths.get(cc) ?? defaultColWidth
        }
        let curX = x + aw
        let scanC = am && am.r === r && am.c === c ? am.c + am.cols : c + 1
        let rightLimit = viewportRight
        while (scanC < sheet.cols) {
          const vHere = sheet.getValueAt(r, scanC)
          const hasValHere = vHere != null && String(vHere) !== ''
          if (hasValHere) {
            rightLimit = Math.min(rightLimit, curX)
            break
          }
          const w2 = sheet.colWidths.get(scanC) ?? defaultColWidth
          curX += w2
          scanC++
        }
        clipRightX = Math.min(desiredRight, rightLimit)
      }
      ctx.beginPath()
      ctx.rect(x + 1, y + 1, Math.max(0, Math.floor(clipRightX - x) - 2), Math.max(0, h - 2))
      ctx.clip()
      if (isEditing) {
        // Background remains within the anchor cell to avoid masking neighbor cells
        ctx.fillStyle = bg
        ctx.fillRect(
          Math.floor(x) + 1,
          Math.floor(y) + 1,
          Math.max(0, Math.floor(w) - 2),
          Math.max(0, Math.floor(h) - 2),
        )
      }
    } else {
      ctx.beginPath()
      ctx.rect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2))
      ctx.clip()
    }
    // draw text
    const textColor = style?.font?.color ?? '#111827'
    ctx.fillStyle = textColor
    if (wrap) {
      const maxW = Math.max(0, w - 8)
      let cursorY2 = y + 3
      const size = style?.font?.size ?? 14
      const lineH = Math.max(12, Math.round(size * 1.25))
      const lines = wrapTextIndices(textToDraw, maxW, style?.font, 14)
      for (let li = 0; li < lines.length; li++) {
        if (cursorY2 > y + h - 3) break
        const seg = lines[li]
        const run = textToDraw.slice(seg.start, seg.end)
        // draw selection highlight for selAll or partial range
        const selStart = rc.editor?.selAll ? 0 : (rc.editor?.selStart ?? rc.editor?.caret ?? 0)
        const selEnd = rc.editor?.selAll
          ? textToDraw.length
          : (rc.editor?.selEnd ?? rc.editor?.caret ?? 0)
        const s = Math.min(selStart, selEnd)
        const e = Math.max(selStart, selEnd)
        const lineS = Math.max(seg.start, s)
        const lineE = Math.min(seg.end, e)
        if (lineE > lineS) {
          const headW = ctx.measureText(textToDraw.slice(seg.start, lineS)).width
          const selW = ctx.measureText(textToDraw.slice(lineS, lineE)).width
          ctx.fillStyle = 'rgba(59,130,246,0.35)'
          ctx.fillRect(
            Math.floor(tx + headW),
            Math.floor(cursorY2),
            Math.max(0, Math.floor(selW)),
            Math.max(0, lineH),
          )
          // restore text color for drawing
          ctx.fillStyle = textColor
        } else if (ed.selAll) {
          const segW = ctx.measureText(run).width
          ctx.fillStyle = 'rgba(59,130,246,0.35)'
          ctx.fillRect(
            Math.floor(tx),
            Math.floor(cursorY2),
            Math.max(0, Math.floor(segW)),
            Math.max(0, lineH),
          )
          // restore text color for drawing
          ctx.fillStyle = textColor
        }
        ctx.fillText(run, tx, cursorY2)
        // Decorations: underline/strikethrough per wrapped line
        if (style?.font?.underline || style?.font?.strikethrough) {
          const sizePx = style?.font?.size ?? 14
          const wRun = ctx.measureText(run).width
          const uY = cursorY2 + Math.max(1, Math.round(sizePx * 0.85))
          const sY = cursorY2 + Math.max(1, Math.round(sizePx * 0.45))
          ctx.strokeStyle = style?.font?.color ?? '#111827'
          ctx.lineWidth = 1
          if (style?.font?.underline) {
            ctx.beginPath()
            ctx.moveTo(tx, uY)
            ctx.lineTo(tx + wRun, uY)
            ctx.stroke()
          }
          if (style?.font?.strikethrough) {
            ctx.beginPath()
            ctx.moveTo(tx, sY)
            ctx.lineTo(tx + wRun, sY)
            ctx.stroke()
          }
        }
        cursorY2 += lineH
      }
    } else {
      const ty = y + h / 2
      // selection highlight for single line
      const selStart = rc.editor?.selAll ? 0 : (rc.editor?.selStart ?? rc.editor?.caret ?? 0)
      const selEnd = rc.editor?.selAll
        ? textToDraw.length
        : (rc.editor?.selEnd ?? rc.editor?.caret ?? 0)
      const s = Math.min(selStart, selEnd)
      const e = Math.max(selStart, selEnd)
      if (e > s) {
        const headW = ctx.measureText(textToDraw.slice(0, s)).width
        const selW = ctx.measureText(textToDraw.slice(s, e)).width
        ctx.fillStyle = 'rgba(59,130,246,0.35)'
        ctx.fillRect(
          Math.floor(tx + headW),
          Math.floor(ty - lineH / 2),
          Math.max(0, Math.floor(selW)),
          Math.max(0, lineH),
        )
        // restore text color for drawing
        ctx.fillStyle = textColor
      } else if (ed.selAll) {
        const segW = ctx.measureText(textToDraw).width
        ctx.fillStyle = 'rgba(59,130,246,0.35)'
        ctx.fillRect(
          Math.floor(tx),
          Math.floor(ty - lineH / 2),
          Math.max(0, Math.floor(segW)),
          Math.max(0, lineH),
        )
        // restore text color for drawing
        ctx.fillStyle = textColor
      }
      ctx.fillText(textToDraw, tx, ty)
      // Decorations for single-line while editing (use baseline-derived top like content layer)
      if (style?.font?.underline || style?.font?.strikethrough) {
        const drawnW = ctx.measureText(textToDraw).width
        const sizePx2 = style?.font?.size ?? 14
        let topY: number
        const base = ctx.textBaseline || 'alphabetic'
        if (base === 'top') topY = ty
        else if (base === 'bottom') topY = ty - sizePx2
        else if (base === 'middle') topY = ty - sizePx2 * 0.5
        else topY = ty - sizePx2 * 0.85
        const uY = topY + Math.max(1, Math.round(sizePx2 * 0.85))
        const sY = topY + Math.max(1, Math.round(sizePx2 * 0.45))
        ctx.strokeStyle = style?.font?.color ?? '#111827'
        ctx.lineWidth = 1
        if (style?.font?.underline) {
          ctx.beginPath()
          ctx.moveTo(tx, uY)
          ctx.lineTo(tx + drawnW, uY)
          ctx.stroke()
        }
        if (style?.font?.strikethrough) {
          ctx.beginPath()
          ctx.moveTo(tx, sY)
          ctx.lineTo(tx + drawnW, sY)
          ctx.stroke()
        }
      }
    }
    ctx.restore()

    // When wrapping, compute caret line based on available width
    let caretX = tx
    let caretY = wrap ? y + 3 : y + h / 2
    if (wrap) {
      const maxW = Math.max(0, w - 8)
      const lines = wrapTextIndices(textToDraw, maxW, style?.font, 14)
      const size2 = style?.font?.size ?? 14
      const lineH2 = Math.max(12, Math.round(size2 * 1.25))
      // find the first line whose end is >= caret index
      let lineIndex = 0
      for (let li = 0; li < lines.length; li++) {
        if (ed.caret <= lines[li].end) {
          lineIndex = li
          break
        }
        lineIndex = li
      }
      const seg = lines[Math.min(lineIndex, Math.max(0, lines.length - 1))]
      const head = textToDraw.slice(seg.start, Math.min(seg.end, ed.caret))
      caretX = Math.floor(tx + ctx.measureText(head).width) + 0.5
      caretY = y + 3 + lineIndex * lineH2
    } else {
      // single line: caret x is width of head
      const head = textToDraw.substring(0, Math.max(0, Math.min(ed.caret, textToDraw.length)))
      const advance = head ? ctx.measureText(head).width : 0
      caretX = Math.floor(tx + advance) + 0.5
    }

    // Draw caret (may overflow horizontally)
    if (
      ed.caretVisible &&
      !(
        rc.editor?.selStart != null &&
        rc.editor?.selEnd != null &&
        rc.editor.selStart !== rc.editor.selEnd
      )
    ) {
      const caretHeight = lineH
      // Clamp caret within clip region
      if (!wrap) {
        // Recompute the same right bound used above
        let clipRightX = x + w
        if (allowExtend) {
          const vGap2 = rc.scrollbar.vTrack ? rc.scrollbar.thickness : 0
          const viewportRight = rc.viewport.width - vGap2
          const desiredRight = tx + (textToDraw ? ctx.measureText(textToDraw).width : 0) + 2
          let aw = sheet.colWidths.get(c) ?? defaultColWidth
          const am = sheet.getMergeAt(r, c)
          if (am && am.r === r && am.c === c) {
            aw = 0
            for (let cc = am.c; cc < am.c + am.cols; cc++) aw += sheet.colWidths.get(cc) ?? defaultColWidth
          }
          let curX = x + aw
          let scanC = am && am.r === r && am.c === c ? am.c + am.cols : c + 1
          let rightLimit = viewportRight
          while (scanC < sheet.cols) {
            const vHere = sheet.getValueAt(r, scanC)
            const hasValHere = vHere != null && String(vHere) !== ''
            if (hasValHere) {
              rightLimit = Math.min(rightLimit, curX)
              break
            }
            const w2 = sheet.colWidths.get(scanC) ?? defaultColWidth
            curX += w2
            scanC++
          }
          clipRightX = Math.min(desiredRight, rightLimit)
        }
        caretX = Math.min(caretX, Math.floor(clipRightX) - 1 + 0.5)
      }
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
