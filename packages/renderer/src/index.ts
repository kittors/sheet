import { computeVisibleRange, resizeCanvasForDPR, getDPR } from '@sheet/shared-utils'
import type { Sheet } from '@sheet/core'
import { BackgroundLayer } from './layers/background'
import { ContentLayer } from './layers/content'
import { HeadersLayer } from './layers/headers'
import { SelectionLayer } from './layers/selection'
import { EditorLayer } from './layers/editor'
import { ScrollbarLayer } from './layers/scrollbar'
import { GuidesLayer } from './layers/guides'
import type { Layer, RenderContext } from './types/context'

export interface HeaderStyle {
  background: string
  textColor: string
  gridColor: string
  selectedBackground: string
  selectedGridColor?: string
}

export interface HeaderLabels {
  col?: (index: number) => string
  row?: (index: number) => string
}

export interface ViewportMetrics {
  widthAvail: number
  heightAvail: number
  contentWidth: number
  contentHeight: number
  maxScrollX: number
  maxScrollY: number
  viewportWidth: number
  viewportHeight: number
}

export interface RendererOptions {
  defaultRowHeight?: number
  defaultColWidth?: number
  overscan?: number
  headerRowHeight?: number
  headerColWidth?: number
  scrollbarThickness?: number
  scrollbarThumbMinSize?: number
  headerStyle?: Partial<HeaderStyle>
  headerLabels?: HeaderLabels
  // Optional: override device pixel ratio (for OffscreenCanvas workers)
  dpr?: number
  // When enabled, dynamically extend sheet.rows/cols near the scroll edge
  // so the grid behaves like it has no fixed size.
  infiniteScroll?: boolean
}

export class CanvasRenderer {
  canvas: HTMLCanvasElement | OffscreenCanvas
  ctx: CanvasRenderingContext2D
  dpr: number
  layers: Layer[]
  opts: RendererOptions
  selection?: { r0: number; c0: number; r1: number; c1: number }
  selectionAnchor?: { r: number; c: number }
  editor?: {
    r: number
    c: number
    text: string
    caret: number
    caretVisible: boolean
    selAll?: boolean
    selStart?: number
    selEnd?: number
  }
  guides?: { v?: number; h?: number }
  headerStyle: HeaderStyle
  headerLabels?: HeaderLabels
  lastScrollbars: {
    vTrack: { x: number; y: number; w: number; h: number } | null
    vThumb: { x: number; y: number; w: number; h: number } | null
    hTrack: { x: number; y: number; w: number; h: number } | null
    hThumb: { x: number; y: number; w: number; h: number } | null
    vArrowUp?: { x: number; y: number; w: number; h: number } | null
    vArrowDown?: { x: number; y: number; w: number; h: number } | null
    hArrowLeft?: { x: number; y: number; w: number; h: number } | null
    hArrowRight?: { x: number; y: number; w: number; h: number } | null
  } = { vTrack: null, vThumb: null, hTrack: null, hThumb: null, vArrowUp: null, vArrowDown: null, hArrowLeft: null, hArrowRight: null }
  scrollbarState = { vHover: false, hHover: false, vActive: false, hActive: false }
  private viewportMetrics: ViewportMetrics | null = null
  private lastRenderTs = 0
  private lastRenderScrollX = 0
  private lastRenderScrollY = 0
  private logicalW = 1
  private logicalH = 1
  // Keep fast-scrolling sticky for a short window to avoid per-frame toggling
  private fastUntilTs = 0
  // Weak cache for merge boundary blockers keyed by visible range + merges signature (capped size)
  private gridBlockersCache = new Map<string, { v: Map<number, Set<number>>; h: Map<number, Set<number>> }>()
  // Infinite-scroll: track dynamic explored content sizes used for scrollbar geometry
  private _expContentWidth: number | null = null
  private _expContentHeight: number | null = null
  private _baseContentWidth: number | null = null
  private _baseContentHeight: number | null = null

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, opts: RendererOptions = {}) {
    this.canvas = canvas
    this.dpr = opts.dpr ?? getDPR()
    const initW = (canvas as any).clientWidth != null ? (canvas as any).clientWidth : (canvas as any).width || 1
    const initH = (canvas as any).clientHeight != null ? (canvas as any).clientHeight : (canvas as any).height || 1
    this.ctx = resizeCanvasForDPR(canvas as any, initW, initH, this.dpr)
    this.logicalW = Math.max(1, Math.floor(initW))
    this.logicalH = Math.max(1, Math.floor(initH))
    // Draw headers above content to avoid any overlap artifacts in top/right areas
    this.layers = [
      new BackgroundLayer(),
      // Draw scrollbars early so they appear immediately on fast scroll; other layers clip away from tracks
      new ScrollbarLayer(),
      // Draw content backgrounds first, then internal grid (inside ContentLayer), then text and borders
      new ContentLayer(),
      // Keep editor visuals (text, caret, edit background) above content,
      // but ALWAYS draw the selection outline on top so it is never obscured while editing.
      // This fixes cases where the active editor background covered the selection border
      // (e.g. A8 with overflowing text and double-click edit).
      new EditorLayer(),
      new SelectionLayer(),
      new HeadersLayer(),
      new GuidesLayer(),
    ]
    this.opts = {
      defaultRowHeight: opts.defaultRowHeight ?? 24,
      defaultColWidth: opts.defaultColWidth ?? 100,
      overscan: opts.overscan ?? 1,
      headerRowHeight: opts.headerRowHeight ?? 28,
      headerColWidth: opts.headerColWidth ?? 48,
      // Make scrollbars thicker by default for better hit targets
      scrollbarThickness: opts.scrollbarThickness ?? 16,
      scrollbarThumbMinSize: opts.scrollbarThumbMinSize ?? 24,
      infiniteScroll: opts.infiniteScroll ?? false,
    }
    this.headerStyle = {
      background: opts.headerStyle?.background ?? '#f9fafb',
      textColor: opts.headerStyle?.textColor ?? '#374151',
      gridColor: opts.headerStyle?.gridColor ?? '#e5e7eb',
      selectedBackground: opts.headerStyle?.selectedBackground ?? '#d1d5db',
      selectedGridColor: opts.headerStyle?.selectedGridColor,
    }
    this.headerLabels = opts.headerLabels
  }

  getViewportMetrics(): ViewportMetrics | null {
    return this.viewportMetrics
  }

  resize(width: number, height: number) {
    this.ctx = resizeCanvasForDPR(this.canvas as any, width, height, this.dpr)
    this.logicalW = Math.max(1, Math.floor(width))
    this.logicalH = Math.max(1, Math.floor(height))
  }

  render(sheet: Sheet, scrollX: number, scrollY: number, mode: 'full' | 'ui' = 'full') {
    const viewport = { width: this.logicalW, height: this.logicalH }
    const originX = this.opts.headerColWidth!
    const originY = this.opts.headerRowHeight!
    const viewportContentWidth = Math.max(0, viewport.width - originX)
    const viewportContentHeight = Math.max(0, viewport.height - originY)

    // Compute raw content size from current sheet bounds
    let contentWidth =
      sheet.cols * this.opts.defaultColWidth! +
      Array.from(sheet.colWidths.values()).reduce(
        (acc, w) => acc + (w - this.opts.defaultColWidth!),
        0,
      )
    let contentHeight =
      sheet.rows * this.opts.defaultRowHeight! +
      Array.from(sheet.rowHeights.values()).reduce(
        (acc, h) => acc + (h - this.opts.defaultRowHeight!),
        0,
      )

    // Decide whether scrollbars are needed and compute available content viewport (iterate to resolve interdependency)
    const thickness = this.opts.scrollbarThickness!
    let vScrollable = contentHeight > viewportContentHeight + 0.5
    let hScrollable = contentWidth > viewportContentWidth + 0.5
    for (let i = 0; i < 2; i++) {
      const widthAvail = Math.max(0, viewportContentWidth - (vScrollable ? thickness : 0))
      const heightAvail = Math.max(0, viewportContentHeight - (hScrollable ? thickness : 0))
      vScrollable = contentHeight > heightAvail + 0.5
      hScrollable = contentWidth > widthAvail + 0.5
    }
    let widthAvail = Math.max(0, viewportContentWidth - (vScrollable ? thickness : 0))
    let heightAvail = Math.max(0, viewportContentHeight - (hScrollable ? thickness : 0))

    // Infinite mode: two layers
    // 1) Physically extend sheet bounds when near raw limits so渲染区域有内容；
    // 2) 为滚动条计算一个“可探索”的动态内容长度（可增可减），用于拇指大小与映射。
    if (this.opts.infiniteScroll) {
      // 1) Physical growth near raw edge
      const marginXGrow = Math.max(this.opts.defaultColWidth! * 3, Math.floor(widthAvail * 0.5))
      const marginYGrow = Math.max(this.opts.defaultRowHeight! * 6, Math.floor(heightAvail * 0.5))
      const maxScrollXPre = Math.max(0, contentWidth - widthAvail)
      const maxScrollYPre = Math.max(0, contentHeight - heightAvail)
      if (scrollX > maxScrollXPre - marginXGrow) {
        const neededWidth = scrollX + widthAvail + marginXGrow
        if (neededWidth > contentWidth) {
          const deltaW = neededWidth - contentWidth
          const addCols = Math.max(1, Math.ceil(deltaW / this.opts.defaultColWidth!))
          sheet.cols += addCols
          contentWidth += addCols * this.opts.defaultColWidth!
        }
      }
      if (scrollY > maxScrollYPre - marginYGrow) {
        const neededHeight = scrollY + heightAvail + marginYGrow
        if (neededHeight > contentHeight) {
          const deltaH = neededHeight - contentHeight
          const addRows = Math.max(1, Math.ceil(deltaH / this.opts.defaultRowHeight!))
          sheet.rows += addRows
          contentHeight += addRows * this.opts.defaultRowHeight!
        }
      }
      // After growth, recompute scrollability baseline
      vScrollable = contentHeight > viewportContentHeight + 0.5
      hScrollable = contentWidth > viewportContentWidth + 0.5
      widthAvail = Math.max(0, viewportContentWidth - (vScrollable ? thickness : 0))
      heightAvail = Math.max(0, viewportContentHeight - (hScrollable ? thickness : 0))

      // 2) Dynamic explored content used for scrollbar geometry (can grow and shrink).
      // Minimal bound based on actual used data/merges so滚动条不会小于“已使用”范围。
      const used = (sheet as any).getUsedExtents?.() as { rows: number; cols: number } | undefined
      const usedRows = Math.max(0, used?.rows ?? 0)
      const usedCols = Math.max(0, used?.cols ?? 0)
      const usedMinHeight = (() => {
        if (usedRows <= 0) return 0
        let base = usedRows * this.opts.defaultRowHeight!
        if (sheet.rowHeights.size)
          for (const [r, h] of sheet.rowHeights)
            if (r < usedRows) base += h - this.opts.defaultRowHeight!
        return base
      })()
      const usedMinWidth = (() => {
        if (usedCols <= 0) return 0
        let base = usedCols * this.opts.defaultColWidth!
        if (sheet.colWidths.size)
          for (const [c, w] of sheet.colWidths)
            if (c < usedCols) base += w - this.opts.defaultColWidth!
        return base
      })()
      // Remember initial content as another baseline to avoid over-shrinking on empty sheets
      if (this._baseContentWidth == null)
        this._baseContentWidth = Math.max(usedMinWidth, Math.max(1, viewportContentWidth))
      if (this._baseContentHeight == null)
        this._baseContentHeight = Math.max(usedMinHeight, Math.max(1, viewportContentHeight))
      const minW = Math.max(this._baseContentWidth, usedMinWidth)
      const minH = Math.max(this._baseContentHeight, usedMinHeight)
      // Compute exploration targets from current desired scroll and available viewport
      const marginX = Math.max(this.opts.defaultColWidth! * 2, Math.floor(widthAvail * 0.5))
      const marginY = Math.max(this.opts.defaultRowHeight! * 4, Math.floor(heightAvail * 0.5))
      const targetExpW = Math.max(minW, scrollX + widthAvail + marginX)
      const targetExpH = Math.max(minH, scrollY + heightAvail + marginY)
      // Apply immediately (no hysteresis) so回溯时滚动块可变大
      this._expContentWidth = targetExpW
      this._expContentHeight = targetExpH
      // After computing target explored sizes, recompute scrollbar visibility and available viewport
      const effW = this._expContentWidth ?? contentWidth
      const effH = this._expContentHeight ?? contentHeight
      let vScrollableEff = effH > viewportContentHeight + 0.5
      let hScrollableEff = effW > viewportContentWidth + 0.5
      for (let i = 0; i < 2; i++) {
        const nextWAvail = Math.max(0, viewportContentWidth - (vScrollableEff ? thickness : 0))
        const nextHAvail = Math.max(0, viewportContentHeight - (hScrollableEff ? thickness : 0))
        vScrollableEff = effH > nextHAvail + 0.5
        hScrollableEff = effW > nextWAvail + 0.5
      }
      widthAvail = Math.max(0, viewportContentWidth - (vScrollableEff ? thickness : 0))
      heightAvail = Math.max(0, viewportContentHeight - (hScrollableEff ? thickness : 0))
      vScrollable = vScrollableEff
      hScrollable = hScrollableEff
    } else {
      this._expContentWidth = null
      this._expContentHeight = null
      if (this._baseContentWidth == null) this._baseContentWidth = contentWidth
      if (this._baseContentHeight == null) this._baseContentHeight = contentHeight
    }

    // Clamp scroll to available content viewport (prevents boundary drift)
    const effContentWidth = this._expContentWidth ?? contentWidth
    const effContentHeight = this._expContentHeight ?? contentHeight
    const maxScrollX = Math.max(0, effContentWidth - widthAvail)
    const maxScrollY = Math.max(0, effContentHeight - heightAvail)
    const sX = Math.max(0, Math.min(scrollX, maxScrollX))
    const sY = Math.max(0, Math.min(scrollY, maxScrollY))

    this.viewportMetrics = {
      widthAvail,
      heightAvail,
      contentWidth: effContentWidth,
      contentHeight: effContentHeight,
      maxScrollX,
      maxScrollY,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
    }
    const visible = computeVisibleRange({
      scrollX: sX,
      scrollY: sY,
      viewportWidth: widthAvail,
      viewportHeight: heightAvail,
      colCount: sheet.cols,
      rowCount: sheet.rows,
      defaultColWidth: this.opts.defaultColWidth!,
      defaultRowHeight: this.opts.defaultRowHeight!,
      colWidths: sheet.colWidths,
      rowHeights: sheet.rowHeights,
      overscan: this.opts.overscan,
    })

    // Scrollbar geometry
    const minThumb = this.opts.scrollbarThumbMinSize!

    // Vertical scrollbar visible only if content exceeds viewport
    let vTrack: { x: number; y: number; w: number; h: number } | null = null
    let vThumb: { x: number; y: number; w: number; h: number } | null = null
    let vArrowUp: { x: number; y: number; w: number; h: number } | null = null
    let vArrowDown: { x: number; y: number; w: number; h: number } | null = null
    if (vScrollable) {
      const x = viewport.width - thickness
      const y = originY
      const w = thickness
      // If horizontal bar also visible we keep room for corner
      const hTotal = viewport.height - originY - (hScrollable ? thickness : 0)
      // Arrow buttons: square at both ends (cap around 1/3 of total span to avoid overlap)
      // Slightly larger arrow length to increase hit area
      const arrow = Math.min(Math.floor(thickness * 1.5), Math.max(0, Math.floor(hTotal / 3)))
      // Define arrow rects
      vArrowUp = { x, y, w, h: arrow }
      vArrowDown = { x, y: y + hTotal - arrow, w, h: arrow }
      // Thumb track excludes arrow areas
      const yTrack = y + arrow
      const h = Math.max(0, hTotal - arrow - arrow)
      vTrack = { x, y: yTrack, w, h }
      const trackSpan = h
      const thumbLen = Math.max(
        minThumb,
        Math.max(0, Math.floor(trackSpan * (heightAvail / effContentHeight))),
      )
      const maxThumbTop = trackSpan - thumbLen
      const maxScrollY = Math.max(0, effContentHeight - heightAvail)
      const frac = maxScrollY > 0 ? sY / maxScrollY : 0
      const thumbTop = yTrack + Math.floor(maxThumbTop * frac)
      // Make the thumb thinner than the track and center it horizontally
      const thumbThick = Math.max(4, Math.floor(w * 0.6))
      const thumbX = x + Math.floor((w - thumbThick) / 2)
      vThumb = { x: thumbX, y: thumbTop, w: thumbThick, h: thumbLen }
    }

    // Horizontal scrollbar
    let hTrack: { x: number; y: number; w: number; h: number } | null = null
    let hThumb: { x: number; y: number; w: number; h: number } | null = null
    let hArrowLeft: { x: number; y: number; w: number; h: number } | null = null
    let hArrowRight: { x: number; y: number; w: number; h: number } | null = null
    if (hScrollable) {
      const x = originX
      const y = viewport.height - thickness
      // If vertical bar also visible we keep room for corner
      const wTotal = viewport.width - originX - (vScrollable ? thickness : 0)
      const h = thickness
      // Arrow buttons on both sides
      const arrow = Math.min(Math.floor(thickness * 1.5), Math.max(0, Math.floor(wTotal / 3)))
      hArrowLeft = { x, y, w: arrow, h }
      hArrowRight = { x: x + wTotal - arrow, y, w: arrow, h }
      // Thumb track excludes arrows
      const xTrack = x + arrow
      const w = Math.max(0, wTotal - arrow - arrow)
      hTrack = { x: xTrack, y, w, h }
      const trackSpan = w
      const thumbLen = Math.max(
        minThumb,
        Math.max(0, Math.floor(trackSpan * (widthAvail / effContentWidth))),
      )
      const maxThumbLeft = trackSpan - thumbLen
      const maxScrollX = Math.max(0, effContentWidth - widthAvail)
      const frac = maxScrollX > 0 ? sX / maxScrollX : 0
      const thumbLeft = xTrack + Math.floor(maxThumbLeft * frac)
      // Make the thumb thinner than the track and center it vertically
      const thumbThick = Math.max(4, Math.floor(h * 0.6))
      const thumbY = y + Math.floor((h - thumbThick) / 2)
      hThumb = { x: thumbLeft, y: thumbY, w: thumbLen, h: thumbThick }
    }

    this.lastScrollbars = { vTrack, vThumb, hTrack, hThumb, vArrowUp, vArrowDown, hArrowLeft, hArrowRight }

    // Perf hint: treat as fast-scrolling if renders are close together and scroll moved noticeably
    const now = performance.now()
    const dt = this.lastRenderTs ? now - this.lastRenderTs : 999
    const dist = Math.abs(sX - this.lastRenderScrollX) + Math.abs(sY - this.lastRenderScrollY)
    const fastCandidate = dt < 80 && dist > 4
    if (fastCandidate) this.fastUntilTs = now + 120 // hold fast state for 120ms after last quick move
    const fast = now < this.fastUntilTs
    this.lastRenderTs = now
    this.lastRenderScrollX = sX
    this.lastRenderScrollY = sY

    // Compute merge boundary blockers with a small cache
    const blockersKey = (() => {
      // signature: visible + merges checksum (cheap)
      let sum = 0
      for (let i = 0; i < sheet.merges.length; i++) {
        const m = sheet.merges[i]
        sum = (sum + m.r * 7 + m.c * 13 + m.rows * 17 + m.cols * 19) | 0
      }
      return `${visible.rowStart},${visible.rowEnd},${visible.colStart},${visible.colEnd}:${sheet.merges.length}:${sum}`
    })()
    let gridBlockers = this.gridBlockersCache.get(blockersKey)
    if (!gridBlockers) {
      const v = new Map<number, Set<number>>()
      const h = new Map<number, Set<number>>()
      for (const m of sheet.merges) {
        if (m.rows === 1 && m.cols === 1) continue
        // vertical boundaries inside merge
        const vStart = Math.max(visible.rowStart, m.r)
        const vEnd = Math.min(visible.rowEnd, m.r + m.rows - 1)
        const bStart = Math.max(visible.colStart, m.c + 1)
        const bEnd = Math.min(visible.colEnd + 1, m.c + m.cols - 1)
        if (vStart <= vEnd && bStart <= bEnd) {
          for (let r2 = vStart; r2 <= vEnd; r2++) {
            let set = v.get(r2)
            if (!set) {
              set = new Set<number>()
              v.set(r2, set)
            }
            for (let b = bStart; b <= bEnd; b++) set.add(b)
          }
        }
        // horizontal boundaries inside merge
        const hStart = Math.max(visible.colStart, m.c)
        const hEnd = Math.min(visible.colEnd, m.c + m.cols - 1)
        const rbStart = Math.max(visible.rowStart, m.r + 1)
        const rbEnd = Math.min(visible.rowEnd + 1, m.r + m.rows - 1)
        if (hStart <= hEnd && rbStart <= rbEnd) {
          for (let c2 = hStart; c2 <= hEnd; c2++) {
            let set = h.get(c2)
            if (!set) {
              set = new Set<number>()
              h.set(c2, set)
            }
            for (let b = rbStart; b <= rbEnd; b++) set.add(b)
          }
        }
      }
      gridBlockers = { v, h }
      // Cap cache size to avoid growth
      if (this.gridBlockersCache.size >= 16) {
        const first = this.gridBlockersCache.keys().next().value
        if (first) this.gridBlockersCache.delete(first)
      }
      this.gridBlockersCache.set(blockersKey, gridBlockers)
    }

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
      defaultRowHeight: this.opts.defaultRowHeight!,
      defaultColWidth: this.opts.defaultColWidth!,
      selection: this.selection,
      selectionAnchor: this.selectionAnchor,
      contentWidth,
      contentHeight,
      viewportContentWidth: widthAvail,
      viewportContentHeight: heightAvail,
      gridBlockers,
      scrollbar: {
        thickness,
        minThumbSize: minThumb,
        vTrack,
        vThumb,
        hTrack,
        hThumb,
        vArrowUp,
        vArrowDown,
        hArrowLeft,
        hArrowRight,
      },
      scrollbarState: this.scrollbarState,
      guides: this.guides,
      headerStyle: this.headerStyle,
      headerLabels: this.headerLabels,
      perf: { fast },
      editor: this.editor,
    }

    if (mode === 'ui') {
      // UI-only: repaint headers and scrollbars quickly without touching heavy content
      for (const l of this.layers) {
        if (l.name === 'headers' || l.name === 'scrollbar') l.render(rc)
      }
      return
    }
    // Full render: all layers in order
    for (const l of this.layers) l.render(rc)
  }

  setSelection(
    sel?: { r0: number; c0: number; r1: number; c1: number },
    anchor?: { r: number; c: number },
  ) {
    this.selection = sel
    this.selectionAnchor = anchor
  }

  setGuides(g?: { v?: number; h?: number }) {
    this.guides = g
  }

  getScrollbars() {
    return this.lastScrollbars
  }

  setScrollbarState(
    state: Partial<{ vHover: boolean; hHover: boolean; vActive: boolean; hActive: boolean }>,
  ) {
    this.scrollbarState = { ...this.scrollbarState, ...state }
  }

  setHeaderStyle(style: Partial<HeaderStyle>) {
    this.headerStyle = { ...this.headerStyle, ...style }
  }

  setHeaderLabels(labels?: HeaderLabels) {
    this.headerLabels = labels
  }

  setEditor(editor?: {
    r: number
    c: number
    text: string
    caret: number
    caretVisible: boolean
    selAll?: boolean
    selStart?: number
    selEnd?: number
  }) {
    this.editor = editor
  }
}

// Worker proxy API
export { createWorkerRenderer, WorkerRenderer } from './worker/proxy'
