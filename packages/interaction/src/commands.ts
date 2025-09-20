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
    const styleId = ctx.sheet.defineStyle({ font: { color } })
    forEachSelected((r, c) => ctx.sheet.setCellStyle(r, c, styleId))
    deps.schedule()
  }

  function applyFillColor(backgroundColor: string) {
    const styleId = ctx.sheet.defineStyle({ fill: { backgroundColor } })
    forEachSelected((r, c) => ctx.sheet.setCellStyle(r, c, styleId))
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
