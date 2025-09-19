import type { Layer, RenderContext } from '../types/context'

export class ContentLayer implements Layer {
  name = 'content'
  render(rc: RenderContext) {
    const { ctx, visible, sheet, defaultColWidth, defaultRowHeight, originX, originY } = rc
    const vGap = rc.scrollbar.vTrack ? rc.scrollbar.thickness : 0
    const hGap = rc.scrollbar.hTrack ? rc.scrollbar.thickness : 0
    ctx.save()
    // Clip to content area (exclude headers and scrollbars)
    ctx.beginPath()
    ctx.rect(originX, originY, Math.max(0, rc.viewport.width - originX - vGap), Math.max(0, rc.viewport.height - originY - hGap))
    ctx.clip()
    ctx.fillStyle = '#111827'
    ctx.textBaseline = 'middle'
    ctx.font = 'normal 14px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'

    let y = originY - visible.offsetY
    for (let r = visible.rowStart; r <= visible.rowEnd; r++) {
      const baseH = sheet.rowHeights.get(r) ?? defaultRowHeight
      let x = originX - visible.offsetX
      for (let c = visible.colStart; c <= visible.colEnd; c++) {
        const baseW = sheet.colWidths.get(c) ?? defaultColWidth

        // Skip covered cells of a merge (only draw at anchor)
        const m = sheet.getMergeAt(r, c)
        if (m && !(m.r === r && m.c === c)) {
          x += baseW
          continue
        }

        // Resolve anchor cell and compute span sizes if merged
        let drawW = baseW
        let drawH = baseH
        if (m) {
          // Sum widths across merged columns
          drawW = 0
          for (let cc = m.c; cc < m.c + m.cols; cc++) drawW += sheet.colWidths.get(cc) ?? defaultColWidth
          // Sum heights across merged rows
          drawH = 0
          for (let rr = m.r; rr < m.r + m.rows; rr++) drawH += sheet.rowHeights.get(rr) ?? defaultRowHeight
        }

        const cell = sheet.getCell(r, c)
        const style = sheet.getStyle(cell?.styleId)
        const txt = cell?.value != null ? String(cell.value) : ''

        // Background fill (covers merged span if any)
        if (style?.fill?.backgroundColor) {
          ctx.fillStyle = style.fill.backgroundColor
          ctx.fillRect(Math.floor(x) + 1, Math.floor(y) + 1, Math.max(0, Math.floor(drawW) - 2), Math.max(0, Math.floor(drawH) - 2))
        }

        if (txt) {
          // font
          if (style?.font) {
            const size = style.font.size ?? 14
            const family = style.font.family ?? 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
            const weight = style.font.bold ? 'bold' : 'normal'
            const italic = style.font.italic ? 'italic ' : ''
            ctx.font = `${italic}${weight} ${size}px ${family}`
          }
          ctx.fillStyle = style?.font?.color ?? '#111827'
          // alignment
          const halign = style?.alignment?.horizontal ?? 'left'
          const valign = style?.alignment?.vertical ?? 'middle'
          // horizontal
          let tx = x + 4
          if (halign === 'center') tx = x + drawW / 2
          else if (halign === 'right') tx = x + drawW - 4
          // vertical
          let ty = y + drawH / 2
          if (valign === 'top') { ctx.textBaseline = 'top'; ty = y + 3 }
          else if (valign === 'bottom') { ctx.textBaseline = 'bottom'; ty = y + drawH - 3 }
          else { ctx.textBaseline = 'middle'; ty = y + drawH / 2 }
          // text align maps
          if (halign === 'left') ctx.textAlign = 'left'
          else if (halign === 'right') ctx.textAlign = 'right'
          else ctx.textAlign = 'center'
          ctx.fillText(txt, tx, ty)
        }
        x += baseW
      }
      y += baseH
    }

    ctx.restore()
  }
}
