import type { Layer, RenderContext } from '../types/context'
import { snapCoord, snappedRect, strokeCrispRect } from '@sheet/shared-utils'
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
      // If this row has an active editor, pre-compute anchor box and its overflow span in pixel space
      let editSpanStartX = -1,
        editSpanEndX = -1,
        editAnchorC = -1,
        editAnchorLeftX = -1,
        editAnchorRightX = -1
      let x = originX - visible.offsetX
      const isActiveEditingRow =
        !!rc.editor && rc.editor.selStart != null && rc.editor.selEnd != null && rc.editor.r === r
      if (isActiveEditingRow) {
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
          isActiveEditingRow
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
        editAnchorLeftX = ax
        editAnchorRightX = ax + aw
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
        const isActiveEditing = !!rc.editor && rc.editor.selStart != null && rc.editor.selEnd != null
        const isEditingAnchor = isActiveEditing && rc.editor.r === r && rc.editor.c === c
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

          // Compute dynamic right stop for overflow so that any occupied cell to the right is preserved.
          // When the row is in editing mode, do NOT treat the anchor cell itself as a blocker for
          // overflow coming from cells to its left; only exclude the anchor cell area.
          const vGap2 = rc.scrollbar.vTrack ? rc.scrollbar.thickness : 0
          let overflowRightLimitX = rc.viewport.width - vGap2
          let rowEditing2 = isActiveEditing
          if (!wrap && overflow === 'overflow') {
            // Start scanning from the first column after current (or after current merge span)
            let curX = x + drawW
            let scanC = m && m.r === r && m.c === c ? m.c + m.cols : c + 1
            while (scanC < sheet.cols) {
              const isAnchorHere = rowEditing2 && rc.editor!.c === scanC
              const vHere = sheet.getValueAt(r, scanC)
              const hasValHere = vHere != null && String(vHere) !== ''
              if ((hasValHere || isAnchorHere) && !isAnchorHere) {
                overflowRightLimitX = Math.min(overflowRightLimitX, curX)
                break
              }
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
              // Default allowed region extends to the next blocker (occupied cell),
              // but if this row is in editing mode we exclude only the anchor cell area,
              // still allowing overflow to continue after the anchor.
              const allowedRight =
                overflowRightLimitX < viewportRight ? overflowRightLimitX : viewportRight
              // Base clip (no holes)
              let finalRight = Math.min(desiredRight, allowedRight)
              clipW = Math.max(0, Math.floor(finalRight - x))
            }
            const hasOverflowStop = overflow === 'overflow' && overflowRightLimitX < viewportRight
            // Never clip the editing anchor itself; it should render fully (handled by editor layer)
            const interiorClipW = Math.max(0, Math.floor(clipW) - 2)
            const doClipPolicy =
              !isEditingAnchor && (needsClipPolicy || hasOverflowStop) && interiorClipW > 2
            // Additionally, if actively editing on this row and this cell is not the anchor,
            // avoid drawing inside the anchor cell box only. For cells to the left of the
            // anchor, allow overflow to continue after the anchor by creating a two-segment clip.
            const isRowEditing =
              !!rc.editor &&
              rc.editor.r === r &&
              rc.editor.selStart != null &&
              rc.editor.selEnd != null
            const avoidEditorSpan = isRowEditing && c !== editAnchorC && editSpanStartX >= 0
            let didCustomClip = false
            if (avoidEditorSpan && editAnchorLeftX >= 0 && editAnchorRightX >= 0) {
              const cellLeft = x
              const cellRight = x + drawW
              // Case 1: cell lies wholly to the left of the anchor -> carve a hole for the anchor box
              if (cellRight <= editAnchorLeftX) {
                ctx.save()
                ctx.beginPath()
                // segment before anchor
                const seg1W = Math.max(0, editAnchorLeftX - cellLeft - 2)
                if (seg1W > 0) ctx.rect(cellLeft + 1, y + 1, seg1W, Math.max(0, drawH - 2))
                // segment after anchor up to the next blocker (editSpanEndX)
                const afterStart = Math.max(editAnchorRightX + 1, cellLeft + 1)
                const afterEnd = Math.max(afterStart, Math.floor(editSpanEndX) - 1)
                const seg2W = Math.max(0, afterEnd - afterStart)
                if (seg2W > 0)
                  ctx.rect(afterStart, y + 1, seg2W, Math.max(0, drawH - 2))
                ctx.clip()
                didCustomClip = true
              } else {
                // Case 2: generic: subtract only the overlap with anchor box if any
                const ovLeft = Math.max(cellLeft, editAnchorLeftX)
                const ovRight = Math.min(cellRight, editAnchorRightX)
                if (ovRight > ovLeft) {
                  ctx.save()
                  ctx.beginPath()
                  const leftW = Math.max(0, ovLeft - cellLeft)
                  if (leftW > 1)
                    ctx.rect(cellLeft + 1, y + 1, Math.max(0, leftW - 2), Math.max(0, drawH - 2))
                  const rightW = Math.max(0, cellRight - ovRight)
                  if (rightW > 1)
                    ctx.rect(ovRight + 1, y + 1, Math.max(0, rightW - 2), Math.max(0, drawH - 2))
                  ctx.clip()
                  didCustomClip = true
                }
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

    // Draw selection interior fill BELOW custom cell borders to avoid darkening/thickening perception
    if (rc.selection) {
      const { sheet, originX, originY } = rc
      const { r0: sr0, c0: sc0, r1: sr1, c1: sc1 } = rc.selection
      const r0 = Math.max(0, Math.min(sr0, sr1))
      const r1 = Math.min(sheet.rows - 1, Math.max(sr0, sr1))
      const c0 = Math.max(0, Math.min(sc0, sc1))
      const c1 = Math.min(sheet.cols - 1, Math.max(sc0, sc1))
      const isSingleCell = r0 === r1 && c0 === c1
      if (!isSingleCell) {
        // cumulative helpers
        const cumWidth = (i: number): number => {
          let base = i * defaultColWidth
          if (sheet.colWidths.size)
            for (const [c, w] of sheet.colWidths) if (c < i) base += w - defaultColWidth
          return base
        }
        const cumHeight = (i: number): number => {
          let base = i * defaultRowHeight
          if (sheet.rowHeights.size)
            for (const [r, h] of sheet.rowHeights) if (r < i) base += h - defaultRowHeight
          return base
        }
        const x0 = originX + cumWidth(c0) - rc.scroll.x
        const x1 = originX + cumWidth(c1 + 1) - rc.scroll.x
        const y0 = originY + cumHeight(r0) - rc.scroll.y
        const y1 = originY + cumHeight(r1 + 1) - rc.scroll.y
        const selL = Math.floor(x0) + 1
        const selT = Math.floor(y0) + 1
        const selW = Math.max(0, Math.floor(x1 - x0) - 2)
        const selH = Math.max(0, Math.floor(y1 - y0) - 2)

        // Anchor hole
        let ar = rc.selectionAnchor?.r ?? r0
        let ac = rc.selectionAnchor?.c ?? c0
        // If anchor outside selection, fallback to top-left
        if (ar < r0 || ar > r1 || ac < c0 || ac > c1) {
          ar = r0
          ac = c0
        }
        const mAtAnchor = sheet.getMergeAt(ar, ac)
        if (mAtAnchor) {
          ar = mAtAnchor.r
          ac = mAtAnchor.c
        }
        const xA0 = originX + cumWidth(ac) - rc.scroll.x
        let xA1 = originX + cumWidth(ac + 1) - rc.scroll.x
        const yA0 = originY + cumHeight(ar) - rc.scroll.y
        let yA1 = originY + cumHeight(ar + 1) - rc.scroll.y
        const mA = sheet.getMergeAt(ar, ac)
        if (mA) {
          xA1 = originX + cumWidth(ac + mA.cols) - rc.scroll.x
          yA1 = originY + cumHeight(ar + mA.rows) - rc.scroll.y
        }
        const aL = Math.floor(xA0)
        const aT = Math.floor(yA0)
        const aR = Math.floor(xA1)
        const aB = Math.floor(yA1)
        const holeL = Math.max(selL, aL + 1)
        const holeT = Math.max(selT, aT + 1)
        const holeR = Math.min(selL + selW, aR - 1)
        const holeB = Math.min(selT + selH, aB - 1)

        ctx.save()
        // Content area is already clipped above
        ctx.fillStyle = 'rgba(59, 130, 246, 0.08)'
        ctx.beginPath()
        ctx.rect(selL, selT, Math.max(0, selW), Math.max(0, selH))
        if (holeR > holeL && holeB > holeT) {
          ctx.rect(holeL, holeT, Math.max(0, holeR - holeL), Math.max(0, holeB - holeT))
          ctx.fill('evenodd')
        } else {
          ctx.fill()
        }
        ctx.restore()
      }
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
          const left = xB
          const top = yB
          const right = xB + drawW
          const bottom = yB + drawH

          const bTop = style.border.top
          const bBottom = style.border.bottom
          const bLeft = style.border.left
          const bRight = style.border.right

          const prio = (cfg?: { width?: number; style?: 'solid' | 'dashed' | 'dotted' | 'none' }) => {
            if (!cfg) return [-1, -1] as const
            const lw = Math.max(1, Math.floor(cfg.width ?? 1))
            const sw = cfg.style === 'solid' ? 2 : cfg.style === 'dashed' ? 1 : cfg.style === 'dotted' ? 0 : -1
            return [lw, sw] as const
          }

          const isAnchorVisible = (rr: number, cc: number) => {
            const a = sheet.getMergeAt(rr, cc)
            const ar = a ? a.r : rr
            const ac = a ? a.c : cc
            return (
              ar >= visible.rowStart && ar <= visible.rowEnd && ac >= visible.colStart && ac <= visible.colEnd
            )
          }

          const shouldDraw = (
            side: 'top' | 'bottom' | 'left' | 'right',
            cfg: { color?: string; style?: 'solid' | 'dashed' | 'dotted' | 'none'; width?: number } | undefined,
          ) => {
            if (!cfg) return false
            if (cfg.style === 'none') return false
            // Determine neighbor and opposite side
            let nr = r,
              nc = c,
              opp: 'top' | 'bottom' | 'left' | 'right' = 'top'
            let owner = false // whether this cell owns the boundary in tie
            if (side === 'left') {
              nc = (m ? m.c : c) - 1
              opp = 'right'
              owner = false // owner is the cell on the left (we are right cell), so not owner
            } else if (side === 'right') {
              nc = (m ? m.c + m.cols : c + 1)
              opp = 'left'
              owner = true // owner is the left cell (us)
            } else if (side === 'top') {
              nr = (m ? m.r : r) - 1
              opp = 'bottom'
              owner = false // owner is the top cell (neighbor), we are bottom cell
            } else if (side === 'bottom') {
              nr = (m ? m.r + m.rows : r + 1)
              opp = 'top'
              owner = true // owner is the top cell (us)
            }
            // Bounds check
            if (nr < 0 || nc < 0 || nr >= sheet.rows || nc >= sheet.cols) return true
            const neighborStyle = sheet.getStyleAt(nr, nc)
            const nCfg = neighborStyle?.border?.[opp]
            // If neighbor explicitly suppresses ('none'), respect it only if it is more recent
            // than our current cell style. This models user-intent order: later ops win.
            if (nCfg && nCfg.style === 'none') {
              const selfStyleId = style?.id ?? 0
              const neighborStyleId = neighborStyle?.id ?? 0
              if (neighborStyleId >= selfStyleId) return false
              // else, our style is more recent; allow drawing
            }
            if (!nCfg) return true
            // If neighbor anchor not visible, we must draw (otherwise nobody will paint it this frame)
            if (!isAnchorVisible(nr, nc)) return true
            // Compare priority
            const [lw, sw] = prio(cfg)
            const [lw2, sw2] = prio(nCfg)
            if (lw > lw2) return true
            if (lw < lw2) return false
            if (sw > sw2) return true
            if (sw < sw2) return false
            // Equal strength: only the canonical owner draws
            return owner
          }

          // Fast path: identical four sides (common case)
          const eq = (
            a?: { color?: string; style?: 'solid' | 'dashed' | 'dotted'; width?: number },
            b?: { color?: string; style?: 'solid' | 'dashed' | 'dotted'; width?: number },
          ) => {
            if (!a || !b) return false
            return (
              (a.color ?? '#111827') === (b.color ?? '#111827') &&
              Math.max(1, Math.floor(a.width ?? 1)) === Math.max(1, Math.floor(b.width ?? 1)) &&
              (a.style ?? 'solid') === (b.style ?? 'solid')
            )
          }

          if (true) {
            // Per-side draw with crisp alignment; dedupe against neighbor to prevent double-thick internal lines
            const drawSide = (
              side: 'top' | 'bottom' | 'left' | 'right',
              cfg: { color?: string; style?: 'solid' | 'dashed' | 'dotted' | 'none'; width?: number } | undefined,
            ) => {
              if (!cfg) return
              if (!shouldDraw(side, cfg)) return
              if (cfg.style === 'none') return
              const color = cfg.color ?? '#111827'
              const lw = Math.max(1, Math.floor(cfg.width ?? 1))
              const styleKind = cfg.style ?? 'solid'
              ctx.save()
              ctx.strokeStyle = color
              ctx.lineWidth = lw
              ctx.lineCap = 'butt'
              ctx.lineJoin = 'miter'
              if (styleKind === 'dashed') ctx.setLineDash([4 * lw, 2 * lw])
              else if (styleKind === 'dotted') ctx.setLineDash([lw, lw])
              ctx.beginPath()
              if (side === 'top') {
                const y = snapCoord(top, lw)
                ctx.moveTo(Math.floor(left), y)
                ctx.lineTo(Math.floor(right), y)
              } else if (side === 'bottom') {
                const y = snapCoord(bottom, lw)
                ctx.moveTo(Math.floor(left), y)
                ctx.lineTo(Math.floor(right), y)
              } else if (side === 'left') {
                const x = snapCoord(left, lw)
                ctx.moveTo(x, Math.floor(top))
                ctx.lineTo(x, Math.floor(bottom))
              } else if (side === 'right') {
                const x = snapCoord(right, lw)
                ctx.moveTo(x, Math.floor(top))
                ctx.lineTo(x, Math.floor(bottom))
              }
              ctx.stroke()
              ctx.restore()
            }
            if (bTop) drawSide('top', bTop)
            if (bBottom) drawSide('bottom', bBottom)
            if (bLeft) drawSide('left', bLeft)
            if (bRight) drawSide('right', bRight)
          } else {
            // Unreachable branch (kept for diff clarity)
          }
        }
        xB += baseW
      }
      yB += baseH
    }

    ctx.restore()
  }
}
