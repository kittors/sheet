import type { Layer, RenderContext } from '../types/context'

export class ContentLayer implements Layer {
  name = 'content'
  render(rc: RenderContext) {
    const { ctx, visible, sheet, defaultColWidth, defaultRowHeight, originX, originY } = rc
    ctx.save()
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
          if (style?.font) {
            const size = style.font.size ?? 14
            const family = style.font.family ?? 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
            const weight = style.font.bold ? 'bold' : 'normal'
            const italic = style.font.italic ? 'italic ' : ''
            ctx.font = `${italic}${weight} ${size}px ${family}`
          }
          ctx.fillStyle = style?.font?.color ?? '#111827'
          ctx.fillText(txt, x + 4, y + h / 2)
        }
        x += w
      }
      y += h
    }

    ctx.restore()
  }
}
