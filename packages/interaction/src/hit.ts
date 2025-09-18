import type { Context, State } from './types'
import { computeAvailViewport } from './viewport'

export function posToCell(ctx: Context, state: State, clientX: number, clientY: number): { r: number; c: number } | null {
  const rect = ctx.canvas.getBoundingClientRect()
  const x = clientX - rect.left
  const y = clientY - rect.top
  const originX = ctx.metrics.headerColWidth
  const originY = ctx.metrics.headerRowHeight
  if (x < originX || y < originY) return null
  const sb = ctx.renderer.getScrollbars?.()
  if (sb) {
    const inV = sb.vTrack && x >= sb.vTrack.x && x <= sb.vTrack.x + sb.vTrack.w && y >= sb.vTrack.y && y <= sb.vTrack.y + sb.vTrack.h
    const inH = sb.hTrack && x >= sb.hTrack.x && x <= sb.hTrack.x + sb.hTrack.w && y >= sb.hTrack.y && y <= sb.hTrack.y + sb.hTrack.h
    if (inV || inH) return null
  }
  const { widthAvail: viewportContentWidth, heightAvail: viewportContentHeight, contentWidth, contentHeight } = computeAvailViewport(ctx)
  const maxX = Math.max(0, contentWidth - viewportContentWidth)
  const maxY = Math.max(0, contentHeight - viewportContentHeight)
  const sX = Math.max(0, Math.min(state.scroll.x, maxX))
  const sY = Math.max(0, Math.min(state.scroll.y, maxY))
  const cx = x - originX + sX
  const cy = y - originY + sY

  const cumWidth = (i: number): number => {
    let base = i * ctx.metrics.defaultColWidth
    if (ctx.sheet.colWidths.size) for (const [c, w] of ctx.sheet.colWidths) { if (c < i) base += (w - ctx.metrics.defaultColWidth) }
    return base
  }
  const cumHeight = (i: number): number => {
    let base = i * ctx.metrics.defaultRowHeight
    if (ctx.sheet.rowHeights.size) for (const [r, h] of ctx.sheet.rowHeights) { if (r < i) base += (h - ctx.metrics.defaultRowHeight) }
    return base
  }
  const findIndexByPos = (pos: number, count: number, cumFn: (i: number) => number): number => {
    const total = cumFn(count)
    const p = Math.max(0, Math.min(total - 1, pos))
    let lo = 0, hi = count
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      const start = cumFn(mid)
      const end = cumFn(mid + 1)
      if (p < start) hi = mid
      else if (p >= end) lo = mid + 1
      else return mid
    }
    return Math.min(count - 1, lo)
  }
  const col = findIndexByPos(cx, ctx.sheet.cols, cumWidth)
  const row = findIndexByPos(cy, ctx.sheet.rows, cumHeight)
  if (row >= ctx.sheet.rows || col >= ctx.sheet.cols) return null
  return { r: row, c: col }
}

export function colAtX(ctx: Context, state: State, xCanvas: number): number {
  const { widthAvail: viewportContentWidth, contentWidth } = computeAvailViewport(ctx)
  const maxX = Math.max(0, contentWidth - viewportContentWidth)
  const sX = Math.max(0, Math.min(state.scroll.x, maxX))
  const cx = xCanvas - ctx.metrics.headerColWidth + sX
  const cumWidth = (i: number): number => {
    let base = i * ctx.metrics.defaultColWidth
    if (ctx.sheet.colWidths.size) for (const [c, w] of ctx.sheet.colWidths) { if (c < i) base += (w - ctx.metrics.defaultColWidth) }
    return base
  }
  const findIndexByPos = (pos: number, count: number, cumFn: (i: number) => number): number => {
    const total = cumFn(count)
    const p = Math.max(0, Math.min(total - 1, pos))
    let lo = 0, hi = count
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      const start = cumFn(mid)
      const end = cumFn(mid + 1)
      if (p < start) hi = mid
      else if (p >= end) lo = mid + 1
      else return mid
    }
    return Math.min(count - 1, lo)
  }
  return findIndexByPos(cx, ctx.sheet.cols, cumWidth)
}

export function rowAtY(ctx: Context, state: State, yCanvas: number): number {
  const { heightAvail: viewportContentHeight, contentHeight } = computeAvailViewport(ctx)
  const maxY = Math.max(0, contentHeight - viewportContentHeight)
  const sY = Math.max(0, Math.min(state.scroll.y, maxY))
  const cy = yCanvas - ctx.metrics.headerRowHeight + sY
  const cumHeight = (i: number): number => {
    let base = i * ctx.metrics.defaultRowHeight
    if (ctx.sheet.rowHeights.size) for (const [r, h] of ctx.sheet.rowHeights) { if (r < i) base += (h - ctx.metrics.defaultRowHeight) }
    return base
  }
  const findIndexByPos = (pos: number, count: number, cumFn: (i: number) => number): number => {
    const total = cumFn(count)
    const p = Math.max(0, Math.min(total - 1, pos))
    let lo = 0, hi = count
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      const start = cumFn(mid)
      const end = cumFn(mid + 1)
      if (p < start) hi = mid
      else if (p >= end) lo = mid + 1
      else return mid
    }
    return Math.min(count - 1, lo)
  }
  return findIndexByPos(cy, ctx.sheet.rows, cumHeight)
}

