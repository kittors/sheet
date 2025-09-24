import type { Context, State } from './types'
import { computeAvailViewport } from './viewport'

export function posToCell(
  ctx: Context,
  state: State,
  clientX: number,
  clientY: number,
): { r: number; c: number } | null {
  const rect = ctx.canvas.getBoundingClientRect()
  const z = (ctx.renderer as unknown as { getZoom?: () => number }).getZoom?.() ?? 1
  const x = clientX - rect.left
  const y = clientY - rect.top
  const originX = ctx.metrics.headerColWidth * z
  const originY = ctx.metrics.headerRowHeight * z
  if (x < originX || y < originY) return null
  const sb = ctx.renderer.getScrollbars?.()
  if (sb) {
    const inVTrack =
      !!sb.vTrack && x >= sb.vTrack.x && x <= sb.vTrack.x + sb.vTrack.w && y >= sb.vTrack.y && y <= sb.vTrack.y + sb.vTrack.h
    const inVThumb =
      !!sb.vThumb && x >= sb.vThumb.x && x <= sb.vThumb.x + sb.vThumb.w && y >= sb.vThumb.y && y <= sb.vThumb.y + sb.vThumb.h
    const inVArrow = !!(
      (sb.vArrowUp && x >= sb.vArrowUp.x && x <= sb.vArrowUp.x + sb.vArrowUp.w && y >= sb.vArrowUp.y && y <= sb.vArrowUp.y + sb.vArrowUp.h) ||
      (sb.vArrowDown && x >= sb.vArrowDown.x && x <= sb.vArrowDown.x + sb.vArrowDown.w && y >= sb.vArrowDown.y && y <= sb.vArrowDown.y + sb.vArrowDown.h)
    )
    const inHTrack =
      !!sb.hTrack && x >= sb.hTrack.x && x <= sb.hTrack.x + sb.hTrack.w && y >= sb.hTrack.y && y <= sb.hTrack.y + sb.hTrack.h
    const inHThumb =
      !!sb.hThumb && x >= sb.hThumb.x && x <= sb.hThumb.x + sb.hThumb.w && y >= sb.hThumb.y && y <= sb.hThumb.y + sb.hThumb.h
    const inHArrow = !!(
      (sb.hArrowLeft && x >= sb.hArrowLeft.x && x <= sb.hArrowLeft.x + sb.hArrowLeft.w && y >= sb.hArrowLeft.y && y <= sb.hArrowLeft.y + sb.hArrowLeft.h) ||
      (sb.hArrowRight && x >= sb.hArrowRight.x && x <= sb.hArrowRight.x + sb.hArrowRight.w && y >= sb.hArrowRight.y && y <= sb.hArrowRight.y + sb.hArrowRight.h)
    )
    if (inVTrack || inVThumb || inVArrow || inHTrack || inHThumb || inHArrow) return null
  }
  const {
    widthAvail: viewportContentWidth,
    heightAvail: viewportContentHeight,
    contentWidth,
    contentHeight,
  } = computeAvailViewport(ctx)
  const maxX = Math.max(0, contentWidth - viewportContentWidth)
  const maxY = Math.max(0, contentHeight - viewportContentHeight)
  const sX = Math.max(0, Math.min(state.scroll.x, maxX))
  const sY = Math.max(0, Math.min(state.scroll.y, maxY))
  // Adjust for frozen panes: map pointer to content coords within the appropriate pane
  let leftFrozenPx = 0
  for (let c = 0; c < (ctx.sheet.frozenCols || 0); c++)
    leftFrozenPx += (ctx.sheet.colWidths.get(c) ?? ctx.metrics.defaultColWidth) * z
  let topFrozenPx = 0
  for (let r = 0; r < (ctx.sheet.frozenRows || 0); r++)
    topFrozenPx += (ctx.sheet.rowHeights.get(r) ?? ctx.metrics.defaultRowHeight) * z
  let cx = 0
  let cy = 0
  const xRel = x - originX
  const yRel = y - originY
  if (xRel < leftFrozenPx) {
    cx = xRel // left frozen pane (no horizontal scroll)
  } else {
    cx = xRel - leftFrozenPx + sX
  }
  if (yRel < topFrozenPx) {
    cy = yRel // top frozen pane (no vertical scroll)
  } else {
    cy = yRel - topFrozenPx + sY
  }

  const cumWidth = (i: number): number => {
    let base = i * ctx.metrics.defaultColWidth * z
    if (ctx.sheet.colWidths.size)
      for (const [c, w] of ctx.sheet.colWidths) {
        if (c < i) base += (w - ctx.metrics.defaultColWidth) * z
      }
    return base
  }
  const cumHeight = (i: number): number => {
    let base = i * ctx.metrics.defaultRowHeight * z
    if (ctx.sheet.rowHeights.size)
      for (const [r, h] of ctx.sheet.rowHeights) {
        if (r < i) base += (h - ctx.metrics.defaultRowHeight) * z
      }
    return base
  }
  const findIndexByPos = (pos: number, count: number, cumFn: (i: number) => number): number => {
    const total = cumFn(count)
    const p = Math.max(0, Math.min(total - 1, pos))
    let lo = 0,
      hi = count
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
  // Return raw cell under pointer; callers decide how to handle merges
  return { r: row, c: col }
}

export function colAtX(ctx: Context, state: State, xCanvas: number): number {
  const z = (ctx.renderer as unknown as { getZoom?: () => number }).getZoom?.() ?? 1
  const { widthAvail: viewportContentWidth, contentWidth } = computeAvailViewport(ctx)
  const maxX = Math.max(0, contentWidth - viewportContentWidth)
  const sX = Math.max(0, Math.min(state.scroll.x, maxX))
  const cx = xCanvas - ctx.metrics.headerColWidth * z + sX
  const cumWidth = (i: number): number => {
    let base = i * ctx.metrics.defaultColWidth * z
    if (ctx.sheet.colWidths.size)
      for (const [c, w] of ctx.sheet.colWidths) {
        if (c < i) base += (w - ctx.metrics.defaultColWidth) * z
      }
    return base
  }
  const findIndexByPos = (pos: number, count: number, cumFn: (i: number) => number): number => {
    const total = cumFn(count)
    const p = Math.max(0, Math.min(total - 1, pos))
    let lo = 0,
      hi = count
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
  const z = (ctx.renderer as unknown as { getZoom?: () => number }).getZoom?.() ?? 1
  const { heightAvail: viewportContentHeight, contentHeight } = computeAvailViewport(ctx)
  const maxY = Math.max(0, contentHeight - viewportContentHeight)
  const sY = Math.max(0, Math.min(state.scroll.y, maxY))
  const cy = yCanvas - ctx.metrics.headerRowHeight * z + sY
  const cumHeight = (i: number): number => {
    let base = i * ctx.metrics.defaultRowHeight * z
    if (ctx.sheet.rowHeights.size)
      for (const [r, h] of ctx.sheet.rowHeights) {
        if (r < i) base += (h - ctx.metrics.defaultRowHeight) * z
      }
    return base
  }
  const findIndexByPos = (pos: number, count: number, cumFn: (i: number) => number): number => {
    const total = cumFn(count)
    const p = Math.max(0, Math.min(total - 1, pos))
    let lo = 0,
      hi = count
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
