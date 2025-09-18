import { computeVisibleRange, resizeCanvasForDPR, getDPR } from '@sheet/shared-utils'
import type { Sheet } from '@sheet/core'
import { BackgroundLayer } from './layers/background'
import { GridLayer } from './layers/grid'
import { ContentLayer } from './layers/content'
import { HeadersLayer } from './layers/headers'
import { SelectionLayer } from './layers/selection'
import { ScrollbarLayer } from './layers/scrollbar'
import { GuidesLayer } from './layers/guides'
import type { Layer, RenderContext } from './types/context'

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
  guides?: { v?: number; h?: number }
  lastScrollbars: {
    vTrack: { x: number; y: number; w: number; h: number } | null
    vThumb: { x: number; y: number; w: number; h: number } | null
    hTrack: { x: number; y: number; w: number; h: number } | null
    hThumb: { x: number; y: number; w: number; h: number } | null
  } = { vTrack: null, vThumb: null, hTrack: null, hThumb: null }
  scrollbarState = { vHover: false, hHover: false, vActive: false, hActive: false }

  constructor(canvas: HTMLCanvasElement, opts: RendererOptions = {}) {
    this.canvas = canvas
    this.dpr = getDPR()
    this.ctx = resizeCanvasForDPR(canvas, canvas.clientWidth, canvas.clientHeight, this.dpr)
    // Draw headers above content to avoid any overlap artifacts in top/right areas
    this.layers = [
      new BackgroundLayer(),
      new GridLayer(),
      new ContentLayer(),
      new SelectionLayer(),
      new HeadersLayer(),
      new GuidesLayer(),
      new ScrollbarLayer(),
    ]
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

    // Compute content size
    const contentWidth = sheet.cols * this.opts.defaultColWidth + Array.from(sheet.colWidths.values()).reduce((acc, w) => acc + (w - this.opts.defaultColWidth), 0)
    const contentHeight = sheet.rows * this.opts.defaultRowHeight + Array.from(sheet.rowHeights.values()).reduce((acc, h) => acc + (h - this.opts.defaultRowHeight), 0)

    // Decide whether scrollbars are needed and compute available content viewport (iterate to resolve interdependency)
    const thickness = this.opts.scrollbarThickness
    let vScrollable = contentHeight > viewportContentHeight + 0.5
    let hScrollable = contentWidth > viewportContentWidth + 0.5
    for (let i = 0; i < 2; i++) {
      const widthAvail = Math.max(0, viewportContentWidth - (vScrollable ? thickness : 0))
      const heightAvail = Math.max(0, viewportContentHeight - (hScrollable ? thickness : 0))
      vScrollable = contentHeight > heightAvail + 0.5
      hScrollable = contentWidth > widthAvail + 0.5
    }
    const widthAvail = Math.max(0, viewportContentWidth - (vScrollable ? thickness : 0))
    const heightAvail = Math.max(0, viewportContentHeight - (hScrollable ? thickness : 0))

    // Clamp scroll to available content viewport (prevents boundary drift)
    const maxScrollX = Math.max(0, contentWidth - widthAvail)
    const maxScrollY = Math.max(0, contentHeight - heightAvail)
    const sX = Math.max(0, Math.min(scrollX, maxScrollX))
    const sY = Math.max(0, Math.min(scrollY, maxScrollY))
    const visible = computeVisibleRange({
      scrollX: sX,
      scrollY: sY,
      viewportWidth: widthAvail,
      viewportHeight: heightAvail,
      colCount: sheet.cols,
      rowCount: sheet.rows,
      defaultColWidth: this.opts.defaultColWidth,
      defaultRowHeight: this.opts.defaultRowHeight,
      colWidths: sheet.colWidths,
      rowHeights: sheet.rowHeights,
      overscan: this.opts.overscan,
    })

    // Scrollbar geometry
    const minThumb = this.opts.scrollbarThumbMinSize

    // Vertical scrollbar visible only if content exceeds viewport
    let vTrack: { x: number; y: number; w: number; h: number } | null = null
    let vThumb: { x: number; y: number; w: number; h: number } | null = null
    if (vScrollable) {
      const x = viewport.width - thickness
      const y = originY
      const w = thickness
      // If horizontal bar also visible we keep room for corner
      const h = viewport.height - originY - (hScrollable ? thickness : 0)
      vTrack = { x, y, w, h }
      const trackSpan = h
      const thumbLen = Math.max(minThumb, Math.max(0, Math.floor(trackSpan * (heightAvail / contentHeight))))
      const maxThumbTop = trackSpan - thumbLen
      const maxScrollY = Math.max(0, contentHeight - heightAvail)
      const frac = maxScrollY > 0 ? sY / maxScrollY : 0
      const thumbTop = y + Math.floor(maxThumbTop * frac)
      vThumb = { x, y: thumbTop, w, h: thumbLen }
    }

    // Horizontal scrollbar
    let hTrack: { x: number; y: number; w: number; h: number } | null = null
    let hThumb: { x: number; y: number; w: number; h: number } | null = null
    if (hScrollable) {
      const x = originX
      const y = viewport.height - thickness
      // If vertical bar also visible we keep room for corner
      const w = viewport.width - originX - (vScrollable ? thickness : 0)
      const h = thickness
      hTrack = { x, y, w, h }
      const trackSpan = w
      const thumbLen = Math.max(minThumb, Math.max(0, Math.floor(trackSpan * (widthAvail / contentWidth))))
      const maxThumbLeft = trackSpan - thumbLen
      const maxScrollX = Math.max(0, contentWidth - widthAvail)
      const frac = maxScrollX > 0 ? sX / maxScrollX : 0
      const thumbLeft = x + Math.floor(maxThumbLeft * frac)
      hThumb = { x: thumbLeft, y, w: thumbLen, h }
    }

    this.lastScrollbars = { vTrack, vThumb, hTrack, hThumb }

    const rc: RenderContext = {
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
      viewportContentWidth: widthAvail,
      viewportContentHeight: heightAvail,
      scrollbar: {
        thickness,
        minThumbSize: minThumb,
        vTrack,
        vThumb,
        hTrack,
        hThumb,
      },
      scrollbarState: this.scrollbarState,
      guides: this.guides,
    }

    // Render layers in order
    for (const l of this.layers) l.render(rc)
  }

  setSelection(sel?: { r0: number; c0: number; r1: number; c1: number }) {
    this.selection = sel
  }

  setGuides(g?: { v?: number; h?: number }) {
    this.guides = g
  }

  getScrollbars() {
    return this.lastScrollbars
  }

  setScrollbarState(state: Partial<{ vHover: boolean; hHover: boolean; vActive: boolean; hActive: boolean }>) {
    this.scrollbarState = { ...this.scrollbarState, ...state }
  }
}
