import type { Layer, RenderContext } from '../types/context'
import { snappedRect, strokeCrispRect } from '@sheet/shared-utils'

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

    // Note: Selection interior fill is now drawn beneath cell borders (inside ContentLayer)
    // to prevent perceived thickening of internal borders due to translucent overlay.
    // Draw selection border. By default draw all 4 sides. When actively editing the
    // single selected cell and its text overflows to the right, we intentionally do
    // NOT draw the right edge so the overflow text can visually cross that boundary
    // (common spreadsheet behavior). Other sides remain visible.
    // Selection outline: 2px, crisp and perfectly joined at corners.
    // Align to integer (even width) to avoid half-pixel fuzz and seams.
    const outlineW = 2
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = outlineW
    ctx.lineJoin = 'miter'
    ctx.lineCap = 'square'

    // Constrain stroking to content area so caps/joins never bleed into headers
    ctx.save()
    ctx.beginPath()
    ctx.rect(
      clipLeft,
      clipTop,
      Math.max(0, clipRight - clipLeft),
      Math.max(0, clipBottom - clipTop),
    )
    ctx.clip()

    const { x: L, y: T, w: W, h: H } = snappedRect(left, top, right, bottom, outlineW)

    let skipRightEdge = false
    const ed = rc.editor
    const isActiveEditing = !!ed && ed.selStart != null && ed.selEnd != null
    if (isActiveEditing && isSingleCell && ed!.r === r0 && ed!.c === c0) {
      const style = rc.sheet.getStyleAt(r0, c0)
      const wrap = !!style?.alignment?.wrapText
      const halign = style?.alignment?.horizontal ?? 'left'
      if (!wrap && halign === 'left') {
        // Only consider hiding the right edge when the editor is allowed to extend beyond
        // its own cell (no non-empty left neighbor).
        let allowExtend = true
        if (c0 - 1 >= 0) {
          const leftVal = rc.sheet.getValueAt(r0, c0 - 1)
          const hasLeft = leftVal != null && String(leftVal) !== ''
          if (hasLeft) allowExtend = false
        }
        if (allowExtend) {
          // Measure editor text width with the same font to detect real overflow beyond right border
          const txt = ed!.text ?? ''
          if (txt) {
            ctx.save()
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
            const textW = ctx.measureText(txt).width
            ctx.restore()
            const innerW = Math.max(0, W + 1 - 8) // 4px padding on both sides
            if (textW > innerW) skipRightEdge = true
          }
        }
      }
    }

    if (!skipRightEdge) {
      // Single joined rect: all four corners join perfectly
      strokeCrispRect(ctx, left, top, right, bottom, outlineW)
    } else {
      // Draw three sides (top/left/bottom). Keep top-left join connected for a perfect corner.
      // Left + Top as a single subpath (bottom-left -> top-left -> top-right)
      ctx.beginPath()
      ctx.moveTo(L, T + H)
      ctx.lineTo(L, T)
      ctx.lineTo(L + W, T)
      ctx.stroke()
      // Bottom as separate segment
      ctx.beginPath()
      ctx.moveTo(L, T + H)
      ctx.lineTo(L + W, T + H)
      ctx.stroke()
    }
    ctx.restore() // content clip
    ctx.restore()
  }
}
