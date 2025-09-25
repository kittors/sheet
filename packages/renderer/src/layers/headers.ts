import type { Layer, RenderContext } from '../types/context'
import { computeVisibleRange, snapCoord } from '@sheet/shared-utils'

function colToName(n: number): string {
  // 0-based index to Excel-like name
  let s = ''
  n += 1
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export class HeadersLayer implements Layer {
  name = 'headers'
  render(rc: RenderContext) {
    const {
      ctx,
      viewport,
      visible,
      sheet,
      defaultColWidth,
      defaultRowHeight,
      originX,
      originY,
      zoom,
    } = rc
    const z = zoom ?? 1
    ctx.save()
    // Helper to set header font size; allow shrinking down to 1px at extreme zooms
    const setHeaderFontPx = (px: number) => {
      const fs = Math.max(1, Math.floor(px))
      ctx.font = `normal ${fs}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`
    }
    // Column/Row header backgrounds (avoid overlapping scrollbar tracks)
    const vGap = rc.scrollbar.vTrack ? rc.scrollbar.thickness : 0
    const hGap = rc.scrollbar.hTrack ? rc.scrollbar.thickness : 0
    ctx.fillStyle = rc.headerStyle.background
    const colHeaderW = Math.max(0, viewport.width - originX - vGap)
    ctx.fillRect(originX, 0, colHeaderW, originY)
    const rowHeaderH = Math.max(0, viewport.height - originY - hGap)
    ctx.fillRect(0, originY, originX, rowHeaderH)

    // Compute frozen pixel sizes at current zoom (used for handle placement and highlights)
    const frozenCols = Math.max(0, Math.min(sheet.cols, sheet.frozenCols || 0))
    const frozenRows = Math.max(0, Math.min(sheet.rows, sheet.frozenRows || 0))
    let leftFrozenPx = 0
    for (let c = 0; c < frozenCols; c++) leftFrozenPx += (sheet.colWidths.get(c) ?? defaultColWidth) * z
    let topFrozenPx = 0
    for (let r = 0; r < frozenRows; r++) topFrozenPx += (sheet.rowHeights.get(r) ?? defaultRowHeight) * z

    // Corner background + handle strokes (share freeze split line styling when active)
    ctx.save()
    ctx.fillStyle = '#f3f4f6'
    ctx.fillRect(0, 0, originX, originY)

    const baseLineWidth = Math.max(1, Math.floor(1 * z))
    const idleHandleColor = '#d1d5db'
    const guides = rc.guides

    const drawHandleLine = (
      orientation: 'vertical' | 'horizontal',
      coord: number,
      length: number,
      width: number,
      color: string,
    ) => {
      if (!Number.isFinite(coord) || length <= 0) return
      const lw = Math.max(1, Math.floor(width))
      const snapped = snapCoord(coord, lw)
      ctx.strokeStyle = color
      ctx.lineWidth = lw
      ctx.beginPath()
      if (orientation === 'vertical') {
        ctx.moveTo(snapped, 0)
        ctx.lineTo(snapped, length)
      } else {
        ctx.moveTo(0, snapped)
        ctx.lineTo(length, snapped)
      }
      ctx.stroke()
    }

    const hasGuideV = typeof guides?.v === 'number'
    const hasGuideH = typeof guides?.h === 'number'
    if (frozenCols === 0 && !hasGuideV) {
      drawHandleLine('vertical', originX - baseLineWidth / 2, originY, baseLineWidth, idleHandleColor)
    }
    if (frozenRows === 0 && !hasGuideH) {
      drawHandleLine('horizontal', originY - baseLineWidth / 2, originX, baseLineWidth, idleHandleColor)
    }

    ctx.restore()

    // Prepare scaled width/height maps for local visible-range calculations (headers only)
    const scaledColWidths = new Map<number, number>()
    for (const [i, w] of sheet.colWidths) scaledColWidths.set(i, w * z)
    const scaledRowHeights = new Map<number, number>()
    for (const [i, h] of sheet.rowHeights) scaledRowHeights.set(i, h * z)

    // Precompute main header visible ranges (exclude frozen pixels)
    const colMainW = Math.max(0, viewport.width - originX - vGap - leftFrozenPx)
    const rowMainH = Math.max(0, viewport.height - originY - hGap - topFrozenPx)
    const visCMain = computeVisibleRange({
      scrollX: Math.max(0, (rc.scroll?.x ?? 0) + leftFrozenPx),
      scrollY: 0,
      viewportWidth: colMainW,
      viewportHeight: originY,
      colCount: sheet.cols,
      rowCount: sheet.rows,
      defaultColWidth: defaultColWidth * z,
      defaultRowHeight: defaultRowHeight * z,
      colWidths: scaledColWidths,
      rowHeights: scaledRowHeights,
      overscan: 0,
    })
    const visRMain = computeVisibleRange({
      scrollX: 0,
      scrollY: Math.max(0, (rc.scroll?.y ?? 0) + topFrozenPx),
      viewportWidth: originX,
      viewportHeight: rowMainH,
      colCount: sheet.cols,
      rowCount: sheet.rows,
      defaultColWidth: defaultColWidth * z,
      defaultRowHeight: defaultRowHeight * z,
      colWidths: scaledColWidths,
      rowHeights: scaledRowHeights,
      overscan: 0,
    })

    // Highlight selected columns/rows in header bands (main segments + frozen segments)
    if (rc.selection) {
      const sel = rc.selection
      // Column header highlights (main segment)
      if (colMainW > 0) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(originX + leftFrozenPx, 0, colMainW, originY)
        ctx.clip()
        let hx = originX + leftFrozenPx - visCMain.offsetX
        for (let c = visCMain.colStart; c <= visCMain.colEnd; c++) {
          const w = (sheet.colWidths.get(c) ?? defaultColWidth) * z
          if (c >= Math.min(sel.c0, sel.c1) && c <= Math.max(sel.c0, sel.c1)) {
            ctx.fillStyle = rc.headerStyle.selectedBackground
            ctx.fillRect(hx, 0, w, originY)
          }
          hx += w
        }
        ctx.restore()
      }

      // Row header highlights (main segment)
      if (rowMainH > 0) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, originY + topFrozenPx, originX, rowMainH)
        ctx.clip()
        let hy = originY + topFrozenPx - visRMain.offsetY
        for (let r = visRMain.rowStart; r <= visRMain.rowEnd; r++) {
          const h = (sheet.rowHeights.get(r) ?? defaultRowHeight) * z
          if (r >= Math.min(sel.r0, sel.r1) && r <= Math.max(sel.r0, sel.r1)) {
            ctx.fillStyle = rc.headerStyle.selectedBackground
            ctx.fillRect(0, hy, originX, h)
          }
          hy += h
        }
        ctx.restore()
      }

      // Frozen columns header highlights (left band segment)
      if (leftFrozenPx > 0) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(originX, 0, Math.max(0, Math.min(leftFrozenPx, viewport.width - originX - vGap)), originY)
        ctx.clip()
        const visCF = computeVisibleRange({
          scrollX: 0,
          scrollY: 0,
          viewportWidth: Math.max(0, Math.min(leftFrozenPx, viewport.width - originX - vGap)),
          viewportHeight: originY,
          colCount: sheet.cols,
          rowCount: sheet.rows,
          defaultColWidth: defaultColWidth * z,
          defaultRowHeight: defaultRowHeight * z,
          colWidths: scaledColWidths,
          rowHeights: scaledRowHeights,
          overscan: 0,
        })
        let hxF = originX - visCF.offsetX
        for (let c = visCF.colStart; c <= visCF.colEnd; c++) {
          const w = (sheet.colWidths.get(c) ?? defaultColWidth) * z
          if (c >= Math.min(sel.c0, sel.c1) && c <= Math.max(sel.c0, sel.c1)) {
            ctx.fillStyle = rc.headerStyle.selectedBackground
            ctx.fillRect(hxF, 0, w, originY)
          }
          hxF += w
        }
        ctx.restore()
      }
      // Frozen rows header highlights (top band segment)
      if (topFrozenPx > 0) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, originY, originX, Math.max(0, Math.min(topFrozenPx, viewport.height - originY - hGap)))
        ctx.clip()
        const visRF = computeVisibleRange({
          scrollX: 0,
          scrollY: 0,
          viewportWidth: originX,
          viewportHeight: Math.max(0, Math.min(topFrozenPx, viewport.height - originY - hGap)),
          colCount: sheet.cols,
          rowCount: sheet.rows,
          defaultColWidth: defaultColWidth * z,
          defaultRowHeight: defaultRowHeight * z,
          colWidths: scaledColWidths,
          rowHeights: scaledRowHeights,
          overscan: 0,
        })
        let hyF = originY - visRF.offsetY
        for (let r = visRF.rowStart; r <= visRF.rowEnd; r++) {
          const h = (sheet.rowHeights.get(r) ?? defaultRowHeight) * z
          if (r >= Math.min(sel.r0, sel.r1) && r <= Math.max(sel.r0, sel.r1)) {
            ctx.fillStyle = rc.headerStyle.selectedBackground
            ctx.fillRect(0, hyF, originX, h)
          }
          hyF += h
        }
        ctx.restore()
      }
    }

    ctx.fillStyle = rc.headerStyle.textColor
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'

    // Column headers (scroll with X) - clip to header band to avoid corner overlap
    const colMainClipX = originX + leftFrozenPx
    const colMainClipW = Math.max(0, viewport.width - colMainClipX - vGap)
    if (colMainClipW > 0) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(colMainClipX, 0, colMainClipW, originY)
      ctx.clip()
      let x = originX + leftFrozenPx - visCMain.offsetX
      for (let c = visCMain.colStart; c <= visCMain.colEnd; c++) {
        const w = (sheet.colWidths.get(c) ?? defaultColWidth) * z
        const label = rc.headerLabels?.col ? rc.headerLabels.col(c) : colToName(c)
        const baseFs = 12 * z
        const availH = Math.max(1, originY - 4)
        const availW = Math.max(1, w - 8)
        let fs = Math.min(baseFs, availH * 0.9)
        setHeaderFontPx(fs)
        let tw = ctx.measureText(label).width
        if (tw > availW) {
          const scale = Math.max(0.1, availW / Math.max(1, tw))
          fs = Math.max(1, Math.floor(fs * scale))
          setHeaderFontPx(fs)
        }
        ctx.save()
        ctx.beginPath()
        ctx.rect(x, 0, w, originY)
        ctx.clip()
        ctx.fillText(label, x + w / 2, originY / 2)
        ctx.restore()
        x += w
      }
      ctx.restore()
    }
    // Frozen rows header text (top segment)
    if (topFrozenPx > 0) {
      ctx.save()
      ctx.beginPath()
      const hF = Math.max(0, Math.min(topFrozenPx, viewport.height - originY - hGap))
      ctx.rect(0, originY, originX, hF)
      ctx.clip()
      const visRF = computeVisibleRange({
        scrollX: 0,
        scrollY: 0,
        viewportWidth: originX,
        viewportHeight: hF,
        colCount: sheet.cols,
        rowCount: sheet.rows,
        defaultColWidth: defaultColWidth * z,
        defaultRowHeight: defaultRowHeight * z,
        colWidths: scaledColWidths,
        rowHeights: scaledRowHeights,
        overscan: 0,
      })
      let yF = originY - visRF.offsetY
      for (let r = visRF.rowStart; r <= visRF.rowEnd; r++) {
        const h = (sheet.rowHeights.get(r) ?? defaultRowHeight) * z
        const label = rc.headerLabels?.row ? rc.headerLabels.row(r) : String(r + 1)
        const baseFs = 12 * z
        const availH = Math.max(1, h - 4)
        const availW = Math.max(1, originX - 8)
        let fs = Math.min(baseFs, availH * 0.9)
        setHeaderFontPx(fs)
        let tw = ctx.measureText(label).width
        if (tw > availW) {
          const scale = Math.max(0.1, availW / Math.max(1, tw))
          fs = Math.max(1, Math.floor(fs * scale))
          setHeaderFontPx(fs)
        }
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, yF, originX, h)
        ctx.clip()
        ctx.fillText(label, originX / 2, yF + h / 2)
        ctx.restore()
        yF += h
      }
      ctx.restore()
    }
    // Frozen columns header text (left segment)
    if (leftFrozenPx > 0) {
      ctx.save()
      ctx.beginPath()
      const wF = Math.max(0, Math.min(leftFrozenPx, viewport.width - originX - vGap))
      ctx.rect(originX, 0, wF, originY)
      ctx.clip()
      const visCF = computeVisibleRange({
        scrollX: 0,
        scrollY: 0,
        viewportWidth: wF,
        viewportHeight: originY,
        colCount: sheet.cols,
        rowCount: sheet.rows,
        defaultColWidth: defaultColWidth * z,
        defaultRowHeight: defaultRowHeight * z,
        colWidths: scaledColWidths,
        rowHeights: scaledRowHeights,
        overscan: 0,
      })
      let xF = originX - visCF.offsetX
      for (let c = visCF.colStart; c <= visCF.colEnd; c++) {
        const w = (sheet.colWidths.get(c) ?? defaultColWidth) * z
        const label = rc.headerLabels?.col ? rc.headerLabels.col(c) : colToName(c)
        const baseFs = 12 * z
        const availH = Math.max(1, originY - 4)
        const availW = Math.max(1, w - 8)
        let fs = Math.min(baseFs, availH * 0.9)
        setHeaderFontPx(fs)
        let tw = ctx.measureText(label).width
        if (tw > availW) {
          const scale = Math.max(0.1, availW / Math.max(1, tw))
          fs = Math.max(1, Math.floor(fs * scale))
          setHeaderFontPx(fs)
        }
        ctx.save()
        ctx.beginPath()
        ctx.rect(xF, 0, w, originY)
        ctx.clip()
        ctx.fillText(label, xF + w / 2, originY / 2)
        ctx.restore()
        xF += w
      }
      ctx.restore()
    }

    // Row headers (scroll with Y) - clip to header band to avoid corner overlap
    // Center row labels horizontally within the row header cell
    ctx.textAlign = 'center'
    const rowMainClipY = originY + topFrozenPx
    const rowMainClipH = Math.max(0, viewport.height - rowMainClipY - hGap)
    if (rowMainClipH > 0) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, rowMainClipY, originX, rowMainClipH)
      ctx.clip()
      let y = originY + topFrozenPx - visRMain.offsetY
      for (let r = visRMain.rowStart; r <= visRMain.rowEnd; r++) {
        const h = (sheet.rowHeights.get(r) ?? defaultRowHeight) * z
        const label = rc.headerLabels?.row ? rc.headerLabels.row(r) : String(r + 1)
        const baseFs = 12 * z
        const availH = Math.max(1, h - 4)
        const availW = Math.max(1, originX - 8)
        let fs = Math.min(baseFs, availH * 0.9)
        setHeaderFontPx(fs)
        let tw = ctx.measureText(label).width
        if (tw > availW) {
          const scale = Math.max(0.1, availW / Math.max(1, tw))
          fs = Math.max(1, Math.floor(fs * scale))
          setHeaderFontPx(fs)
        }
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, y, originX, h)
        ctx.clip()
        ctx.fillText(label, originX / 2, y + h / 2)
        ctx.restore()
        y += h
      }
      ctx.restore()
    }

    // Header grid lines
    ctx.strokeStyle = rc.headerStyle.gridColor
    ctx.lineWidth = 1
    // Column header vertical lines (clip to header band)
    if (colMainClipW > 0) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(colMainClipX, 0, colMainClipW, originY)
      ctx.clip()
      let x = originX + leftFrozenPx - visCMain.offsetX
      for (let c = visCMain.colStart; c <= visCMain.colEnd + 1; c++) {
        const w = (sheet.colWidths.get(c) ?? defaultColWidth) * z
        ctx.beginPath()
        ctx.moveTo(Math.floor(x) + 0.5, 0)
        ctx.lineTo(Math.floor(x) + 0.5, originY)
        ctx.stroke()
        x += w
      }
      ctx.restore()
    }
    // Row header horizontal lines (clip to header band)
    if (rowMainClipH > 0) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, rowMainClipY, originX, rowMainClipH)
      ctx.clip()
      let y = originY + topFrozenPx - visRMain.offsetY
      for (let r = visRMain.rowStart; r <= visRMain.rowEnd + 1; r++) {
        const h = (sheet.rowHeights.get(r) ?? defaultRowHeight) * z
        ctx.beginPath()
        ctx.moveTo(0, Math.floor(y) + 0.5)
        ctx.lineTo(originX, Math.floor(y) + 0.5)
        ctx.stroke()
        y += h
      }
      ctx.restore()
    }
    // Frozen columns header grid (left segment)
    if (leftFrozenPx > 0) {
      ctx.save()
      ctx.beginPath()
      const wF = Math.max(0, Math.min(leftFrozenPx, viewport.width - originX - vGap))
      ctx.rect(originX, 0, wF, originY)
      ctx.clip()
      const visCF = computeVisibleRange({
        scrollX: 0,
        scrollY: 0,
        viewportWidth: wF,
        viewportHeight: originY,
        colCount: sheet.cols,
        rowCount: sheet.rows,
        defaultColWidth: defaultColWidth * z,
        defaultRowHeight: defaultRowHeight * z,
        colWidths: scaledColWidths,
        rowHeights: scaledRowHeights,
        overscan: 0,
      })
      let xF = originX - visCF.offsetX
      for (let c = visCF.colStart; c <= visCF.colEnd + 1; c++) {
        const w = (sheet.colWidths.get(c) ?? defaultColWidth) * z
        ctx.beginPath()
        ctx.moveTo(Math.floor(xF) + 0.5, 0)
        ctx.lineTo(Math.floor(xF) + 0.5, originY)
        ctx.stroke()
        xF += w
      }
      ctx.restore()
    }
    // Frozen rows header grid (top segment)
    if (topFrozenPx > 0) {
      ctx.save()
      ctx.beginPath()
      const hF = Math.max(0, Math.min(topFrozenPx, viewport.height - originY - hGap))
      ctx.rect(0, originY, originX, hF)
      ctx.clip()
      const visRF = computeVisibleRange({
        scrollX: 0,
        scrollY: 0,
        viewportWidth: originX,
        viewportHeight: hF,
        colCount: sheet.cols,
        rowCount: sheet.rows,
        defaultColWidth: defaultColWidth * z,
        defaultRowHeight: defaultRowHeight * z,
        colWidths: scaledColWidths,
        rowHeights: scaledRowHeights,
        overscan: 0,
      })
      let yF = originY - visRF.offsetY
      for (let r = visRF.rowStart; r <= visRF.rowEnd + 1; r++) {
        const h = (sheet.rowHeights.get(r) ?? defaultRowHeight) * z
        ctx.beginPath()
        ctx.moveTo(0, Math.floor(yF) + 0.5)
        ctx.lineTo(originX, Math.floor(yF) + 0.5)
        ctx.stroke()
        yF += h
      }
      ctx.restore()
    }

    // Optional: redraw internal separators in selected header region with a distinct color
    if (rc.selection && rc.headerStyle.selectedGridColor) {
      const sel = rc.selection
      const r0 = Math.max(0, Math.min(sel.r0, sel.r1))
      const r1 = Math.min(sheet.rows - 1, Math.max(sel.r0, sel.r1))
      const c0 = Math.max(0, Math.min(sel.c0, sel.c1))
      const c1 = Math.min(sheet.cols - 1, Math.max(sel.c0, sel.c1))

      const cumWidth = (i: number): number => {
        let base = i * defaultColWidth * z
        if (sheet.colWidths.size)
          for (const [c, w] of sheet.colWidths) {
            if (c < i) base += (w - defaultColWidth) * z
          }
        return base
      }
      const cumHeight = (i: number): number => {
        let base = i * defaultRowHeight * z
        if (sheet.rowHeights.size)
          for (const [r, h] of sheet.rowHeights) {
            if (r < i) base += (h - defaultRowHeight) * z
          }
        return base
      }

      // Column header internal separators
      if (colMainClipW > 0) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(colMainClipX, 0, colMainClipW, originY)
        ctx.clip()
        const baseCW = cumWidth(visCMain.colStart)
        ctx.strokeStyle = rc.headerStyle.selectedGridColor
        ctx.lineWidth = 1
        for (let c = c0; c < c1; c++) {
          const xMid = originX + leftFrozenPx - visCMain.offsetX + (cumWidth(c + 1) - baseCW)
          ctx.beginPath()
          ctx.moveTo(Math.floor(xMid) + 0.5, 0)
          ctx.lineTo(Math.floor(xMid) + 0.5, originY)
          ctx.stroke()
        }
        ctx.restore()
      }

      // Row header internal separators
      if (rowMainClipH > 0) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, rowMainClipY, originX, rowMainClipH)
        ctx.clip()
        const baseCH = cumHeight(visRMain.rowStart)
        ctx.strokeStyle = rc.headerStyle.selectedGridColor
        ctx.lineWidth = 1
        for (let r = r0; r < r1; r++) {
          const yMid = originY + topFrozenPx - visRMain.offsetY + (cumHeight(r + 1) - baseCH)
          ctx.beginPath()
          ctx.moveTo(0, Math.floor(yMid) + 0.5)
          ctx.lineTo(originX, Math.floor(yMid) + 0.5)
          ctx.stroke()
        }
        ctx.restore()
      }
    }

    // Outline border between headers and content
    ctx.beginPath()
    ctx.moveTo(originX + 0.5, 0)
    ctx.lineTo(originX + 0.5, viewport.height - hGap)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, originY + 0.5)
    ctx.lineTo(viewport.width - vGap, originY + 0.5)
    ctx.stroke()

    ctx.restore()
  }
}
