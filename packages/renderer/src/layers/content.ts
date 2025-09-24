import type { Layer, RenderContext } from '../types/context'
import { snapCoord } from '@sheet/shared-utils'
import type { Canvas2DContext } from '@sheet/shared-utils'
import { wrapTextIndices, fontStringFromStyle } from '@sheet/api'
import type { Style } from '@sheet/core'

export class ContentLayer implements Layer {
  name = 'content'
  // Cache of measured text width by font+text to reduce expensive measureText calls
  private textWidthCache = new Map<string, number>()
  // Cache wrap results by font+text+maxW
  private wrapCache = new Map<string, Array<{ start: number; end: number }>>()
  // Cache ellipsis cutoff index by font+text+maxW
  private ellipsisCache = new Map<string, number>()
  private measureTextCached(ctx: Canvas2DContext, text: string): number {
    const key = ctx.font + '|' + text
    const cached = this.textWidthCache.get(key)
    if (cached != null) return cached
    const w = ctx.measureText(text).width
    // Prevent unbounded growth in long sessions
    if (this.textWidthCache.size > 5000) this.textWidthCache.clear()
    this.textWidthCache.set(key, w)
    return w
  }
  private wrapTextCached(
    ctx: Canvas2DContext,
    text: string,
    maxW: number,
    font?: Style['font'],
  ): Array<{ start: number; end: number }> {
    const key = ctx.font + '|' + text + '|' + maxW
    const hit = this.wrapCache.get(key)
    if (hit) return hit
    const lines = wrapTextIndices(text, maxW, font, 14)
    // Cap cache to avoid growth
    if (this.wrapCache.size > 5000) this.wrapCache.clear()
    this.wrapCache.set(key, lines)
    return lines
  }
  private ellipsisCutCached(ctx: Canvas2DContext, text: string, maxW: number): number {
    const key = ctx.font + '|' + text + '|' + maxW
    const hit = this.ellipsisCache.get(key)
    if (hit != null) return hit
    let lo = 0,
      hi = text.length
    const ell = '...'
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      const w = this.measureTextCached(ctx, text.slice(0, mid) + ell)
      if (w <= maxW) lo = mid + 1
      else hi = mid
    }
    const n2 = Math.max(0, lo - 1)
    if (this.ellipsisCache.size > 8000) this.ellipsisCache.clear()
    this.ellipsisCache.set(key, n2)
    return n2
  }
  render(rc: RenderContext) {
    const { ctx, visible, sheet, defaultColWidth, defaultRowHeight, originX, originY, zoom } = rc
    const z = zoom ?? 1
    // Lightweight drawing during fast scrolls is handled elsewhere; we always render full detail here
    // so cached measurements stay warm and visuals remain consistent.
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
    ctx.font = `normal ${14 * z}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`

    let y = originY - visible.offsetY
    for (let r = visible.rowStart; r <= visible.rowEnd; r++) {
      const baseH = (sheet.rowHeights.get(r) ?? defaultRowHeight) * z
      let x = originX - visible.offsetX

      // PASS 1: backgrounds only (to avoid covering overflow text from previous cells)
      x = originX - visible.offsetX
      for (let c = visible.colStart; c <= visible.colEnd; c++) {
        const baseW = (sheet.colWidths.get(c) ?? defaultColWidth) * z
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
            drawW += (sheet.colWidths.get(cc) ?? defaultColWidth) * z
          drawH = 0
          for (let rr = m.r; rr < m.r + m.rows; rr++)
            drawH += (sheet.rowHeights.get(rr) ?? defaultRowHeight) * z
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
      // PASS 1b: merged backgrounds that start outside this pane but intersect it (bridge across panes)
      if (r === visible.rowStart) {
        // Iterate merges once per row band; cheap guard using intersection with visible range
        for (const m of sheet.merges) {
          if (m.rows === 1 && m.cols === 1) continue
          const c0 = Math.max(visible.colStart, m.c)
          const c1 = Math.min(visible.colEnd, m.c + m.cols - 1)
          const r0 = Math.max(visible.rowStart, m.r)
          const r1 = Math.min(visible.rowEnd, m.r + m.rows - 1)
          if (c0 > c1 || r0 > r1) continue
          // If the anchor is visible in this pane, the normal PASS 1 already painted full background
          const anchorVisible =
            m.r >= visible.rowStart &&
            m.r <= visible.rowEnd &&
            m.c >= visible.colStart &&
            m.c <= visible.colEnd
          if (anchorVisible) continue
          const anchorCell = sheet.getCell(m.r, m.c)
          const style = sheet.getStyle(anchorCell?.styleId)
          const bg = style?.fill?.backgroundColor
          if (!bg) continue
          // Compute segment rect (intersection) in canvas coords
          let xSeg = originX - visible.offsetX
          for (let cc = visible.colStart; cc < c0; cc++)
            xSeg += (sheet.colWidths.get(cc) ?? defaultColWidth) * z
          let ySeg = originY - visible.offsetY
          for (let rr = visible.rowStart; rr < r0; rr++)
            ySeg += (sheet.rowHeights.get(rr) ?? defaultRowHeight) * z
          let segW = 0
          for (let cc = c0; cc <= c1; cc++) segW += (sheet.colWidths.get(cc) ?? defaultColWidth) * z
          let segH = 0
          for (let rr = r0; rr <= r1; rr++) segH += (sheet.rowHeights.get(rr) ?? defaultRowHeight) * z
          ctx.fillStyle = bg
          ctx.fillRect(
            Math.floor(xSeg),
            Math.floor(ySeg),
            Math.max(0, Math.floor(segW)),
            Math.max(0, Math.floor(segH)),
          )
        }
      }

      // PASS 1.5: grid lines (drawn above backgrounds, below text)
      const vBlockers = rc.gridBlockers?.v
      const hBlockers = rc.gridBlockers?.h
      const isVBoundaryBlockedAtRow = (b: number, row: number) => vBlockers?.get(row)?.has(b) ?? false
      const isHBoundaryBlockedAtCol = (b: number, col: number) => hBlockers?.get(col)?.has(b) ?? false
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
        const w = (sheet.colWidths.get(b) ?? defaultColWidth) * z
        xV += w
      }
      ctx.stroke()
      // horizontal top boundary for this row
      let xH = originX - visible.offsetX
      ctx.beginPath()
      for (let c = visible.colStart; c <= visible.colEnd; c++) {
        const w2 = (sheet.colWidths.get(c) ?? defaultColWidth) * z
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
          const w2 = (sheet.colWidths.get(c) ?? defaultColWidth) * z
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

      // PASS 1.7: overflow text from offscreen left anchors
      // 始终绘制，避免在 fast/非 fast 之间切换造成溢出文本的“闪现/消失”。
      {
      // Viewport content bounds (exclude scrollbars)
      const vGap2 = rc.scrollbar.vTrack ? rc.scrollbar.thickness : 0
      const viewportLeft = originX
      const viewportRight = rc.viewport.width - vGap2
      // Only needed if there are columns hidden to the left
      if (visible.colStart > 0) {
          // Helper to compute cumulative width up to column index i
          const cumWidth = (i: number): number => {
            let base = i * defaultColWidth * z
            if (sheet.colWidths.size)
              for (const [ci, w] of sheet.colWidths)
                if (ci < i) base += (w - defaultColWidth) * z
            return base
          }
          // Find the rightmost non-empty anchor cell to the left that could overflow
          let anchorC = -1
          let anchorMerge: ReturnType<typeof sheet.getMergeAt> | null = null
          // Scan left from the first visible column - 1
          for (let scanC = visible.colStart - 1; scanC >= 0; ) {
            const m = sheet.getMergeAt(r, scanC)
            // Jump to top-left of the merge to avoid re-processing interior cells
            const topLeftC = m && m.r === r ? m.c : scanC
            const v = sheet.getValueAt(r, topLeftC)
            const hasVal = v != null && (typeof v !== 'string' || v.length > 0)
            if (hasVal) {
              anchorC = topLeftC
              anchorMerge = m && m.r === r ? m : null
              break
            }
            // Move left: if inside a merge, skip the whole span at once
            if (m && m.r === r) scanC = m.c - 1
            else scanC -= 1
          }

          if (anchorC >= 0) {
            const cell = sheet.getCell(r, anchorC)
            const style = sheet.getStyle(cell?.styleId)
            const raw = cell?.value != null ? String(cell.value) : ''
            const wrap = style?.alignment?.wrapText ?? false
            const halign = style?.alignment?.horizontal ?? 'left'
            const overflow = style?.alignment?.overflow ?? 'overflow'
            // Only paint overflow for single-line, left-aligned, overflow policy
            if (!wrap && overflow === 'overflow' && halign === 'left' && raw) {
              // Compute anchor geometry in pixel space
              const anchorLeftX = originX + cumWidth(anchorC) - rc.scroll.x
              let anchorW = sheet.colWidths.get(anchorC) ?? defaultColWidth
              if (anchorMerge) {
                anchorW = 0
                for (let cc = anchorMerge.c; cc < anchorMerge.c + anchorMerge.cols; cc++)
                  anchorW += sheet.colWidths.get(cc) ?? defaultColWidth
              }
              const anchorRightX = anchorLeftX + anchorW
              // Determine right limit for overflow: stop at the first non-empty cell.
              // If there is an active editor in this row, carve a hole for its cell
              // but continue the overflow rendering after that hole.
              let overflowRightLimitX = viewportRight
              let holeLeftX = -1
              let holeRightX = -1
              let curX = anchorRightX
              let scanC = anchorMerge ? anchorMerge.c + anchorMerge.cols : anchorC + 1
              const isRowEditing =
                !!rc.editor && rc.editor.r === r && rc.editor.selStart != null && rc.editor.selEnd != null
              while (scanC < sheet.cols) {
                const w2 = sheet.colWidths.get(scanC) ?? defaultColWidth
                const nextX = curX + w2
                const isEditorHere = isRowEditing && rc.editor!.c === scanC
                const vHere = sheet.getValueAt(r, scanC)
                const hasValHere = vHere != null && (typeof vHere !== 'string' || vHere.length > 0)
                if (hasValHere) {
                  overflowRightLimitX = Math.min(overflowRightLimitX, curX)
                  break
                }
                if (isEditorHere) {
                  holeLeftX = curX
                  holeRightX = nextX
                }
                curX = nextX
                if (curX >= viewportRight) break
                scanC++
              }

              // Setup text style to measure/draw accurately
              if (style?.font) {
                const size = (style.font.size ?? 14) * z
                const family =
                  style.font.family ??
                  'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
                const weight = style.font.bold ? 'bold' : 'normal'
                const italic = style.font.italic ? 'italic ' : ''
                ctx.font = `${italic}${weight} ${size}px ${family}`
              } else {
                ctx.font = `normal ${14 * z}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`
              }
              ctx.fillStyle = style?.font?.color ?? '#111827'
              ctx.textAlign = 'left'
              // vertical alignment
              const valign = style?.alignment?.vertical ?? 'middle'
              let ty = y + baseH / 2
              if (valign === 'top') {
                ctx.textBaseline = 'top'
                ty = y + 3
              } else if (valign === 'bottom') {
                ctx.textBaseline = 'bottom'
                ty = y + baseH - 3
              } else {
                ctx.textBaseline = 'middle'
              }

              const tx = anchorLeftX + 4
              const textW = this.measureTextCached(ctx, raw)
              const desiredRight = tx + textW + 2
              const allowedRight =
                overflowRightLimitX < viewportRight ? overflowRightLimitX : viewportRight
              const finalRight = Math.min(desiredRight, allowedRight)

              // Clip region: viewport-left to finalRight, with an optional hole for the editor cell
              ctx.save()
              ctx.beginPath()
              const clipLeft = Math.floor(viewportLeft) + 1
              if (isRowEditing && holeLeftX >= 0 && holeRightX > holeLeftX) {
                const leftW = Math.max(0, Math.floor(Math.min(finalRight, holeLeftX) - clipLeft))
                if (leftW > 0) ctx.rect(clipLeft, y + 1, leftW, Math.max(0, baseH - 2))
                const rightX = Math.max(clipLeft, Math.floor(holeRightX))
                const rightW = Math.max(0, Math.floor(finalRight - rightX))
                if (rightW > 0) ctx.rect(rightX, y + 1, rightW, Math.max(0, baseH - 2))
              } else {
                const clipW = Math.max(0, Math.floor(finalRight) - clipLeft)
                if (clipW > 0) ctx.rect(clipLeft, y + 1, clipW, Math.max(0, baseH - 2))
              }
              ctx.clip()
              // Draw the text and its decorations within the same clip region
              ctx.fillText(raw, tx, ty)
              if (style?.font?.underline || style?.font?.strikethrough) {
                const drawnW = this.measureTextCached(ctx, raw)
                const sizePx2 = style?.font?.size ?? 14
                // Derive a top-edge Y from current baseline (consistent with single-line path)
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
              ctx.restore()
            }
          }
        }
      }

      // PASS 2: text（始终完整绘制，保证视觉稳定，避免 fast/非 fast 间切换导致闪烁）
        x = originX - visible.offsetX
        for (let c = visible.colStart; c <= visible.colEnd; c++) {
          const baseW = (sheet.colWidths.get(c) ?? defaultColWidth) * z
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
              drawW += (sheet.colWidths.get(cc) ?? defaultColWidth) * z
            drawH = 0
            for (let rr = m.r; rr < m.r + m.rows; rr++)
              drawH += (sheet.rowHeights.get(rr) ?? defaultRowHeight) * z
          }
          const cell = sheet.getCell(r, c)
          const style = sheet.getStyle(cell?.styleId)
          const raw = cell?.value != null ? String(cell.value) : ''
          const isActiveEditing = !!rc.editor && rc.editor.selStart != null && rc.editor.selEnd != null
          const isEditingAnchor = isActiveEditing && rc.editor.r === r && rc.editor.c === c
          const txt = isEditingAnchor ? (rc.editor!.text ?? '') : raw

          // Do not draw text for the editing anchor here; editor layer is responsible for it
          if (txt && !isEditingAnchor) {
          // Always set font and color per cell to avoid bleeding styles into neighbors
          const scaledFont = style?.font
            ? { ...style.font, size: (style.font.size ?? 14) * z }
            : undefined
          ctx.font = fontStringFromStyle(scaledFont, 14 * z)
          ctx.fillStyle = style?.font?.color ?? '#111827'
          // alignment & flow
          const halign = style?.alignment?.horizontal ?? 'left'
          const valign = style?.alignment?.vertical ?? 'middle'
          {
          const wrap = style?.alignment?.wrapText ?? false
          // While editing, force overflow rendering so hidden text is visible.
          const overflow: 'overflow' | 'clip' | 'ellipsis' = isEditingAnchor
            ? 'overflow'
            : (style?.alignment?.overflow ?? 'overflow')

            // Compute dynamic right stop for overflow so that any occupied or editing cell to the right is preserved.
          const vGap2 = rc.scrollbar.vTrack ? rc.scrollbar.thickness : 0
          const viewportRight = rc.viewport.width - vGap2
          let overflowRightLimitX = viewportRight
          // Only treat the active editor as a blocker in the SAME row; otherwise do not affect other rows.
          const isRowEditing = isActiveEditing && rc.editor!.r === r
          // Track an optional hole (the active editor cell) so overflow can continue after it.
          let holeLeftX = -1
          let holeRightX = -1
          if (!wrap && overflow === 'overflow') {
            // Start scanning from the first column after current (or after current merge span)
            let curX = x + drawW
            let scanC = m && m.r === r && m.c === c ? m.c + m.cols : c + 1
            while (scanC < sheet.cols) {
              const w2 = sheet.colWidths.get(scanC) ?? defaultColWidth
              const nextX = curX + w2
              const isEditorHere = isRowEditing && rc.editor!.c === scanC
              const vHere = sheet.getValueAt(r, scanC)
              const hasValHere = vHere != null && (typeof vHere !== 'string' || vHere.length > 0)
              if (hasValHere) {
                overflowRightLimitX = Math.min(overflowRightLimitX, curX)
                break
              }
              if (isEditorHere) {
                // Record editor hole and continue scanning to allow overflow after the editor
                holeLeftX = curX
                holeRightX = nextX
              }
              curX = nextX
              if (curX >= viewportRight) break
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
            const sizePx = (style?.font?.size ?? 14) * z
            const lineH = Math.max(12 * z, Math.round(sizePx * 1.25))
            ctx.save()
            ctx.beginPath()
            ctx.rect(x + 1, y + 1, Math.max(0, drawW - 2), Math.max(0, drawH - 2))
            ctx.clip()
            ctx.textBaseline = 'top'
            let cursorY = y + 3
            const lines = this.wrapTextCached(
              ctx,
              txt,
              maxW,
              scaledFont,
              14 * z,
            )
            for (let li = 0; li < lines.length; li++) {
              if (cursorY > y + drawH - 3) break
              const seg = lines[li]
              const run = txt.slice(seg.start, seg.end)
              let lx = x + 4
              if (halign === 'center') lx = x + drawW / 2
              else if (halign === 'right') lx = x + drawW - 4
              ctx.fillText(run, lx, cursorY)
              // Decorations: underline/strikethrough per line
              if (style?.font?.underline || style?.font?.strikethrough) {
                const wRun = this.measureTextCached(ctx, run)
                const uY = cursorY + Math.max(1, Math.round(sizePx * 0.85))
                const sY = cursorY + Math.max(1, Math.round(sizePx * 0.45))
                ctx.save()
                ctx.beginPath()
                ctx.rect(x + 1, y + 1, Math.max(0, drawW - 2), Math.max(0, drawH - 2))
                ctx.clip()
                ctx.strokeStyle = style?.font?.color ?? '#111827'
                ctx.lineWidth = 1
                if (style?.font?.underline) {
                  ctx.beginPath()
                  ctx.moveTo(lx, uY)
                  ctx.lineTo(lx + wRun, uY)
                  ctx.stroke()
                }
                if (style?.font?.strikethrough) {
                  ctx.beginPath()
                  ctx.moveTo(lx, sY)
                  ctx.lineTo(lx + wRun, sY)
                  ctx.stroke()
                }
                ctx.restore()
              }
              cursorY += lineH
            }
            ctx.restore()
          } else {
            // single-line: apply overflow policy (Excel-like precise column-bound algorithm)
            const needsClipPolicy = overflow === 'clip' || overflow === 'ellipsis'
            if (needsClipPolicy || isEditingAnchor || halign !== 'left') {
              // For clip/ellipsis, or non-left alignment, just clip to cell box
              ctx.save()
              ctx.beginPath()
              ctx.rect(x + 1, y + 1, Math.max(0, drawH > 0 ? drawW - 2 : 0), Math.max(0, drawH - 2))
              ctx.clip()
            } else if (overflow === 'overflow') {
              // measure text and compute desired right edge
              const textW = this.measureTextCached(ctx, txt)
              const desiredRight = tx + textW + 2
              const allowedRight =
                overflowRightLimitX < viewportRight ? overflowRightLimitX : viewportRight
              const finalRight = Math.min(desiredRight, allowedRight)
              ctx.save()
              ctx.beginPath()
              if (isRowEditing && holeLeftX >= 0 && holeRightX > holeLeftX) {
                // Two-segment clip: left of editor, and right of editor until finalRight
                const leftW = Math.max(0, Math.floor(holeLeftX - (x + 1)))
                if (leftW > 0) ctx.rect(x + 1, y + 1, leftW, Math.max(0, drawH - 2))
                const rightX = Math.max(holeRightX, x + 1)
                const rightW = Math.max(0, Math.floor(finalRight - rightX))
                if (rightW > 0) ctx.rect(Math.floor(rightX), y + 1, rightW, Math.max(0, drawH - 2))
              } else {
                // Simple one-piece clip from cell left to finalRight
                const wideW = Math.max(0, Math.floor(finalRight - (x + 1)))
                if (wideW > 0) ctx.rect(x + 1, y + 1, wideW, Math.max(0, drawH - 2))
              }
              ctx.clip()
            } else {
              // Fallback safety: clip to cell interior
              ctx.save()
              ctx.beginPath()
              ctx.rect(x + 1, y + 1, Math.max(0, drawW - 2), Math.max(0, drawH - 2))
              ctx.clip()
            }
            let out = txt
            if (overflow === 'ellipsis' && maxW > 0) {
              const w0 = this.measureTextCached(ctx, out)
              if (w0 > maxW) {
                const n2 = this.ellipsisCutCached(ctx, out, maxW)
                out = out.slice(0, n2) + '...'
              }
            }
            ctx.fillText(out, tx, ty)
            // Decorations for single-line
            if (style?.font?.underline || style?.font?.strikethrough) {
              // approximate text width of what we drew
              const drawnW = this.measureTextCached(ctx, out)
              const sizePx2 = (style?.font?.size ?? 14) * z
              // Derive a top-edge Y from current baseline so we can use
              // consistent top-relative offsets (matches the multiline path)
              let topY: number
              const base = ctx.textBaseline || 'alphabetic'
              if (base === 'top') topY = ty
              else if (base === 'bottom') topY = ty - sizePx2
              else if (base === 'middle') topY = ty - sizePx2 * 0.5
              else /* alphabetic and others */ topY = ty - sizePx2 * 0.85
              const uY = topY + Math.max(1, Math.round(sizePx2 * 0.85))
              const sY = topY + Math.max(1, Math.round(sizePx2 * 0.45))
              ctx.save()
              // Keep the same clip region as used for the text above.
              // We already set a clip in all cases (custom/two-segment or wide-to-viewport),
              // so do not re-clip here; otherwise decorations would be wrongly cut off
              // at the cell boundary and disappear when only the overflow area is visible.
              ctx.strokeStyle = style?.font?.color ?? '#111827'
              ctx.lineWidth = 1
              // Compute start X for line matching text alignment
              let lineL = tx
              if (halign === 'center') lineL = tx - drawnW / 2
              else if (halign === 'right') lineL = tx - drawnW
              if (style?.font?.underline) {
                ctx.beginPath()
                ctx.moveTo(lineL, uY)
                ctx.lineTo(lineL + drawnW, uY)
                ctx.stroke()
              }
              if (style?.font?.strikethrough) {
                ctx.beginPath()
                ctx.moveTo(lineL, sY)
                ctx.lineTo(lineL + drawnW, sY)
                ctx.stroke()
              }
              ctx.restore()
            }
            ctx.restore()
          }
          } // end precise path
        }

        x += baseW
      }
      // 行累加必须始终进行（之前在 fast 时被包进了文本分支，导致行线错位/消失）
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

    // GLOBAL PASS: draw custom cell borders on top of everything (always on to avoid flicker)
    {
      let yB = originY - visible.offsetY
    for (let r = visible.rowStart; r <= visible.rowEnd; r++) {
      const baseH = (sheet.rowHeights.get(r) ?? defaultRowHeight) * z
      let xB = originX - visible.offsetX
      for (let c = visible.colStart; c <= visible.colEnd; c++) {
        const baseW = (sheet.colWidths.get(c) ?? defaultColWidth) * z
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
            drawW += (sheet.colWidths.get(cc) ?? defaultColWidth) * z
          drawH = 0
          for (let rr = m.r; rr < m.r + m.rows; rr++)
            drawH += (sheet.rowHeights.get(rr) ?? defaultRowHeight) * z
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
        }
        xB += baseW
      }
        yB += baseH
      }
    }

    ctx.restore()
  }
 

}
