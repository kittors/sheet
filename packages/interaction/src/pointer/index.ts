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
  const { hitColResize, hitRowResize } = createResizeHitters(ctx, state, {
    getScrollClamped,
    colLeft: (index: number) => colLeftFor(index, ctx.metrics.defaultColWidth, ctx.sheet.colWidths),
    rowTop: (index: number) => rowTopFor(index, ctx.metrics.defaultRowHeight, ctx.sheet.rowHeights),
  }, { hitMargin: config.resize.hitMargin })
  // Auto-scroll logic extracted
  const { stopAutoScroll, updateAutoScrollVelocity } = createAutoScroll(ctx, state, { schedule: deps.schedule, config: config.autoScroll })

  const textSel = createTextSelectHandlers(ctx, state, { setSelectionRange: deps.setSelectionRange, schedule: deps.schedule })
  const sbHandlers = createScrollbarHandlers(ctx, state, { schedule: deps.schedule, focusIme: deps.focusIme })
  const selHandlers = createSelectionHandlers(ctx, state, { schedule: deps.schedule, previewAt: deps.previewAt, prepareImeAt: deps.prepareImeAt, clearPreview: deps.clearPreview, updateAutoScrollVelocity })

  function onPointerDown(e: PointerEvent) {
    // 仅处理左键；右键（contextmenu）不改变选择状态，也不开始拖拽
    if (e.button !== 0) return
    try { ctx.canvas.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    // If clicking inside the active editor cell, move caret instead of committing
    if (state.editor) { if (textSel.tryBeginFromPointer(e)) return; deps.finishEdit?.('commit') }
    const rect = ctx.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    state.lastClientX = e.clientX
    state.lastClientY = e.clientY
    // Scrollbar tracks and thumbs
    if (sbHandlers.tryPointerDown(x, y)) return
    // Resize handles take priority over selection
    const colResizeIdx = hitColResize(x, y)
    if (colResizeIdx != null) {
      const w = ctx.sheet.colWidths.get(colResizeIdx) ?? ctx.metrics.defaultColWidth
      state.resize = { kind: 'col', index: colResizeIdx, startClient: e.clientX, startSize: w }
      state.dragMode = 'colresize'
      const { sX } = getScrollClamped()
      const left = colLeftFor(colResizeIdx, ctx.metrics.defaultColWidth, ctx.sheet.colWidths)
      const right = left + w
      const xCanvas = ctx.metrics.headerColWidth + right - sX
      ctx.renderer.setGuides?.({ v: xCanvas })
      ;(ctx.canvas.parentElement as HTMLElement).style.cursor = 'col-resize'
      deps.schedule()
      deps.focusIme?.()
      return
    }
    const rowResizeIdx = hitRowResize(x, y)
    if (rowResizeIdx != null) {
      const h = ctx.sheet.rowHeights.get(rowResizeIdx) ?? ctx.metrics.defaultRowHeight
      state.resize = { kind: 'row', index: rowResizeIdx, startClient: e.clientY, startSize: h }
      state.dragMode = 'rowresize'
      const { sY } = getScrollClamped()
      const top = rowTopFor(rowResizeIdx, ctx.metrics.defaultRowHeight, ctx.sheet.rowHeights)
      const bottom = top + h
      const yCanvas = ctx.metrics.headerRowHeight + bottom - sY
      ctx.renderer.setGuides?.({ h: yCanvas })
      ;(ctx.canvas.parentElement as HTMLElement).style.cursor = 'row-resize'
      deps.schedule()
      return
    }

    // Selection/corner/header/default
    if (selHandlers.handlePointerDown(x, y, e.clientX, e.clientY)) return
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

  function onPointerMove(e: PointerEvent) {
    // Text selection while editing
    if (textSel.handleMove(e)) return
    const rect = ctx.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    state.lastClientX = e.clientX
    state.lastClientY = e.clientY
    cursor.update(x, y)
    // Scrollbar dragging
    if (sbHandlers.handleMove(e, rect)) return
    if (state.dragMode === 'colresize' && state.resize) {
      const dx = e.clientX - state.resize.startClient
      const base = state.resize.startSize
      const next = Math.max(config.resize.minCol, Math.floor(base + dx))
      ctx.sheet.setColWidth(state.resize.index, next)
      const { sX } = getScrollClamped()
      const left = colLeftFor(state.resize.index, ctx.metrics.defaultColWidth, ctx.sheet.colWidths)
      const right = left + next
      const xCanvas = ctx.metrics.headerColWidth + right - sX
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
      const top = rowTopFor(state.resize.index, ctx.metrics.defaultRowHeight, ctx.sheet.rowHeights)
      const bottom = top + next
      const yCanvas = ctx.metrics.headerRowHeight + bottom - sY
      ctx.renderer.setGuides?.({ h: yCanvas })
      deps.schedule()
      return
    }
    if (selHandlers.handlePointerMove(x, y, e)) return
  }

  function onPointerUp(e?: PointerEvent) {
    if (e) { try { ctx.canvas.releasePointerCapture(e.pointerId) } catch { /* ignore */ } }
    state.dragMode = 'none'
    state.resize = undefined
    ctx.renderer.setGuides?.(undefined)
    ctx.renderer.setScrollbarState?.({ vActive: false, hActive: false })
    deps.schedule()
    // After completing selection interaction, refocus IME host so the next key starts composition immediately
    deps.focusIme?.()
    stopAutoScroll()
    state.textSelectAnchor = undefined
  }

  function onPointerLeave() {
    ;(ctx.canvas.parentElement as HTMLElement).style.cursor = 'default'
    ctx.renderer.setScrollbarState?.({ vHover: false, hHover: false, vActive: false, hActive: false })
    ctx.renderer.setGuides?.(undefined)
    deps.schedule()
    stopAutoScroll()
    state.textSelectAnchor = undefined
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerLeave }
}
