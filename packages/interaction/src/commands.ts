import type { Context, State, InteractionHandle } from './types'

export function createCommands(
  ctx: Context,
  state: State,
  deps: { schedule: () => void },
): Omit<InteractionHandle, 'destroy' | 'hitTest'> {
  function forEachSelected(cb: (r: number, c: number) => void) {
    const sel = state.selection
    if (!sel) return
    const r0 = Math.max(0, Math.min(sel.r0, sel.r1))
    const r1 = Math.min(ctx.sheet.rows - 1, Math.max(sel.r0, sel.r1))
    const c0 = Math.max(0, Math.min(sel.c0, sel.c1))
    const c1 = Math.min(ctx.sheet.cols - 1, Math.max(sel.c0, sel.c1))
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) cb(r, c)
    }
  }

  function applyTextColor(color: string) {
    forEachSelected((r, c) => {
      const base = ctx.sheet.getStyleAt(r, c)
      const next = {
        font: { ...(base?.font ?? {}), color },
        fill: base?.fill,
        border: base?.border,
        alignment: base?.alignment,
      }
      const id = ctx.sheet.defineStyle(next as any)
      ctx.sheet.setCellStyle(r, c, id)
    })
    deps.schedule()
  }

  function applyFillColor(backgroundColor: string) {
    forEachSelected((r, c) => {
      const base = ctx.sheet.getStyleAt(r, c)
      const next = {
        font: base?.font,
        fill: { ...(base?.fill ?? {}), backgroundColor },
        border: base?.border,
        alignment: base?.alignment,
      }
      const id = ctx.sheet.defineStyle(next as any)
      ctx.sheet.setCellStyle(r, c, id)
    })
    deps.schedule()
  }

  function applyBorder(args: {
    mode: 'none' | 'all' | 'outside' | 'custom'
    color?: string
    width?: number
    style?: import('@sheet/core').BorderStyle
    sides?: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean }
  }) {
    const sel = state.selection
    if (!sel) return
    const r0 = Math.max(0, Math.min(sel.r0, sel.r1))
    const r1 = Math.min(ctx.sheet.rows - 1, Math.max(sel.r0, sel.r1))
    const c0 = Math.max(0, Math.min(sel.c0, sel.c1))
    const c1 = Math.min(ctx.sheet.cols - 1, Math.max(sel.c0, sel.c1))
    const color = args.color ?? '#374151'
    const width = Math.max(1, Math.floor(args.width ?? 1))
    const style = args.style ?? 'solid'

    if (args.mode === 'none') {
      forEachSelected((r, c) => {
        const base = ctx.sheet.getStyleAt(r, c)
        const next = { font: base?.font, fill: base?.fill, alignment: base?.alignment, border: {} }
        const id = ctx.sheet.defineStyle(next as any)
        ctx.sheet.setCellStyle(r, c, id)
      })
      deps.schedule()
      return
    }

    if (args.mode === 'all') {
      forEachSelected((r, c) => {
        const base = ctx.sheet.getStyleAt(r, c)
        const next = {
          font: base?.font,
          fill: base?.fill,
          alignment: base?.alignment,
          border: {
            top: { color, width, style },
            bottom: { color, width, style },
            left: { color, width, style },
            right: { color, width, style },
          },
        }
        const id = ctx.sheet.defineStyle(next as any)
        ctx.sheet.setCellStyle(r, c, id)
      })
      deps.schedule()
      return
    }

    if (args.mode === 'outside') {
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const base = ctx.sheet.getStyleAt(r, c)
          const top = r === r0 ? { color, width, style } : base?.border?.top
          const bottom = r === r1 ? { color, width, style } : base?.border?.bottom
          const left = c === c0 ? { color, width, style } : base?.border?.left
          const right = c === c1 ? { color, width, style } : base?.border?.right
          const next = { font: base?.font, fill: base?.fill, alignment: base?.alignment, border: { top, bottom, left, right } }
          const id = ctx.sheet.defineStyle(next as any)
          ctx.sheet.setCellStyle(r, c, id)
        }
      }
      deps.schedule()
      return
    }

    // custom mode
    const sides = args.sides ?? {}
    const top = sides.top ? { color, width, style } : undefined
    const bottom = sides.bottom ? { color, width, style } : undefined
    const left = sides.left ? { color, width, style } : undefined
    const right = sides.right ? { color, width, style } : undefined
    forEachSelected((r, c) => {
      const base = ctx.sheet.getStyleAt(r, c)
      const next = { font: base?.font, fill: base?.fill, alignment: base?.alignment, border: { top, bottom, left, right } }
      const id = ctx.sheet.defineStyle(next as any)
      ctx.sheet.setCellStyle(r, c, id)
    })
    deps.schedule()
  }

  function setValueInSelection(text: string) {
    forEachSelected((r, c) => ctx.sheet.setValue(r, c, text))
    deps.schedule()
  }

  function setColumnWidth(px: number) {
    const sel = state.selection
    if (!sel) return
    const c0 = Math.max(0, Math.min(sel.c0, sel.c1))
    const c1 = Math.min(ctx.sheet.cols - 1, Math.max(sel.c0, sel.c1))
    for (let c = c0; c <= c1; c++) ctx.sheet.setColWidth(c, Math.max(16, Math.floor(px)))
    deps.schedule()
  }

  function setRowHeight(px: number) {
    const sel = state.selection
    if (!sel) return
    const r0 = Math.max(0, Math.min(sel.r0, sel.r1))
    const r1 = Math.min(ctx.sheet.rows - 1, Math.max(sel.r0, sel.r1))
    for (let r = r0; r <= r1; r++) ctx.sheet.setRowHeight(r, Math.max(12, Math.floor(px)))
    deps.schedule()
  }

  function mergeSelection() {
    const sel = state.selection
    if (!sel) return
    const r0 = Math.max(0, Math.min(sel.r0, sel.r1))
    const r1 = Math.min(ctx.sheet.rows - 1, Math.max(sel.r0, sel.r1))
    const c0 = Math.max(0, Math.min(sel.c0, sel.c1))
    const c1 = Math.min(ctx.sheet.cols - 1, Math.max(sel.c0, sel.c1))
    const ok = ctx.sheet.addMerge(r0, c0, r1 - r0 + 1, c1 - c0 + 1)
    if (ok) deps.schedule()
  }

  function unmergeSelection() {
    const sel = state.selection
    if (!sel) return
    const r0 = Math.max(0, Math.min(sel.r0, sel.r1))
    const r1 = Math.min(ctx.sheet.rows - 1, Math.max(sel.r0, sel.r1))
    const c0 = Math.max(0, Math.min(sel.c0, sel.c1))
    const c1 = Math.min(ctx.sheet.cols - 1, Math.max(sel.c0, sel.c1))
    // collect merges that intersect selection
    const intersects = (m: { r: number; c: number; rows: number; cols: number }) => {
      const mr0 = m.r,
        mr1 = m.r + m.rows - 1
      const mc0 = m.c,
        mc1 = m.c + m.cols - 1
      return !(r1 < mr0 || mr1 < r0 || c1 < mc0 || mc1 < c0)
    }
    const targets = ctx.sheet.merges.filter(intersects)
    let any = false
    for (const m of targets) {
      if (ctx.sheet.removeMergeAt(m.r, m.c)) any = true
    }
    if (any) deps.schedule()
  }

  function getFirstSelectedCell(): { r: number; c: number } | null {
    const sel = state.selection
    if (!sel) return null
    const r = Math.min(sel.r0, sel.r1)
    const c = Math.min(sel.c0, sel.c1)
    return { r, c }
  }

  function getValueAt(r: number, c: number): string {
    const v = ctx.sheet.getValueAt(r, c)
    return v == null ? '' : String(v)
  }

  // queries required by InteractionHandle (created here for typing symmetry)
  function getSelection() {
    return state.selection
  }
  function getScroll() {
    return { ...state.scroll }
  }

  return {
    applyTextColor,
    applyFillColor,
    applyBorder,
    setValueInSelection,
    setColumnWidth,
    setRowHeight,
    mergeSelection,
    unmergeSelection,
    getFirstSelectedCell,
    getValueAt,
    getSelection,
    getScroll,
  }
}
