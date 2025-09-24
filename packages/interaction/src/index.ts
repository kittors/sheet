import type { AttachArgs, Context, InteractionHandle } from './types'
export type { InteractionHandle } from './types'
export type { CanvasRenderer } from '@sheet/renderer'
import { createState } from './state'
import { createRender } from './render'
import { computeAvailViewport } from './viewport'
import { createWheelHandler } from './wheel'
import { createPointerHandlers } from './pointer'
import { createCommands } from './commands'
import { attachKeyboard } from './keyboard'
import { posToCell } from './hit'
import { caretIndexFromPoint } from '@sheet/api'

export function attachSheetInteractions(args: AttachArgs): InteractionHandle {
  const ctx: Context = {
    canvas: args.canvas,
    renderer: args.renderer,
    sheet: args.sheet,
    infiniteScroll: args.infiniteScroll,
    metrics: {
      defaultColWidth: args.renderer.opts.defaultColWidth!,
      defaultRowHeight: args.renderer.opts.defaultRowHeight!,
      headerColWidth: args.renderer.opts.headerColWidth!,
      headerRowHeight: args.renderer.opts.headerRowHeight!,
      scrollbarThickness: args.renderer.opts.scrollbarThickness!,
      zoom: 1,
    },
  }

  const state = createState()
  const { schedule: baseSchedule, destroy: destroyRender } = createRender(ctx, state)
  // editor change listeners
  const editorListeners: Array<
    (e: {
      editing: boolean
      r: number
      c: number
      text: string
      caret: number
      selAll?: boolean
    }) => void
  > = []
  // Schedule proxy: also keeps IME overlay synced with caret/scroll
  let kb: ReturnType<typeof attachKeyboard> | null = null
  let lastProgScrollTs = 0
  let lastScrollX = state.scroll.x
  let lastScrollY = state.scroll.y
  // Optional native scroll host (smooth momentum). Default to the canvas parent if it looks like one
  const scrollHost: HTMLElement | null =
    args.scrollHost ?? (args.canvas.parentElement as HTMLElement | null)
  const usingNativeScroll = !!scrollHost && scrollHost.classList.contains('sheet-scroll-host')
  let isSyncingScrollHost = false
  function syncScrollHostFromState() {
    if (!usingNativeScroll || !scrollHost) return
    if (isSyncingScrollHost) return
    const x = Math.max(0, Math.floor(state.scroll.x))
    const y = Math.max(0, Math.floor(state.scroll.y))
    if (scrollHost.scrollLeft !== x || scrollHost.scrollTop !== y) {
      isSyncingScrollHost = true
      scrollHost.scrollLeft = x
      scrollHost.scrollTop = y
      // Release the re-entrancy guard in a microtask so rAF-driven updates
      // (auto-scroll) can reflect immediately on the next frame.
      Promise.resolve().then(() => {
        isSyncingScrollHost = false
      })
    }
  }

  function syncScrollHostSizeFromRenderer() {
    if (!usingNativeScroll || !scrollHost) return
    const m = ctx.renderer.getViewportMetrics?.()
    if (!m) return
    const thickness = ctx.metrics.scrollbarThickness
    const z = (ctx.renderer as unknown as { getZoom?: () => number }).getZoom?.() ?? 1
    const headerX = ctx.metrics.headerColWidth * z
    const headerY = ctx.metrics.headerRowHeight * z
    const vScrollable = m.contentHeight > m.heightAvail
    const hScrollable = m.contentWidth > m.widthAvail
    const w = headerX + m.contentWidth + (vScrollable ? thickness : 0)
    const h = headerY + m.contentHeight + (hScrollable ? thickness : 0)
    const spacer = scrollHost.querySelector('.sheet-scroll-spacer') as HTMLElement | null
    if (!spacer) return
    const curW = (spacer.style.width || '').endsWith('px') ? parseInt(spacer.style.width) : 0
    const curH = (spacer.style.height || '').endsWith('px') ? parseInt(spacer.style.height) : 0
    if (curW !== w) spacer.style.width = `${w}px`
    if (curH !== h) spacer.style.height = `${h}px`
  }

  function schedule() {
    baseSchedule()
    // Keep non-editing overlay + IME host synced to selection/editor state
    try {
      kb?.editor.syncSelectionPreview?.()
    } catch (e) {
      void e
    }
    // if user scrolled and editor exists but is off-screen, commit the edit
    const scChanged = state.scroll.x !== lastScrollX || state.scroll.y !== lastScrollY
    if (scChanged) {
      const now = performance.now()
      lastScrollX = state.scroll.x
      lastScrollY = state.scroll.y
      // reflect programmatic scroll changes back to host (e.g., keyboard, scrollbar drag)
      syncScrollHostFromState()
      // keep spacer size in sync too (e.g., after resize/row-col size change)
      syncScrollHostSizeFromRenderer()
      if (kb?.editor && state.editor) {
        const r = state.editor.r,
          c = state.editor.c
        if (now - lastProgScrollTs > 120) {
          if (!isCellVisible(r, c)) {
            kb.editor.commit()
          }
        }
      }
    }
  }

  function applyZoom(nextZoom: number) {
    const z = Math.max(0.05, nextZoom)
    ctx.renderer.setZoom?.(z)
    // No change in internal scroll units; renderer takes care of zoom scaling.
    syncScrollHostSizeFromRenderer()
    schedule()
  }

  function normalizeScroll(prevX: number, prevY: number) {
    // In infinite mode, give the renderer a chance to grow the sheet before clamping
    // so clamping reflects the expanded bounds.
    try {
      if (ctx.infiniteScroll)
        ctx.renderer.render(ctx.sheet, state.scroll.x, state.scroll.y, 'ui')
    } catch (e) {
      void e
    }
    const { widthAvail, heightAvail, contentWidth, contentHeight, maxScrollX, maxScrollY } =
      computeAvailViewport(ctx)
    const maxX = maxScrollX ?? Math.max(0, contentWidth - widthAvail)
    const maxY = maxScrollY ?? Math.max(0, contentHeight - heightAvail)
    const nextX = Math.max(0, Math.min(maxX, state.scroll.x))
    const nextY = Math.max(0, Math.min(maxY, state.scroll.y))
    const changed = nextX !== prevX || nextY !== prevY
    state.scroll.x = nextX
    state.scroll.y = nextY
    return changed
  }

  const { onWheel } = createWheelHandler(ctx, state, { schedule, normalizeScroll })
  const { onPointerDown, onPointerMove, onPointerUp, onPointerLeave } = createPointerHandlers(
    ctx,
    state,
    {
      schedule,
      finishEdit: (mode) => {
        if (mode === 'commit') kb!.editor.commit()
        else kb!.editor.cancel()
      },
      previewAt: (r, c) => {
        kb!.editor.previewAt(r, c)
      },
      clearPreview: () => {
        ctx.renderer.setEditor(undefined)
        schedule()
      },
      focusIme: () => {
        kb!.editor.focusIme?.()
      },
      prepareImeAt: (r, c) => {
        kb!.editor.prepareImeAt?.(r, c)
      },
      setCaret: (pos) => {
        kb!.editor.setCaret(pos)
      },
      setSelectionRange: (a, b) => {
        kb!.editor.setSelectionRange?.(a, b)
      },
    },
  )
  kb = attachKeyboard(ctx, state, {
    schedule,
    ensureVisible: ensureCellVisible,
    onEditorUpdate: (e) => {
      for (const f of editorListeners)
        f({ editing: true, r: e.r, c: e.c, text: e.text, caret: e.caret, selAll: e.selAll })
    },
  })

  // prevent browser defaults that interfere with pointer interactions
  ctx.canvas.style.touchAction = 'none'
  ctx.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  // wheel handler attached via addEventListener below (no onwheel fallback needed)
  schedule()
  window.addEventListener('resize', schedule)
  ctx.canvas.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  ctx.canvas.addEventListener('pointerleave', onPointerLeave)
  // When a native scroll host exists, use its 'scroll' events to drive rendering; otherwise, use wheel deltas
  let onScrollFn: ((e: Event) => void) | null = null
  if (usingNativeScroll && scrollHost) {
    onScrollFn = (e: Event) => {
      if (isSyncingScrollHost) return
      const el = e.target as HTMLElement
      const prevX = state.scroll.x
      const prevY = state.scroll.y
      // Pixel-align scroll to match scrollbar drag feel and eliminate subpixel jitter
      state.scroll.x = Math.max(0, Math.floor(el.scrollLeft))
      state.scroll.y = Math.max(0, Math.floor(el.scrollTop))
      // Clamp to bounds first
      normalizeScroll(prevX, prevY)
      // Queue the normal full render for the next frame (coalesced with other updates)
      schedule()
    }
    scrollHost.addEventListener('scroll', onScrollFn, { passive: true })
  } else {
    // Use a non-passive wheel listener so we can call preventDefault to block page scroll
    // while the pointer is over the canvas. The handler keeps work minimal and defers updates to RAF.
    ctx.canvas.addEventListener('wheel', onWheel, { passive: false })
  }
  ctx.canvas.addEventListener('dblclick', onDblClick)

  function colLeft(index: number): number {
    let base = index * ctx.metrics.defaultColWidth
    if (ctx.sheet.colWidths.size)
      for (const [c, w] of ctx.sheet.colWidths) {
        if (c < index) base += w - ctx.metrics.defaultColWidth
      }
    return base
  }
  function rowTop(index: number): number {
    let base = index * ctx.metrics.defaultRowHeight
    if (ctx.sheet.rowHeights.size)
      for (const [r, h] of ctx.sheet.rowHeights) {
        if (r < index) base += h - ctx.metrics.defaultRowHeight
      }
    return base
  }
  function cellSpanSize(r: number, c: number): { w: number; h: number } {
    let w = ctx.sheet.colWidths.get(c) ?? ctx.metrics.defaultColWidth
    let h = ctx.sheet.rowHeights.get(r) ?? ctx.metrics.defaultRowHeight
    const m = ctx.sheet.getMergeAt(r, c)
    if (m && m.r === r && m.c === c) {
      w = 0
      for (let cc = m.c; cc < m.c + m.cols; cc++)
        w += ctx.sheet.colWidths.get(cc) ?? ctx.metrics.defaultColWidth
      h = 0
      for (let rr = m.r; rr < m.r + m.rows; rr++)
        h += ctx.sheet.rowHeights.get(rr) ?? ctx.metrics.defaultRowHeight
    }
    return { w, h }
  }
  function ensureCellVisible(r: number, c: number, mode: 'center' | 'nearest' = 'nearest') {
    const z = (ctx.renderer as unknown as { getZoom?: () => number }).getZoom?.() ?? 1
    const { widthAvail, heightAvail, contentWidth, contentHeight } = computeAvailViewport(ctx)
    const { w, h } = cellSpanSize(r, c)
    const left = colLeft(c) * z
    const top = rowTop(r) * z
    const right = left + w * z
    const bottom = top + h * z
    let sX = state.scroll.x
    let sY = state.scroll.y
    const frozenCols = Math.max(0, Math.min(ctx.sheet.cols, ctx.sheet.frozenCols || 0))
    const frozenRows = Math.max(0, Math.min(ctx.sheet.rows, ctx.sheet.frozenRows || 0))
    // Pixel sizes of frozen areas
    let leftFrozenPx = 0
    for (let i = 0; i < frozenCols; i++) leftFrozenPx += (ctx.sheet.colWidths.get(i) ?? ctx.metrics.defaultColWidth) * z
    let topFrozenPx = 0
    for (let i = 0; i < frozenRows; i++) topFrozenPx += (ctx.sheet.rowHeights.get(i) ?? ctx.metrics.defaultRowHeight) * z
    const isFrozenCol = c < frozenCols
    const isFrozenRow = r < frozenRows
    if (mode === 'center') {
      if (!isFrozenCol)
        sX = Math.max(
          0,
          Math.min(contentWidth - widthAvail, Math.floor(left + w / 2 - widthAvail / 2)),
        )
      if (!isFrozenRow)
        sY = Math.max(
          0,
          Math.min(contentHeight - heightAvail, Math.floor(top + h / 2 - heightAvail / 2)),
        )
    } else {
      if (!isFrozenCol) {
        if (left < sX) sX = left
        else if (right > sX + widthAvail) sX = Math.max(0, right - widthAvail)
      }
      if (!isFrozenRow) {
        if (top < sY) sY = top
        else if (bottom > sY + heightAvail) sY = Math.max(0, bottom - heightAvail)
      }
    }
    if (sX !== state.scroll.x || sY !== state.scroll.y) {
      state.scroll.x = sX
      state.scroll.y = sY
      lastProgScrollTs = performance.now()
      // Use baseSchedule to render immediately, then sync host scroll to avoid loop
      baseSchedule()
      syncScrollHostFromState()
    }
  }
  function isCellVisible(r: number, c: number): boolean {
    const z = (ctx.renderer as unknown as { getZoom?: () => number }).getZoom?.() ?? 1
    const { widthAvail, heightAvail } = computeAvailViewport(ctx)
    const { w, h } = cellSpanSize(r, c)
    const viewLeft = state.scroll.x
    const viewTop = state.scroll.y
    const viewRight = viewLeft + widthAvail
    const viewBottom = viewTop + heightAvail
    const left = colLeft(c) * z
    const top = rowTop(r) * z
    const right = left + w * z
    const bottom = top + h * z
    const hOverlap = !(right <= viewLeft || left >= viewRight)
    const vOverlap = !(bottom <= viewTop || top >= viewBottom)
    return hOverlap && vOverlap
  }
  async function onDblClick(e: MouseEvent) {
    const cell = posToCell(ctx, state, e.clientX, e.clientY)
    if (!cell) return
    // resolve anchor if merged
    const m = ctx.sheet.getMergeAt(cell.r, cell.c)
    const ar = m ? m.r : cell.r
    const ac = m ? m.c : cell.c
    const style = ctx.sheet.getStyleAt(ar, ac)
    // compute cell rect in canvas coords
    const z = (ctx.renderer as unknown as { getZoom?: () => number }).getZoom?.() ?? 1
    const originX = ctx.metrics.headerColWidth * z
    const originY = ctx.metrics.headerRowHeight * z
    const x0 = originX + colLeft(ac) * z - state.scroll.x
    const y0 = originY + rowTop(ar) * z - state.scroll.y
    let w = (ctx.sheet.colWidths.get(ac) ?? ctx.metrics.defaultColWidth) * z
    if (m) {
      w = 0
      for (let cc = m.c; cc < m.c + m.cols; cc++)
        w += (ctx.sheet.colWidths.get(cc) ?? ctx.metrics.defaultColWidth) * z
    }
    // map click x to caret index
    const rect = ctx.canvas.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top
    const paddingX = 4
    const paddingY = 3
    const relX = Math.max(0, clickX - (x0 + paddingX))
    const relY = Math.max(0, clickY - (y0 + paddingY))
    const v = ctx.sheet.getValueAt(ar, ac)
    const text = v == null ? '' : String(v)
    // Use shared API for text layout mapping (no direct renderer ctx)
    const wrap = !!style?.alignment?.wrapText
    let caret = 0
    if (text) {
      // Some renderers (e.g. WorkerRenderer) expose an async caretIndexFromPoint API we can use.
      // Narrow the shape without using `any`.
      type CaretFromPoint = (
        text: string,
        relX: number,
        relY: number,
        opts: Parameters<typeof caretIndexFromPoint>[3],
      ) => Promise<number>
      const wr = ctx.renderer as unknown as { caretIndexFromPoint?: CaretFromPoint }
      if (wrap) {
        const maxW = Math.max(0, w - 8)
        const sizePx = (style?.font?.size ?? 14) * z
        const lineH = Math.max(12 * z, Math.round(sizePx * 1.25))
        const scaledFont = style?.font ? { ...style.font, size: (style.font.size ?? 14) * z } : undefined
        caret =
          (wr.caretIndexFromPoint
            ? await wr.caretIndexFromPoint(text, relX, relY, {
                maxWidth: maxW,
                font: scaledFont,
                defaultSize: 14 * z,
                lineHeight: lineH,
              })
            : caretIndexFromPoint(text, relX, relY, {
                maxWidth: maxW,
                font: scaledFont,
                defaultSize: 14 * z,
                lineHeight: lineH,
              })) ?? 0
      } else {
        const scaledFont = style?.font ? { ...style.font, size: (style.font.size ?? 14) * z } : undefined
        caret =
          (wr.caretIndexFromPoint
            ? await wr.caretIndexFromPoint(text, relX, 0, {
                maxWidth: 1e9,
                font: scaledFont,
                defaultSize: 14 * z,
                lineHeight: (style?.font?.size ?? 14) * z * 1.25,
              })
            : caretIndexFromPoint(text, relX, 0, {
                maxWidth: 1e9,
                font: scaledFont,
                defaultSize: 14 * z,
                lineHeight: (style?.font?.size ?? 14) * z * 1.25,
              })) ?? 0
      }
    }
    // begin editing and set caret at computed position (do not auto-scroll here to reduce disruption)
    kb!.editor.beginAt(ar, ac)
    kb!.editor.setCaret(caret)
  }

  const cmds = createCommands(ctx, state, { schedule })
  return {
    destroy() {
      window.removeEventListener('resize', schedule)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      ctx.canvas.removeEventListener('pointerleave', onPointerLeave)
      if (onScrollFn && usingNativeScroll && scrollHost)
        scrollHost.removeEventListener('scroll', onScrollFn)
      else ctx.canvas.removeEventListener('wheel', onWheel)
      ctx.canvas.removeEventListener('dblclick', onDblClick)
      kb.destroy()
      cancelAnimationFrame(state.raf)
      destroyRender?.()
    },
    getZoom() {
      return ctx.metrics.zoom ?? 1
    },
    setZoom(z: number) {
      applyZoom(z)
    },
    ...cmds,
    onEditorChange(
      cb: (e: {
        editing: boolean
        r: number
        c: number
        text: string
        caret: number
        selAll?: boolean
      }) => void,
    ) {
      editorListeners.push(cb)
      return () => {
        const i = editorListeners.indexOf(cb)
        if (i >= 0) editorListeners.splice(i, 1)
      }
    },
    getSelection() {
      return state.selection
    },
    getScroll() {
      return { ...state.scroll }
    },
    hitTest(clientX: number, clientY: number) {
      const rect = ctx.canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      const z = (ctx.renderer as unknown as { getZoom?: () => number }).getZoom?.() ?? 1
      const originX = ctx.metrics.headerColWidth * z
      const originY = ctx.metrics.headerRowHeight * z
      // 先排除滚动条
      const sb = ctx.renderer.getScrollbars?.()
      if (sb) {
        const inVTrack = !!(
          sb.vTrack && x >= sb.vTrack.x && x <= sb.vTrack.x + sb.vTrack.w && y >= sb.vTrack.y && y <= sb.vTrack.y + sb.vTrack.h
        )
        const inVThumb = !!(
          sb.vThumb && x >= sb.vThumb.x && x <= sb.vThumb.x + sb.vThumb.w && y >= sb.vThumb.y && y <= sb.vThumb.y + sb.vThumb.h
        )
        const inVArrow = !!(
          (sb.vArrowUp && x >= sb.vArrowUp.x && x <= sb.vArrowUp.x + sb.vArrowUp.w && y >= sb.vArrowUp.y && y <= sb.vArrowUp.y + sb.vArrowUp.h) ||
          (sb.vArrowDown && x >= sb.vArrowDown.x && x <= sb.vArrowDown.x + sb.vArrowDown.w && y >= sb.vArrowDown.y && y <= sb.vArrowDown.y + sb.vArrowDown.h)
        )
        const inHTrack = !!(
          sb.hTrack && x >= sb.hTrack.x && x <= sb.hTrack.x + sb.hTrack.w && y >= sb.hTrack.y && y <= sb.hTrack.y + sb.hTrack.h
        )
        const inHThumb = !!(
          sb.hThumb && x >= sb.hThumb.x && x <= sb.hThumb.x + sb.hThumb.w && y >= sb.hThumb.y && y <= sb.hThumb.y + sb.hThumb.h
        )
        const inHArrow = !!(
          (sb.hArrowLeft && x >= sb.hArrowLeft.x && x <= sb.hArrowLeft.x + sb.hArrowLeft.w && y >= sb.hArrowLeft.y && y <= sb.hArrowLeft.y + sb.hArrowLeft.h) ||
          (sb.hArrowRight && x >= sb.hArrowRight.x && x <= sb.hArrowRight.x + sb.hArrowRight.w && y >= sb.hArrowRight.y && y <= sb.hArrowRight.y + sb.hArrowRight.h)
        )
        if (inVTrack || inVThumb || inVArrow || inHTrack || inHThumb || inHArrow)
          return { area: 'outside' as const }
      }
      if (x < originX && y >= originY) return { area: 'rowHeader' }
      if (y < originY && x >= originX) return { area: 'colHeader' }
      if (x >= originX && y >= originY) {
        const cell = posToCell(ctx, state, clientX, clientY)
        if (cell) return { area: 'cell', cell }
      }
      return { area: 'outside' }
    },
  }
}
