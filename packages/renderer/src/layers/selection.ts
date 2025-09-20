import type { Layer, RenderContext } from '../types/context'

export class SelectionLayer implements Layer {
  name = 'selection'
  render(rc: RenderContext) {
    const {
      ctx,
      sheet,
      defaultColWidth,
      defaultRowHeight,
      originX,
      originY,
      selection,
      scroll,
      viewport,
    } = rc
    if (!selection) return

    // Normalize selection (0-based inclusive indices)
    const r0 = Math.max(0, Math.min(selection.r0, selection.r1))
    const r1 = Math.min(sheet.rows - 1, Math.max(selection.r0, selection.r1))
    const c0 = Math.max(0, Math.min(selection.c0, selection.c1))
    const c1 = Math.min(sheet.cols - 1, Math.max(selection.c0, selection.c1))

    // Compute cumulative sizes helpers (defaults + overrides delta)
    const cumWidth = (i: number): number => {
      let base = i * defaultColWidth
      if (sheet.colWidths.size)
        for (const [c, w] of sheet.colWidths) {
          if (c < i) base += w - defaultColWidth
        }
      return base
    }
    const cumHeight = (i: number): number => {
      let base = i * defaultRowHeight
      if (sheet.rowHeights.size)
        for (const [r, h] of sheet.rowHeights) {
          if (r < i) base += h - defaultRowHeight
        }
      return base
    }

    // Selection rect in canvas pixels, independent of overscan math
    const x0 = originX + cumWidth(c0) - scroll.x
    const x1 = originX + cumWidth(c1 + 1) - scroll.x
    const y0 = originY + cumHeight(r0) - scroll.y
    const y1 = originY + cumHeight(r1 + 1) - scroll.y

    // Clip to viewport content area (exclude headers)
    const clipLeft = originX
    const clipTop = originY
    const vGap = rc.scrollbar.vTrack ? rc.scrollbar.thickness : 0
    const hGap = rc.scrollbar.hTrack ? rc.scrollbar.thickness : 0
    const clipRight = viewport.width - vGap
    const clipBottom = viewport.height - hGap
    const left = Math.max(x0, clipLeft)
    const top = Math.max(y0, clipTop)
    const right = Math.min(x1, clipRight)
    const bottom = Math.min(y1, clipBottom)
    const w = right - left
    const h = bottom - top
    if (w <= 0 || h <= 0) return

    // For single-cell selection, do NOT paint a translucent fill.
    // This avoids covering overflow text from adjacent cells (e.g. A8 flowing into B8).
    // For multi-cell selection, paint fill but punch a hole at the active cell (anchor)
    // so the user can see the anchor cell clearly. If the anchor lies anywhere inside a
    // merged block, the hole must cover the entire merged block rather than a 1x1 cell
    // to avoid showing a small square when the selection was started from a non-top-left
    // corner of the merge.
    const isSingleCell = r0 === r1 && c0 === c1

    ctx.save()
    if (!isSingleCell) {
      // Selection interior (shrink by 1px to keep stroke crisp)
      const selL = Math.floor(left) + 1
      const selT = Math.floor(top) + 1
      const selW = Math.max(0, Math.floor(w) - 2)
      const selH = Math.max(0, Math.floor(h) - 2)

      // Active/anchor cell: prefer provided selectionAnchor, fallback to selection's top-left
      let ar = rc.selectionAnchor?.r ?? r0
      let ac = rc.selectionAnchor?.c ?? c0
      // If anchor lies outside the current selection (e.g. header/corner select), fallback to top-left
      const rrMin = Math.min(r0, r1),
        rrMax = Math.max(r0, r1)
      const ccMin = Math.min(c0, c1),
        ccMax = Math.max(c0, c1)
      if (ar < rrMin || ar > rrMax || ac < ccMin || ac > ccMax) {
        ar = r0
        ac = c0
      }
      // If the anchor lies anywhere inside a merged block, resolve to the block's top-left
      // for the purpose of computing the punched hole.
      const mAtAnchor = sheet.getMergeAt(ar, ac)
      if (mAtAnchor) {
        ar = mAtAnchor.r
        ac = mAtAnchor.c
      }
      // Compute anchor cell box in canvas coords (respect merges)
      const xA0 = originX + cumWidth(ac) - scroll.x
      let xA1 = originX + cumWidth(ac + 1) - scroll.x
      const yA0 = originY + cumHeight(ar) - scroll.y
      let yA1 = originY + cumHeight(ar + 1) - scroll.y
      const mA = sheet.getMergeAt(ar, ac)
      if (mA) {
        xA1 = originX + cumWidth(ac + mA.cols) - scroll.x
        yA1 = originY + cumHeight(ar + mA.rows) - scroll.y
      }
      // Clip anchor box to content area
      const aL = Math.max(Math.floor(xA0), Math.floor(originX))
      const aT = Math.max(Math.floor(yA0), Math.floor(originY))
      const aR = Math.min(
        Math.floor(xA1),
        Math.floor(viewport.width - (rc.scrollbar.vTrack ? rc.scrollbar.thickness : 0)),
      )
      const aB = Math.min(
        Math.floor(yA1),
        Math.floor(viewport.height - (rc.scrollbar.hTrack ? rc.scrollbar.thickness : 0)),
      )
      // Anchor interior (also shrink by 1px to align with selection interior and keep borders crisp)
      const holeL = Math.max(selL, aL + 1)
      const holeT = Math.max(selT, aT + 1)
      const holeR = Math.min(selL + selW, aR - 1)
      const holeB = Math.min(selT + selH, aB - 1)

      ctx.fillStyle = 'rgba(59, 130, 246, 0.08)'
      ctx.beginPath()
      // Outer selection interior rect
      ctx.rect(selL, selT, Math.max(0, selW), Math.max(0, selH))
      // Subtract anchor interior using even-odd rule (if hole is valid)
      if (holeR > holeL && holeB > holeT) {
        ctx.rect(holeL, holeT, Math.max(0, holeR - holeL), Math.max(0, holeB - holeT))
        ctx.fill('evenodd')
      } else {
        ctx.fill()
      }
    }
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.strokeRect(
      Math.floor(left) + 0.5,
      Math.floor(top) + 0.5,
      Math.floor(w) - 1,
      Math.floor(h) - 1,
    )
    ctx.restore()
  }
}
