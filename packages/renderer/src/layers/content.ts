import type { Layer, RenderContext } from '../types/context'
import { wrapTextIndices } from '@sheet/api'

export class ContentLayer implements Layer {
  name = 'content'
  render(rc: RenderContext) {
    const { ctx, visible, sheet, defaultColWidth, defaultRowHeight, originX, originY } = rc
    const vGap = rc.scrollbar.vTrack ? rc.scrollbar.thickness : 0
    const hGap = rc.scrollbar.hTrack ? rc.scrollbar.thickness : 0
    ctx.save()
    // Clip to content area (exclude headers and scrollbars)
    ctx.beginPath()
    ctx.rect(
      originX,
      originY,
      Math.max(0, rc.viewport.width - originX - vGap),
      Math.max(0, rc.viewport.height - originY - hGap),
    )
    ctx.clip()
    ctx.fillStyle = '#111827'
    ctx.textBaseline = 'middle'
    ctx.font =
      'normal 14px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'

    let y = originY - visible.offsetY
    for (let r = visible.rowStart; r <= visible.rowEnd; r++) {
      const baseH = sheet.rowHeights.get(r) ?? defaultRowHeight
      // If this row has an active editor, pre-compute its overflow span in pixel space
      let editSpanStartX = -1,
        editSpanEndX = -1,
        editAnchorC = -1
      let x = originX - visible.offsetX
      if (rc.editor && rc.editor.r === r) {
        editAnchorC = rc.editor.c
        // compute anchor start X
        let ax = originX
        for (let cc = 0; cc < editAnchorC; cc++) ax += sheet.colWidths.get(cc) ?? defaultColWidth
        ax -= visible.offsetX
        // compute anchor width (respect merges)
        let aw = sheet.colWidths.get(editAnchorC) ?? defaultColWidth
        const am = sheet.getMergeAt(r, editAnchorC)
        if (am && am.r === r && am.c === editAnchorC) {
          aw = 0
          for (let cc = am.c; cc < am.c + am.cols; cc++)
            aw += sheet.colWidths.get(cc) ?? defaultColWidth
        }
        // scan to find first blocker (non-empty or actively editing cell)
        const vGap2 = rc.scrollbar.vTrack ? rc.scrollbar.thickness : 0
        let rightLimit = rc.viewport.width - vGap2
        let curX = ax + aw
        let scanC = am && am.r === r && am.c === editAnchorC ? am.c + am.cols : editAnchorC + 1
        const rowEditing =
          !!rc.editor && rc.editor.r === r && rc.editor.selStart != null && rc.editor.selEnd != null
        while (scanC < sheet.cols) {
          const editingHere = rowEditing && rc.editor!.c === scanC
          const vHere = sheet.getValueAt(r, scanC)
          const hasValHere = vHere != null && String(vHere) !== ''
          if (editingHere || hasValHere) {
            rightLimit = Math.min(rightLimit, curX)
            break
          }
          const w2 = sheet.colWidths.get(scanC) ?? defaultColWidth
          curX += w2
          scanC++
        }
        editSpanStartX = ax
        editSpanEndX = rightLimit
      }

      // PASS 1: backgrounds only (to avoid covering overflow text from previous cells)
      x = originX - visible.offsetX
      for (let c = visible.colStart; c <= visible.colEnd; c++) {
        const baseW = sheet.colWidths.get(c) ?? defaultColWidth
        const m = sheet.getMergeAt(r, c)
        if (m && !(m.r === r && m.c === c)) {
          x += baseW
          continue
        }
        let drawW = baseW
        let drawH = baseH
        if (m) {
          drawW = 0
          for (let cc = m.c; cc < m.c + m.cols; cc++)
            drawW += sheet.colWidths.get(cc) ?? defaultColWidth
          drawH = 0
          for (let rr = m.r; rr < m.r + m.rows; rr++)
            drawH += sheet.rowHeights.get(rr) ?? defaultRowHeight
        }
        const cell = sheet.getCell(r, c)
        const style = sheet.getStyle(cell?.styleId)
        if (style?.fill?.backgroundColor) {
          ctx.fillStyle = style.fill.backgroundColor
          // Fill full cell; grid lines will be drawn after backgrounds to stay visible
          ctx.fillRect(
            Math.floor(x),
            Math.floor(y),
            Math.max(0, Math.floor(drawW)),
            Math.max(0, Math.floor(drawH)),
          )
        }
        x += baseW
      }

      // PASS 1.5: grid lines (drawn above backgrounds, below text)
      // Helpers to test if a grid boundary sits inside a merge interior
      const isVBoundaryBlockedAtRow = (b: number, row: number) => {
        for (const m of sheet.merges) {
          if (m.rows === 1 && m.cols === 1) continue
          if (row < m.r || row > m.r + m.rows - 1) continue
          if (b <= m.c || b >= m.c + m.cols) continue
          return true
        }
        return false
      }
      const isHBoundaryBlockedAtCol = (b: number, col: number) => {
        for (const m of sheet.merges) {
          if (m.rows === 1 && m.cols === 1) continue
          if (col < m.c || col > m.c + m.cols - 1) continue
          if (b <= m.r || b >= m.r + m.rows) continue
          return true
        }
        return false
      }
      // vertical segments for this row band
      ctx.save()
      ctx.strokeStyle = rc.headerStyle.gridColor
      ctx.lineWidth = 1
      let xV = originX - visible.offsetX
      ctx.beginPath()
      for (let b = visible.colStart; b <= visible.colEnd + 1; b++) {
        const xx = Math.floor(xV) + 0.5
        if (!isVBoundaryBlockedAtRow(b, r)) {
          const y0 = Math.floor(y) + 0.5
          const y1 = Math.floor(y + baseH) + 0.5
          ctx.moveTo(xx, y0)
          ctx.lineTo(xx, y1)
        }
        const w = sheet.colWidths.get(b) ?? defaultColWidth
        xV += w
      }
      ctx.stroke()
      // horizontal top boundary for this row
      let xH = originX - visible.offsetX
      ctx.beginPath()
      for (let c = visible.colStart; c <= visible.colEnd; c++) {
        const w2 = sheet.colWidths.get(c) ?? defaultColWidth
        if (!isHBoundaryBlockedAtCol(r, c)) {
          const yy = Math.floor(y) + 0.5
          const xL = Math.floor(xH) + 0.5
          const xR = Math.floor(xH + w2) + 0.5
          ctx.moveTo(xL, yy)
          ctx.lineTo(xR, yy)
        }
        xH += w2
      }
      ctx.stroke()
      // bottom boundary only for the last visible row
      if (r === visible.rowEnd) {
        xH = originX - visible.offsetX
        ctx.beginPath()
        for (let c = visible.colStart; c <= visible.colEnd; c++) {
          const w2 = sheet.colWidths.get(c) ?? defaultColWidth
          if (!isHBoundaryBlockedAtCol(r + 1, c)) {
            const yy = Math.floor(y + baseH) + 0.5
            const xL = Math.floor(xH) + 0.5
            const xR = Math.floor(xH + w2) + 0.5
            ctx.moveTo(xL, yy)
            ctx.lineTo(xR, yy)
          }
          xH += w2
        }
        ctx.stroke()
      }
      ctx.restore()

      // PASS 2: text
      x = originX - visible.offsetX
      for (let c = visible.colStart; c <= visible.colEnd; c++) {
        const baseW = sheet.colWidths.get(c) ?? defaultColWidth
        const m = sheet.getMergeAt(r, c)
        if (m && !(m.r === r && m.c === c)) {
          x += baseW
          continue
        }
        let drawW = baseW
        let drawH = baseH
        if (m) {
          drawW = 0
          for (let cc = m.c; cc < m.c + m.cols; cc++)
            drawW += sheet.colWidths.get(cc) ?? defaultColWidth
          drawH = 0
          for (let rr = m.r; rr < m.r + m.rows; rr++)
            drawH += sheet.rowHeights.get(rr) ?? defaultRowHeight
        }
        const cell = sheet.getCell(r, c)
        const style = sheet.getStyle(cell?.styleId)
        const raw = cell?.value != null ? String(cell.value) : ''
        const isEditingAnchor = !!rc.editor && rc.editor.r === r && rc.editor.c === c
        const txt = isEditingAnchor ? (rc.editor!.text ?? '') : raw

        // Do not draw text for the editing anchor here; editor layer is responsible for it
        if (txt && !isEditingAnchor) {
          // font
          if (style?.font) {
            const size = style.font.size ?? 14
            const family =
              style.font.family ??
              'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
            const weight = style.font.bold ? 'bold' : 'normal'
            const italic = style.font.italic ? 'italic ' : ''
            ctx.font = `${italic}${weight} ${size}px ${family}`
          }
          ctx.fillStyle = style?.font?.color ?? '#111827'
          // alignment & flow
          const halign = style?.alignment?.horizontal ?? 'left'
          const valign = style?.alignment?.vertical ?? 'middle'
          const wrap = style?.alignment?.wrapText ?? false
          // While editing, force overflow rendering so hidden text is visible.
          const overflow: 'overflow' | 'clip' | 'ellipsis' = isEditingAnchor
            ? 'overflow'
            : (style?.alignment?.overflow ?? 'overflow')

          // Compute dynamic right stop for overflow so that any occupied or editing cell to the right is preserved.
          // Default to content area right edge (content layer already clipped to content area)
          const vGap2 = rc.scrollbar.vTrack ? rc.scrollbar.thickness : 0
          let overflowRightLimitX = rc.viewport.width - vGap2
          if (!wrap && overflow === 'overflow') {
            // Start scanning from the first column after current (or after current merge span)
            let curX = x + drawW
            let scanC = m && m.r === r && m.c === c ? m.c + m.cols : c + 1
            const rowEditing2 =
              !!rc.editor &&
              rc.editor.r === r &&
              rc.editor.selStart != null &&
              rc.editor.selEnd != null
            while (scanC < sheet.cols) {
              // If the anchor of an actively editing cell is here, stop before this column
              const editingHere = rowEditing2 && rc.editor!.c === scanC
              // Treat any non-empty logical value at (r, scanC) as occupied (covers merges too via getValueAt)
              const vHere = sheet.getValueAt(r, scanC)
              const hasValHere = vHere != null && String(vHere) !== ''
              if (editingHere || hasValHere) {
                overflowRightLimitX = Math.min(overflowRightLimitX, curX)
                break
              }
              // extend across this empty column and continue
              const w2 = sheet.colWidths.get(scanC) ?? defaultColWidth
              curX += w2
              scanC++
            }
          }
          // horizontal
          let tx = x + 4
          if (halign === 'center') tx = x + drawW / 2
          else if (halign === 'right') tx = x + drawW - 4
          // vertical
          let ty = y + drawH / 2
          if (valign === 'top') {
            ctx.textBaseline = 'top'
            ty = y + 3
          } else if (valign === 'bottom') {
            ctx.textBaseline = 'bottom'
            ty = y + drawH - 3
          } else {
            ctx.textBaseline = 'middle'
            ty = y + drawH / 2
          }
          // text align maps
          if (halign === 'left') ctx.textAlign = 'left'
          else if (halign === 'right') ctx.textAlign = 'right'
          else ctx.textAlign = 'center'

          const maxW = Math.max(0, drawW - 8)
          if (wrap) {
            // multi-line wrap within cell box; honor explicit newlines
            const sizePx = style?.font?.size ?? 14
            const lineH = Math.max(12, Math.round(sizePx * 1.25))
            ctx.save()
            ctx.beginPath()
            ctx.rect(x + 1, y + 1, Math.max(0, drawW - 2), Math.max(0, drawH - 2))
            ctx.clip()
            ctx.textBaseline = 'top'
            let cursorY = y + 3
            const lines = wrapTextIndices(txt, maxW, style?.font, 14)
            for (let li = 0; li < lines.length; li++) {
              if (cursorY > y + drawH - 3) break
              const seg = lines[li]
              const run = txt.slice(seg.start, seg.end)
              let lx = x + 4
              if (halign === 'center') lx = x + drawW / 2
              else if (halign === 'right') lx = x + drawW - 4
              ctx.fillText(run, lx, cursorY)
              cursorY += lineH
            }
            ctx.restore()
          } else {
            // single-line: apply overflow policy (Excel-like precise column-bound algorithm)
            const needsClipPolicy = overflow === 'clip' || overflow === 'ellipsis'
            const viewportRight =
              rc.viewport.width - (rc.scrollbar.vTrack ? rc.scrollbar.thickness : 0)
            let clipW = Math.max(0, Math.floor(drawW))
            if (overflow === 'overflow' && halign === 'left') {
              // measure text and compute desired right edge based on pixel width
              const textW = ctx.measureText(txt).width
              const desiredRight = tx + textW + 2
              const allowedRight =
                overflowRightLimitX < viewportRight ? overflowRightLimitX : viewportRight
              const finalRight = Math.min(desiredRight, allowedRight)
              clipW = Math.max(0, Math.floor(finalRight - x))
            }
          const hasOverflowStop = overflow === 'overflow' && overflowRightLimitX < viewportRight
          // Never clip the editing anchor itself; it should render fully (overflow paints outside via content layer)
          // Additionally, avoid creating a zero/near-zero clip that would hide text entirely (observed when
          // a blocker sits immediately at the right edge). Fallback to no-clip in that case.
          const interiorClipW = Math.max(0, Math.floor(clipW) - 2)
          const doClipPolicy =
            !isEditingAnchor && (needsClipPolicy || hasOverflowStop) && interiorClipW > 2
            // Additionally, if actively editing on this row and this cell is not the anchor,
            // avoid drawing inside the editor's overflow span [editSpanStartX, editSpanEndX)
            const isRowEditing =
              !!rc.editor &&
              rc.editor.r === r &&
              rc.editor.selStart != null &&
              rc.editor.selEnd != null
            const avoidEditorSpan = isRowEditing && c !== editAnchorC && editSpanStartX >= 0
            let didCustomClip = false
            if (avoidEditorSpan) {
              const cellLeft = x
              const cellRight = x + drawW
              const ovLeft = Math.max(cellLeft, editSpanStartX)
              const ovRight = Math.min(cellRight, editSpanEndX)
              if (ovRight > ovLeft) {
                // Build a clip path consisting of the cell box minus the overlap [ovLeft, ovRight)
                ctx.save()
                ctx.beginPath()
                // left segment
                const leftW = Math.max(0, ovLeft - cellLeft)
                if (leftW > 1)
                  ctx.rect(cellLeft + 1, y + 1, Math.max(0, leftW - 2), Math.max(0, drawH - 2))
                // right segment
                const rightW = Math.max(0, cellRight - ovRight)
                if (rightW > 1)
                  ctx.rect(ovRight + 1, y + 1, Math.max(0, rightW - 2), Math.max(0, drawH - 2))
                ctx.clip()
                didCustomClip = true
              }
            }
            if (!didCustomClip && doClipPolicy) {
              ctx.save()
              ctx.beginPath()
              ctx.rect(x + 1, y + 1, interiorClipW, Math.max(0, drawH - 2))
              ctx.clip()
            }
            let out = txt
            if (overflow === 'ellipsis' && maxW > 0) {
              const w0 = ctx.measureText(out).width
              if (w0 > maxW) {
                const ell = '...'
                let lo = 0,
                  hi = out.length
                while (lo < hi) {
                  const mid = (lo + hi) >>> 1
                  const w = ctx.measureText(out.slice(0, mid) + ell).width
                  if (w <= maxW) lo = mid + 1
                  else hi = mid
                }
                const n2 = Math.max(0, lo - 1)
                out = out.slice(0, n2) + ell
              }
            }
            ctx.fillText(out, tx, ty)
            if (didCustomClip || (!didCustomClip && doClipPolicy)) ctx.restore()
          }
        }

        x += baseW
      }

      y += baseH
    }

    // GLOBAL PASS: draw custom cell borders on top of everything to avoid being covered by later backgrounds
    let yB = originY - visible.offsetY
    for (let r = visible.rowStart; r <= visible.rowEnd; r++) {
      const baseH = sheet.rowHeights.get(r) ?? defaultRowHeight
      let xB = originX - visible.offsetX
      for (let c = visible.colStart; c <= visible.colEnd; c++) {
        const baseW = sheet.colWidths.get(c) ?? defaultColWidth
        const m = sheet.getMergeAt(r, c)
        if (m && !(m.r === r && m.c === c)) {
          xB += baseW
          continue
        }
        let drawW = baseW
        let drawH = baseH
        if (m) {
          drawW = 0
          for (let cc = m.c; cc < m.c + m.cols; cc++)
            drawW += sheet.colWidths.get(cc) ?? defaultColWidth
          drawH = 0
          for (let rr = m.r; rr < m.r + m.rows; rr++)
            drawH += sheet.rowHeights.get(rr) ?? defaultRowHeight
        }
        const cell = sheet.getCell(r, c)
        const style = sheet.getStyle(cell?.styleId)
        if (style?.border) {
          const bx = Math.floor(xB) + 0.5
          const by = Math.floor(yB) + 0.5
          const bw = Math.floor(drawW)
          const bh = Math.floor(drawH)
          const drawSide = (
            side: 'top' | 'bottom' | 'left' | 'right',
            cfg: { color?: string; style?: 'solid' | 'dashed' | 'dotted'; width?: number } | undefined,
          ) => {
            if (!cfg) return
            const color = cfg.color ?? '#111827'
            const width = Math.max(1, Math.floor(cfg.width ?? 1))
            const styleKind = cfg.style ?? 'solid'
            ctx.save()
            ctx.strokeStyle = color
            ctx.lineWidth = width
            if (styleKind === 'dashed') ctx.setLineDash([4 * width, 2 * width])
            else if (styleKind === 'dotted') ctx.setLineDash([width, width])
            ctx.beginPath()
            if (side === 'top') {
              ctx.moveTo(bx, by)
              ctx.lineTo(bx + bw, by)
            } else if (side === 'bottom') {
              const yy = by + bh
              ctx.moveTo(bx, yy)
              ctx.lineTo(bx + bw, yy)
            } else if (side === 'left') {
              ctx.moveTo(bx, by)
              ctx.lineTo(bx, by + bh)
            } else if (side === 'right') {
              const xx = bx + bw
              ctx.moveTo(xx, by)
              ctx.lineTo(xx, by + bh)
            }
            ctx.stroke()
            ctx.restore()
          }
          if (style.border.top) drawSide('top', style.border.top)
          if (style.border.bottom) drawSide('bottom', style.border.bottom)
          if (style.border.left) drawSide('left', style.border.left)
          if (style.border.right) drawSide('right', style.border.right)
        }
        xB += baseW
      }
      yB += baseH
    }

    ctx.restore()
  }
}
