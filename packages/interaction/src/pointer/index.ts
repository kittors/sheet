import type { Context, State } from '../types'
import { colLeftFor, rowTopFor } from '@sheet/shared-utils'
import { createResizeHitters } from './resize'
import { createAutoScroll } from './autoscroll'
// computeAvailViewport used via scroll-utils
import { createTextSelectHandlers } from './textselect'
import { createScrollbarHandlers } from './scrollbar-handlers'
import { createSelectionHandlers } from './selection-handlers'
import { createCursorHandlers } from './cursor'
import { defaultPointerConfig, type PointerConfig } from './config'
import { getScrollClamped as getScrollClampedUtil } from './scroll-utils'

export function createPointerHandlers(
  ctx: Context,
  state: State,
  deps: {
    schedule: () => void
    finishEdit?: (mode: 'commit' | 'cancel') => void
    // Optional hooks to show a non-active editor overlay ("ready to edit") or clear it
    previewAt?: (r: number, c: number) => void
    clearPreview?: () => void
    // Optional: refocus IME host after pointer interactions so first key composes
    focusIme?: () => void
    // Optional: pre-position IME overlay at a target cell while not editing
    prepareImeAt?: (r: number, c: number) => void
    // Optional: set caret within current editor
    setCaret?: (pos: number) => void
    // Optional: set selection range within current editor
    setSelectionRange?: (a: number, b: number) => void
    // Optional: pointer configuration overrides
    config?: Partial<PointerConfig>
  },
) {
  const config: PointerConfig = {
    ...defaultPointerConfig,
    ...(deps.config ?? {}),
    resize: { ...defaultPointerConfig.resize, ...(deps.config?.resize ?? {}) },
  }

  const getScrollClamped = () => getScrollClampedUtil(ctx, state)

  // Resize hit-test helpers
  const { hitColResize, hitRowResize } = createResizeHitters(
    ctx,
    state,
    {
      getScrollClamped,
      colLeft: (index: number) =>
        colLeftFor(index, ctx.metrics.defaultColWidth, ctx.sheet.colWidths),
      rowTop: (index: number) =>
        rowTopFor(index, ctx.metrics.defaultRowHeight, ctx.sheet.rowHeights),
    },
    { hitMargin: config.resize.hitMargin },
  )
  // Auto-scroll logic extracted
  const { stopAutoScroll, updateAutoScrollVelocity } = createAutoScroll(ctx, state, {
    schedule: deps.schedule,
    config: config.autoScroll,
  })

  const textSel = createTextSelectHandlers(ctx, state, {
    setSelectionRange: deps.setSelectionRange,
    schedule: deps.schedule,
  })
  const sbHandlers = createScrollbarHandlers(ctx, state, {
    schedule: deps.schedule,
    focusIme: deps.focusIme,
  })
  const selHandlers = createSelectionHandlers(ctx, state, {
    schedule: deps.schedule,
    previewAt: deps.previewAt,
    prepareImeAt: deps.prepareImeAt,
    clearPreview: deps.clearPreview,
    updateAutoScrollVelocity,
  })

  async function onPointerDown(e: PointerEvent) {
    // 仅处理左键；右键（contextmenu）不改变选择状态，也不开始拖拽
    if (e.button !== 0) return
    try {
      ctx.canvas.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    // If clicking inside the active editor cell, move caret instead of committing
    if (state.editor) {
      if (await textSel.tryBeginFromPointer(e)) return
      deps.finishEdit?.('commit')
    }
    const rect = ctx.canvas.getBoundingClientRect()
    const xCss = e.clientX - rect.left
    const yCss = e.clientY - rect.top
    state.lastClientX = e.clientX
    state.lastClientY = e.clientY
    // Scrollbar tracks and thumbs
    if (sbHandlers.tryPointerDown(xCss, yCss)) return
    // Resize handles take priority over selection
    const colResizeIdx = hitColResize(xCss, yCss)
    if (colResizeIdx != null) {
      const w = ctx.sheet.colWidths.get(colResizeIdx) ?? ctx.metrics.defaultColWidth
      state.resize = { kind: 'col', index: colResizeIdx, startClient: e.clientX, startSize: w }
      state.dragMode = 'colresize'
      const { sX } = getScrollClamped()
      const z = (ctx.renderer as unknown as { getZoom?: () => number }).getZoom?.() ?? 1
      const left = colLeftFor(colResizeIdx, ctx.metrics.defaultColWidth, ctx.sheet.colWidths)
      const right = left + w
      const xCanvas = ctx.metrics.headerColWidth * z + right * z - sX
      ctx.renderer.setGuides?.({ v: xCanvas })
      ;(ctx.canvas.parentElement as HTMLElement).style.cursor = 'col-resize'
      deps.schedule()
      deps.focusIme?.()
      return
    }
    const rowResizeIdx = hitRowResize(xCss, yCss)
    if (rowResizeIdx != null) {
      const h = ctx.sheet.rowHeights.get(rowResizeIdx) ?? ctx.metrics.defaultRowHeight
      state.resize = { kind: 'row', index: rowResizeIdx, startClient: e.clientY, startSize: h }
      state.dragMode = 'rowresize'
      const { sY } = getScrollClamped()
      const z = (ctx.renderer as unknown as { getZoom?: () => number }).getZoom?.() ?? 1
      const top = rowTopFor(rowResizeIdx, ctx.metrics.defaultRowHeight, ctx.sheet.rowHeights)
      const bottom = top + h
      const yCanvas = ctx.metrics.headerRowHeight * z + bottom * z - sY
      ctx.renderer.setGuides?.({ h: yCanvas })
      ;(ctx.canvas.parentElement as HTMLElement).style.cursor = 'row-resize'
      deps.schedule()
      return
    }

    // Freeze handles from the corner (right/bottom edges)
    {
      const z = (ctx.renderer as unknown as { getZoom?: () => number }).getZoom?.() ?? 1
      const originX = ctx.metrics.headerColWidth * z
      const originY = ctx.metrics.headerRowHeight * z
      const grip = 6
      const nearRightEdge = xCss >= originX - grip && xCss <= originX + grip && yCss >= 0 && yCss <= originY
      const nearBottomEdge = yCss >= originY - grip && yCss <= originY + grip && xCss >= 0 && xCss <= originX
      if (nearRightEdge || nearBottomEdge) {
        if (nearRightEdge) {
          state.dragMode = 'freezecol'
          // Show guide at current pointer x snapped to nearest column boundary
          const rect2 = ctx.canvas.getBoundingClientRect()
          const xCanvas = e.clientX - rect2.left
          // Compute boundary x in canvas coords
          const { sX } = getScrollClamped()
          let acc = 0
          const totalCols = ctx.sheet.cols
          let boundary = 0
          for (let c = 0; c < totalCols; c++) {
            const w = ctx.sheet.colWidths.get(c) ?? ctx.metrics.defaultColWidth
            const left = acc * z
            const right = (acc + w) * z
            const pos = xCanvas - originX + sX
            if (pos < left) {
              boundary = c
              break
            }
            if (pos >= left && pos < right) {
              const mid = (left + right) / 2
              boundary = pos < mid ? c : c + 1
              break
            }
            acc += w
            if (c === totalCols - 1) boundary = totalCols
          }
          const boundaryX = originX + Math.max(0, Math.min(acc * z, acc * z)) // fallback
          // Precise boundaryX recompute from boundary
          let acc2 = 0
          for (let i = 0; i < boundary; i++) acc2 += ctx.sheet.colWidths.get(i) ?? ctx.metrics.defaultColWidth
          const xLine = ctx.metrics.headerColWidth * z + acc2 * z - sX
          ctx.renderer.setGuides?.({ v: xLine })
          deps.schedule()
          return
        }
        if (nearBottomEdge) {
          state.dragMode = 'freezerow'
          const rect2 = ctx.canvas.getBoundingClientRect()
          const yCanvas = e.clientY - rect2.top
          const { sY } = getScrollClamped()
          let acc = 0
          const totalRows = ctx.sheet.rows
          let boundary = 0
          for (let r = 0; r < totalRows; r++) {
            const h = ctx.sheet.rowHeights.get(r) ?? ctx.metrics.defaultRowHeight
            const top = acc * z
            const bot = (acc + h) * z
            const pos = yCanvas - originY + sY
            if (pos < top) {
              boundary = r
              break
            }
            if (pos >= top && pos < bot) {
              const mid = (top + bot) / 2
              boundary = pos < mid ? r : r + 1
              break
            }
            acc += h
            if (r === totalRows - 1) boundary = totalRows
          }
          let acc2 = 0
          for (let i = 0; i < boundary; i++) acc2 += ctx.sheet.rowHeights.get(i) ?? ctx.metrics.defaultRowHeight
          const yLine = ctx.metrics.headerRowHeight * z + acc2 * z - sY
          ctx.renderer.setGuides?.({ h: yLine })
          deps.schedule()
          return
        }
      }
    }

    // Selection/corner/header/default
    if (selHandlers.handlePointerDown(xCss, yCss, e.clientX, e.clientY)) return
  }

  const cursor = createCursorHandlers(
    ctx,
    state,
    { schedule: deps.schedule, hitColResize, hitRowResize },
    {
      names: {
        default: config.cursor.defaultCursor,
        pointer: config.cursor.pointerCursor,
        colResize: config.cursor.colResizeCursor,
        rowResize: config.cursor.rowResizeCursor,
      },
      hoverPointerOnScrollbar: config.cursor.hoverPointerOnScrollbar,
    },
  )

  async function onPointerMove(e: PointerEvent) {
    // Text selection while editing
    if (await textSel.handleMove(e)) return
    const rect = ctx.canvas.getBoundingClientRect()
    const xCss = e.clientX - rect.left
    const yCss = e.clientY - rect.top
    state.lastClientX = e.clientX
    state.lastClientY = e.clientY
    cursor.update(xCss, yCss)
    // Scrollbar dragging
    if (sbHandlers.handleMove(e, rect)) return
    // Freeze drag updates
    if (state.dragMode === 'freezecol') {
      const z = (ctx.renderer as unknown as { getZoom?: () => number }).getZoom?.() ?? 1
      const originX = ctx.metrics.headerColWidth * z
      const xCanvas = e.clientX - rect.left
      const { sX } = getScrollClamped()
      // Snap to nearest column boundary
      let acc = 0
      const pos = xCanvas - originX + sX
      let boundary = 0
      for (let c = 0; c < ctx.sheet.cols; c++) {
        const w = ctx.sheet.colWidths.get(c) ?? ctx.metrics.defaultColWidth
        const left = acc * z
        const right = (acc + w) * z
        if (pos < left) {
          boundary = c
          break
        }
        if (pos >= left && pos < right) {
          const mid = (left + right) / 2
          boundary = pos < mid ? c : c + 1
          break
        }
        acc += w
        if (c === ctx.sheet.cols - 1) boundary = ctx.sheet.cols
      }
      let acc2 = 0
      for (let i = 0; i < boundary; i++) acc2 += ctx.sheet.colWidths.get(i) ?? ctx.metrics.defaultColWidth
      const xLine = ctx.metrics.headerColWidth * z + acc2 * z - sX
      ctx.renderer.setGuides?.({ v: xLine })
      deps.schedule()
      return
    }
    if (state.dragMode === 'freezerow') {
      const z = (ctx.renderer as unknown as { getZoom?: () => number }).getZoom?.() ?? 1
      const originY = ctx.metrics.headerRowHeight * z
      const yCanvas = e.clientY - rect.top
      const { sY } = getScrollClamped()
      let acc = 0
      const pos = yCanvas - originY + sY
      let boundary = 0
      for (let r = 0; r < ctx.sheet.rows; r++) {
        const h = ctx.sheet.rowHeights.get(r) ?? ctx.metrics.defaultRowHeight
        const top = acc * z
        const bot = (acc + h) * z
        if (pos < top) {
          boundary = r
          break
        }
        if (pos >= top && pos < bot) {
          const mid = (top + bot) / 2
          boundary = pos < mid ? r : r + 1
          break
        }
        acc += h
        if (r === ctx.sheet.rows - 1) boundary = ctx.sheet.rows
      }
      let acc2 = 0
      for (let i = 0; i < boundary; i++) acc2 += ctx.sheet.rowHeights.get(i) ?? ctx.metrics.defaultRowHeight
      const yLine = ctx.metrics.headerRowHeight * z + acc2 * z - sY
      ctx.renderer.setGuides?.({ h: yLine })
      deps.schedule()
      return
    }
    if (state.dragMode === 'colresize' && state.resize) {
      const dx = e.clientX - state.resize.startClient
      const base = state.resize.startSize
      const next = Math.max(config.resize.minCol, Math.floor(base + dx))
      ctx.sheet.setColWidth(state.resize.index, next)
      const { sX } = getScrollClamped()
      const z = (ctx.renderer as unknown as { getZoom?: () => number }).getZoom?.() ?? 1
      const left = colLeftFor(state.resize.index, ctx.metrics.defaultColWidth, ctx.sheet.colWidths)
      const right = left + next
      const xCanvas = ctx.metrics.headerColWidth * z + right * z - sX
      ctx.renderer.setGuides?.({ v: xCanvas })
      deps.schedule()
      return
    }
    if (state.dragMode === 'rowresize' && state.resize) {
      const dy = e.clientY - state.resize.startClient
      const base = state.resize.startSize
      const next = Math.max(config.resize.minRow, Math.floor(base + dy))
      ctx.sheet.setRowHeight(state.resize.index, next)
      const { sY } = getScrollClamped()
      const z = (ctx.renderer as unknown as { getZoom?: () => number }).getZoom?.() ?? 1
      const top = rowTopFor(state.resize.index, ctx.metrics.defaultRowHeight, ctx.sheet.rowHeights)
      const bottom = top + next
      const yCanvas = ctx.metrics.headerRowHeight * z + bottom * z - sY
      ctx.renderer.setGuides?.({ h: yCanvas })
      deps.schedule()
      return
    }
    if (selHandlers.handlePointerMove(xCss, yCss, e)) return
  }

  function onPointerUp(e?: PointerEvent) {
    if (e) {
      try {
        ctx.canvas.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    if (state.dragMode === 'freezecol' || state.dragMode === 'freezerow') {
      // Commit freeze by snapping to nearest boundary
      const z = (ctx.renderer as unknown as { getZoom?: () => number }).getZoom?.() ?? 1
      const rect = ctx.canvas.getBoundingClientRect()
      const { sX, sY } = getScrollClamped()
      if (state.dragMode === 'freezecol') {
        const originX = ctx.metrics.headerColWidth * z
        const xCanvas = (state.lastClientX ?? rect.left) - rect.left
        const pos = xCanvas - originX + sX
        let acc = 0
        let boundary = 0
        for (let c = 0; c < ctx.sheet.cols; c++) {
          const w = ctx.sheet.colWidths.get(c) ?? ctx.metrics.defaultColWidth
          const left = acc * z
          const right = (acc + w) * z
          if (pos < left) { boundary = c; break }
          if (pos >= left && pos < right) { boundary = pos < (left + right) / 2 ? c : c + 1; break }
          acc += w
          if (c === ctx.sheet.cols - 1) boundary = ctx.sheet.cols
        }
        ctx.sheet.setFrozenCols(Math.max(0, Math.min(ctx.sheet.cols, boundary)))
      } else if (state.dragMode === 'freezerow') {
        const originY = ctx.metrics.headerRowHeight * z
        const yCanvas = (state.lastClientY ?? rect.top) - rect.top
        const pos = yCanvas - originY + sY
        let acc = 0
        let boundary = 0
        for (let r = 0; r < ctx.sheet.rows; r++) {
          const h = ctx.sheet.rowHeights.get(r) ?? ctx.metrics.defaultRowHeight
          const top = acc * z
          const bot = (acc + h) * z
          if (pos < top) { boundary = r; break }
          if (pos >= top && pos < bot) { boundary = pos < (top + bot) / 2 ? r : r + 1; break }
          acc += h
          if (r === ctx.sheet.rows - 1) boundary = ctx.sheet.rows
        }
        ctx.sheet.setFrozenRows(Math.max(0, Math.min(ctx.sheet.rows, boundary)))
      }
    }
    state.dragMode = 'none'
    state.resize = undefined
    ctx.renderer.setGuides?.(undefined)
    ctx.renderer.setScrollbarState?.({ vActive: false, hActive: false })
    // Stop any scrollbar arrow hold loop
    sbHandlers.stopArrowHold()
    deps.schedule()
    // After completing selection interaction, refocus IME host so the next key starts composition immediately
    deps.focusIme?.()
    stopAutoScroll()
    state.textSelectAnchor = undefined
  }

  function onPointerLeave() {
    ;(ctx.canvas.parentElement as HTMLElement).style.cursor = 'default'
    ctx.renderer.setScrollbarState?.({
      vHover: false,
      hHover: false,
      vActive: false,
      hActive: false,
    })
    ctx.renderer.setGuides?.(undefined)
    deps.schedule()
    // When dragging a selection, leaving the canvas bounds should NOT stop auto-scroll.
    // We keep auto-scroll active so the view can continue to pan while the pointer is outside.
    // Only stop auto-scroll if no drag is in progress.
    if (state.dragMode === 'none') {
      stopAutoScroll()
      state.textSelectAnchor = undefined
    }
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerLeave }
}
