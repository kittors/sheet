import { computeVisibleRange, resizeCanvasForDPR, getDPR } from '@sheet/shared-utils'
import type { Sheet } from '@sheet/core'
import { BackgroundLayer } from './layers/background'
import { GridLayer } from './layers/grid'
import { ContentLayer } from './layers/content'
import { HeadersLayer } from './layers/headers'
import { SelectionLayer } from './layers/selection'
import { ScrollbarLayer } from './layers/scrollbar'
import type { Layer } from './types/context'

export interface RendererOptions {
  defaultRowHeight?: number
  defaultColWidth?: number
  overscan?: number
  headerRowHeight?: number
  headerColWidth?: number
  scrollbarThickness?: number
  scrollbarThumbMinSize?: number
}

export class CanvasRenderer {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  dpr: number
  layers: Layer[]
  opts: Required<RendererOptions>
  selection?: { r0: number; c0: number; r1: number; c1: number }
  lastScrollbars: {
    vTrack: { x: number; y: number; w: number; h: number } | null
    vThumb: { x: number; y: number; w: number; h: number } | null
    hTrack: { x: number; y: number; w: number; h: number } | null
    hThumb: { x: number; y: number; w: number; h: number } | null
  } = { vTrack: null, vThumb: null, hTrack: null, hThumb: null }

  constructor(canvas: HTMLCanvasElement, opts: RendererOptions = {}) {
    this.canvas = canvas
    this.dpr = getDPR()
    this.ctx = resizeCanvasForDPR(canvas, canvas.clientWidth, canvas.clientHeight, this.dpr)
    // Draw headers above content to avoid any overlap artifacts in top/right areas
    this.layers = [new BackgroundLayer(), new GridLayer(), new ContentLayer(), new SelectionLayer(), new HeadersLayer(), new ScrollbarLayer()]
    this.opts = {
      defaultRowHeight: opts.defaultRowHeight ?? 24,
      defaultColWidth: opts.defaultColWidth ?? 100,
      overscan: opts.overscan ?? 2,
      headerRowHeight: opts.headerRowHeight ?? 28,
      headerColWidth: opts.headerColWidth ?? 48,
      scrollbarThickness: opts.scrollbarThickness ?? 12,
      scrollbarThumbMinSize: opts.scrollbarThumbMinSize ?? 24,
    }
  }

  resize(width: number, height: number) {
    this.ctx = resizeCanvasForDPR(this.canvas, width, height, this.dpr)
  }

  render(sheet: Sheet, scrollX: number, scrollY: number) {
    const viewport = { width: this.canvas.clientWidth, height: this.canvas.clientHeight }
    const originX = this.opts.headerColWidth
    const originY = this.opts.headerRowHeight
    const viewportContentWidth = Math.max(0, viewport.width - originX)
    const viewportContentHeight = Math.max(0, viewport.height - originY)

    // Compute content size and clamp scroll first (prevents boundary drift at large scrolls)
    const contentWidth = sheet.cols * this.opts.defaultColWidth + [...sheet.colWidths.entries()].reduce((acc, [c, w]) => acc + (w - this.opts.defaultColWidth), 0)
    const contentHeight = sheet.rows * this.opts.defaultRowHeight + [...sheet.rowHeights.entries()].reduce((acc, [r, h]) => acc + (h - this.opts.defaultRowHeight), 0)
    const maxScrollX = Math.max(0, contentWidth - viewportContentWidth)
    const maxScrollY = Math.max(0, contentHeight - viewportContentHeight)
    const sX = Math.max(0, Math.min(scrollX, maxScrollX))
    const sY = Math.max(0, Math.min(scrollY, maxScrollY))
    const visible = computeVisibleRange({
      scrollX: sX,
      scrollY: sY,
      viewportWidth: viewportContentWidth,
      viewportHeight: viewportContentHeight,
      colCount: sheet.cols,
      rowCount: sheet.rows,
      defaultColWidth: this.opts.defaultColWidth,
      defaultRowHeight: this.opts.defaultRowHeight,
      colWidths: sheet.colWidths,
      rowHeights: sheet.rowHeights,
      overscan: this.opts.overscan,
    })

    // Scrollbar geometry
    const thickness = this.opts.scrollbarThickness
    const minThumb = this.opts.scrollbarThumbMinSize

    // Vertical scrollbar visible only if content exceeds viewport
    let vTrack: { x: number; y: number; w: number; h: number } | null = null
    let vThumb: { x: number; y: number; w: number; h: number } | null = null
    const vScrollable = contentHeight > viewportContentHeight + 0.5
    if (vScrollable) {
      const x = viewport.width - thickness
      const y = originY
      const w = thickness
      // If horizontal bar also visible we keep room for corner
      const h = viewport.height - originY - (contentWidth > viewportContentWidth + 0.5 ? thickness : 0)
      vTrack = { x, y, w, h }
      const trackSpan = h
      const thumbLen = Math.max(minThumb, Math.max(0, Math.floor(trackSpan * (viewportContentHeight / contentHeight))))
      const maxThumbTop = trackSpan - thumbLen
      const maxScrollY = Math.max(0, contentHeight - viewportContentHeight)
      const frac = maxScrollY > 0 ? sY / maxScrollY : 0
      const thumbTop = y + Math.floor(maxThumbTop * frac)
      vThumb = { x, y: thumbTop, w, h: thumbLen }
    }

    // Horizontal scrollbar
    let hTrack: { x: number; y: number; w: number; h: number } | null = null
    let hThumb: { x: number; y: number; w: number; h: number } | null = null
    const hScrollable = contentWidth > viewportContentWidth + 0.5
    if (hScrollable) {
      const x = originX
      const y = viewport.height - thickness
      // If vertical bar also visible we keep room for corner
      const w = viewport.width - originX - (vScrollable ? thickness : 0)
      const h = thickness
      hTrack = { x, y, w, h }
      const trackSpan = w
      const thumbLen = Math.max(minThumb, Math.max(0, Math.floor(trackSpan * (viewportContentWidth / contentWidth))))
      const maxThumbLeft = trackSpan - thumbLen
      const maxScrollX = Math.max(0, contentWidth - viewportContentWidth)
      const frac = maxScrollX > 0 ? sX / maxScrollX : 0
      const thumbLeft = x + Math.floor(maxThumbLeft * frac)
      hThumb = { x: thumbLeft, y, w: thumbLen, h }
    }

    this.lastScrollbars = { vTrack, vThumb, hTrack, hThumb }

    const rc = {
      canvas: this.canvas,
      ctx: this.ctx,
      dpr: this.dpr,
      viewport,
      originX,
      originY,
      scroll: { x: sX, y: sY },
      sheet,
      visible,
      defaultRowHeight: this.opts.defaultRowHeight,
      defaultColWidth: this.opts.defaultColWidth,
      selection: this.selection,
      contentWidth,
      contentHeight,
      viewportContentWidth,
      viewportContentHeight,
      scrollbar: {
        thickness,
        minThumbSize: minThumb,
        vTrack,
        vThumb,
        hTrack,
        hThumb,
      },
    }

    // Render layers in order
    for (const l of this.layers) l.render(rc as any)
  }

  setSelection(sel?: { r0: number; c0: number; r1: number; c1: number }) {
    this.selection = sel
  }

  getScrollbars() {
    return this.lastScrollbars
  }
}
