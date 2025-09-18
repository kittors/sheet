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
      const h = sheet.rowHeights.get(r) ?? defaultRowHeight
      let x = originX - visible.offsetX
      for (let c = visible.colStart; c <= visible.colEnd; c++) {
        const w = sheet.colWidths.get(c) ?? defaultColWidth
        const cell = sheet.getCell(r, c)
        const txt = cell?.value != null ? String(cell.value) : ''
        if (txt) {
          const style = sheet.getStyle(cell?.styleId)
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
          if (halign === 'center') tx = x + w / 2
          else if (halign === 'right') tx = x + w - 4
          // vertical
          let ty = y + h / 2
          if (valign === 'top') { ctx.textBaseline = 'top'; ty = y + 3 }
          else if (valign === 'bottom') { ctx.textBaseline = 'bottom'; ty = y + h - 3 }
          else { ctx.textBaseline = 'middle'; ty = y + h / 2 }
          // text align maps
          if (halign === 'left') ctx.textAlign = 'left'
          else if (halign === 'right') ctx.textAlign = 'right'
          else ctx.textAlign = 'center'
          ctx.fillText(txt, tx, ty)
        }
        x += w
      }
      y += h
    }

    ctx.restore()
  }
}
