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
import { caretIndexFromPoint, fontStringFromStyle } from '@sheet/api'

export function attachSheetInteractions(args: AttachArgs): InteractionHandle {
  const ctx: Context = {
    canvas: args.canvas,
    renderer: args.renderer,
    sheet: args.sheet,
    metrics: {
      defaultColWidth: args.renderer.opts.defaultColWidth!,
      defaultRowHeight: args.renderer.opts.defaultRowHeight!,
      headerColWidth: args.renderer.opts.headerColWidth!,
      headerRowHeight: args.renderer.opts.headerRowHeight!,
      scrollbarThickness: args.renderer.opts.scrollbarThickness!,
    },
  }

  const state = createState()
  const { schedule: baseSchedule } = createRender(ctx, state)
  // editor change listeners
  const editorListeners: Array<(e: { editing: boolean; r: number; c: number; text: string; caret: number; selAll?: boolean }) => void> = []
  // Schedule proxy: also keeps IME overlay synced with caret/scroll
  let kb: ReturnType<typeof attachKeyboard> | null = null
  let lastProgScrollTs = 0
  let lastScrollX = state.scroll.x
  let lastScrollY = state.scroll.y
  function schedule() {
    baseSchedule()
    // Keep non-editing overlay + IME host synced to selection/editor state
    try { kb?.editor.syncSelectionPreview?.() } catch (e) { void e }
    // if user scrolled and editor exists but is off-screen, commit the edit
    const scChanged = (state.scroll.x !== lastScrollX) || (state.scroll.y !== lastScrollY)
    if (scChanged) {
      const now = performance.now()
      lastScrollX = state.scroll.x; lastScrollY = state.scroll.y
      if (kb?.editor && state.editor) {
        const r = state.editor.r, c = state.editor.c
        if (now - lastProgScrollTs > 120) {
          if (!isCellVisible(r, c)) {
            kb.editor.commit()
          }
        }
      }
    }
  }

  function normalizeScroll() {
    const { widthAvail, heightAvail, contentWidth, contentHeight } = computeAvailViewport(ctx)
    const maxX = Math.max(0, contentWidth - widthAvail)
    const maxY = Math.max(0, contentHeight - heightAvail)
    state.scroll.x = Math.max(0, Math.min(maxX, state.scroll.x))
    state.scroll.y = Math.max(0, Math.min(maxY, state.scroll.y))
  }

  const { onWheel } = createWheelHandler(ctx, state, { schedule, normalizeScroll })
  const { onPointerDown, onPointerMove, onPointerUp, onPointerLeave } = createPointerHandlers(ctx, state, {
    schedule,
    finishEdit: (mode) => {
      if (mode === 'commit') kb!.editor.commit(); else kb!.editor.cancel()
    },
    previewAt: (r, c) => { kb!.editor.previewAt(r, c) },
    clearPreview: () => { ctx.renderer.setEditor(undefined); schedule() },
    focusIme: () => { kb!.editor.focusIme?.() },
    prepareImeAt: (r, c) => { kb!.editor.prepareImeAt?.(r, c) },
    setCaret: (pos) => { kb!.editor.setCaret(pos) },
    setSelectionRange: (a, b) => { kb!.editor.setSelectionRange?.(a, b) },
  })
  kb = attachKeyboard(ctx, state, {
    schedule,
    ensureVisible: ensureCellVisible,
    onEditorUpdate: (e) => {
      for (const f of editorListeners) f({ editing: true, r: e.r, c: e.c, text: e.text, caret: e.caret, selAll: e.selAll })
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
  ctx.canvas.addEventListener('wheel', onWheel, { passive: false })
  ctx.canvas.addEventListener('dblclick', onDblClick)

  function colLeft(index: number): number {
    let base = index * ctx.metrics.defaultColWidth
    if (ctx.sheet.colWidths.size) for (const [c, w] of ctx.sheet.colWidths) { if (c < index) base += (w - ctx.metrics.defaultColWidth) }
    return base
  }
  function rowTop(index: number): number {
    let base = index * ctx.metrics.defaultRowHeight
    if (ctx.sheet.rowHeights.size) for (const [r, h] of ctx.sheet.rowHeights) { if (r < index) base += (h - ctx.metrics.defaultRowHeight) }
    return base
  }
  function cellSpanSize(r: number, c: number): { w: number; h: number } {
    let w = ctx.sheet.colWidths.get(c) ?? ctx.metrics.defaultColWidth
    let h = ctx.sheet.rowHeights.get(r) ?? ctx.metrics.defaultRowHeight
    const m = ctx.sheet.getMergeAt(r, c)
    if (m && m.r === r && m.c === c) {
      w = 0; for (let cc = m.c; cc < m.c + m.cols; cc++) w += ctx.sheet.colWidths.get(cc) ?? ctx.metrics.defaultColWidth
      h = 0; for (let rr = m.r; rr < m.r + m.rows; rr++) h += ctx.sheet.rowHeights.get(rr) ?? ctx.metrics.defaultRowHeight
    }
    return { w, h }
  }
  function ensureCellVisible(r: number, c: number, mode: 'center' | 'nearest' = 'nearest') {
    const { widthAvail, heightAvail, contentWidth, contentHeight } = computeAvailViewport(ctx)
    const { w, h } = cellSpanSize(r, c)
    const left = colLeft(c)
    const top = rowTop(r)
    const right = left + w
    const bottom = top + h
    let sX = state.scroll.x
    let sY = state.scroll.y
    if (mode === 'center') {
      sX = Math.max(0, Math.min(contentWidth - widthAvail, Math.floor(left + w / 2 - widthAvail / 2)))
      sY = Math.max(0, Math.min(contentHeight - heightAvail, Math.floor(top + h / 2 - heightAvail / 2)))
    } else {
      if (left < sX) sX = left
      else if (right > sX + widthAvail) sX = Math.max(0, right - widthAvail)
      if (top < sY) sY = top
      else if (bottom > sY + heightAvail) sY = Math.max(0, bottom - heightAvail)
    }
    if (sX !== state.scroll.x || sY !== state.scroll.y) {
      state.scroll.x = sX
      state.scroll.y = sY
      lastProgScrollTs = performance.now()
      baseSchedule()
    }
  }
  function isCellVisible(r: number, c: number): boolean {
    const { widthAvail, heightAvail } = computeAvailViewport(ctx)
    const { w, h } = cellSpanSize(r, c)
    const viewLeft = state.scroll.x
    const viewTop = state.scroll.y
    const viewRight = viewLeft + widthAvail
    const viewBottom = viewTop + heightAvail
    const left = colLeft(c)
    const top = rowTop(r)
    const right = left + w
    const bottom = top + h
    const hOverlap = !(right <= viewLeft || left >= viewRight)
    const vOverlap = !(bottom <= viewTop || top >= viewBottom)
    return hOverlap && vOverlap
  }
  function onDblClick(e: MouseEvent) {
    const cell = posToCell(ctx, state, e.clientX, e.clientY)
    if (!cell) return
    // resolve anchor if merged
    const m = ctx.sheet.getMergeAt(cell.r, cell.c)
    const ar = m ? m.r : cell.r
    const ac = m ? m.c : cell.c
    const style = ctx.sheet.getStyleAt(ar, ac)
    // compute cell rect in canvas coords
    const originX = ctx.metrics.headerColWidth
    const originY = ctx.metrics.headerRowHeight
    const x0 = originX + colLeft(ac) - state.scroll.x
    const y0 = originY + rowTop(ar) - state.scroll.y
    let w = ctx.sheet.colWidths.get(ac) ?? ctx.metrics.defaultColWidth
    if (m) {
      w = 0; for (let cc = m.c; cc < m.c + m.cols; cc++) w += ctx.sheet.colWidths.get(cc) ?? ctx.metrics.defaultColWidth
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
    // use same font as editor layer for measurement
    ctx.renderer.ctx.save()
    // Use shared API for text layout mapping
    const wrap = !!style?.alignment?.wrapText
    let caret = 0
    if (text) {
      if (wrap) {
        const maxW = Math.max(0, w - 8)
        const sizePx = style?.font?.size ?? 14
        const lineH = Math.max(12, Math.round(sizePx * 1.25))
        caret = caretIndexFromPoint(text, relX, relY, { maxWidth: maxW, font: style?.font, defaultSize: 14, lineHeight: lineH })
      } else {
        // map single line using shared measure
        const font = fontStringFromStyle(style?.font, 14)
        // get measuring context
        const ctx2 = (ctx.renderer.ctx as CanvasRenderingContext2D)
        ctx2.save()
        ctx2.font = font
        let acc = 0
        for (let i = 0; i < text.length; i++) {
          const wch = ctx2.measureText(text[i]).width
          if (acc + wch / 2 >= relX) { caret = i; break }
          acc += wch
          caret = i + 1
        }
        ctx2.restore()
      }
    }
    ctx.renderer.ctx.restore()
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
      ctx.canvas.removeEventListener('wheel', onWheel)
      ctx.canvas.removeEventListener('dblclick', onDblClick)
      kb.destroy()
      cancelAnimationFrame(state.raf)
    },
    ...cmds,
    onEditorChange(cb: (e: { editing: boolean; r: number; c: number; text: string; caret: number; selAll?: boolean }) => void) {
      editorListeners.push(cb)
      return () => { const i = editorListeners.indexOf(cb); if (i >= 0) editorListeners.splice(i, 1) }
    },
    getSelection() { return state.selection },
    getScroll() { return { ...state.scroll } },
    hitTest(clientX: number, clientY: number) {
      const rect = ctx.canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      const originX = ctx.metrics.headerColWidth
      const originY = ctx.metrics.headerRowHeight
      // 先排除滚动条
      const sb = ctx.renderer.getScrollbars?.()
      if (sb) {
        const inV = sb.vTrack && x >= sb.vTrack.x && x <= sb.vTrack.x + sb.vTrack.w && y >= sb.vTrack.y && y <= sb.vTrack.y + sb.vTrack.h
        const inH = sb.hTrack && x >= sb.hTrack.x && x <= sb.hTrack.x + sb.hTrack.w && y >= sb.hTrack.y && y <= sb.hTrack.y + sb.hTrack.h
        if (inV || inH) return { area: 'outside' as const }
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
