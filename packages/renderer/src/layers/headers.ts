import type { Layer, RenderContext } from '../types/context'

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
    const { ctx, viewport, visible, sheet, defaultColWidth, defaultRowHeight, originX, originY } = rc
    ctx.save()
    // Column/Row header backgrounds (avoid overlapping scrollbar tracks)
    const vGap = rc.scrollbar.vTrack ? rc.scrollbar.thickness : 0
    const hGap = rc.scrollbar.hTrack ? rc.scrollbar.thickness : 0
    ctx.fillStyle = '#f9fafb'
    const colHeaderW = Math.max(0, viewport.width - originX - vGap)
    ctx.fillRect(originX, 0, colHeaderW, originY)
    const rowHeaderH = Math.max(0, viewport.height - originY - hGap)
    ctx.fillRect(0, originY, originX, rowHeaderH)
    // Corner keep blank (white)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, originX, originY)

    // Highlight selected columns/rows in header bands
    if (rc.selection) {
      const sel = rc.selection
      // Column header highlights
      ctx.save()
      ctx.beginPath()
      ctx.rect(originX, 0, Math.max(0, viewport.width - originX - vGap), originY)
      ctx.clip()
      let hx = originX - visible.offsetX
      for (let c = visible.colStart; c <= visible.colEnd; c++) {
        const w = sheet.colWidths.get(c) ?? defaultColWidth
        if (c >= Math.min(sel.c0, sel.c1) && c <= Math.max(sel.c0, sel.c1)) {
          ctx.fillStyle = '#e5e7eb' // darker than base header bg
          ctx.fillRect(hx, 0, w, originY)
        }
        hx += w
      }
      ctx.restore()

      // Row header highlights
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, originY, originX, Math.max(0, viewport.height - originY - hGap))
      ctx.clip()
      let hy = originY - visible.offsetY
      for (let r = visible.rowStart; r <= visible.rowEnd; r++) {
        const h = sheet.rowHeights.get(r) ?? defaultRowHeight
        if (r >= Math.min(sel.r0, sel.r1) && r <= Math.max(sel.r0, sel.r1)) {
          ctx.fillStyle = '#e5e7eb'
          ctx.fillRect(0, hy, originX, h)
        }
        hy += h
      }
      ctx.restore()
    }

    ctx.fillStyle = '#374151'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'

    // Column headers (scroll with X) - clip to header band to avoid corner overlap
    ctx.save()
    ctx.beginPath()
    ctx.rect(originX, 0, Math.max(0, viewport.width - originX - vGap), originY)
    ctx.clip()
    let x = originX - visible.offsetX
    for (let c = visible.colStart; c <= visible.colEnd; c++) {
      const w = sheet.colWidths.get(c) ?? defaultColWidth
      const label = colToName(c)
      ctx.fillText(label, x + w / 2, originY / 2)
      x += w
    }
    ctx.restore()

    // Row headers (scroll with Y) - clip to header band to avoid corner overlap
    ctx.textAlign = 'right'
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, originY, originX, Math.max(0, viewport.height - originY - hGap))
    ctx.clip()
    let y = originY - visible.offsetY
    for (let r = visible.rowStart; r <= visible.rowEnd; r++) {
      const h = sheet.rowHeights.get(r) ?? defaultRowHeight
      const label = String(r + 1)
      ctx.fillText(label, originX - 6, y + h / 2)
      y += h
    }
    ctx.restore()

    // Header grid lines
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    // Column header vertical lines (clip to header band)
    ctx.save()
    ctx.beginPath()
    ctx.rect(originX, 0, Math.max(0, viewport.width - originX - vGap), originY)
    ctx.clip()
    x = originX - visible.offsetX
    for (let c = visible.colStart; c <= visible.colEnd + 1; c++) {
      const w = sheet.colWidths.get(c) ?? defaultColWidth
      ctx.beginPath()
      ctx.moveTo(Math.floor(x) + 0.5, 0)
      ctx.lineTo(Math.floor(x) + 0.5, originY)
      ctx.stroke()
      x += w
    }
    ctx.restore()
    // Row header horizontal lines (clip to header band)
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, originY, originX, Math.max(0, viewport.height - originY - hGap))
    ctx.clip()
    y = originY - visible.offsetY
    for (let r = visible.rowStart; r <= visible.rowEnd + 1; r++) {
      const h = sheet.rowHeights.get(r) ?? defaultRowHeight
      ctx.beginPath()
      ctx.moveTo(0, Math.floor(y) + 0.5)
      ctx.lineTo(originX, Math.floor(y) + 0.5)
      ctx.stroke()
      y += h
    }
    ctx.restore()

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
