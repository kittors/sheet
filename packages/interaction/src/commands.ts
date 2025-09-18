import type { Context, State, InteractionHandle } from './types'

export function createCommands(ctx: Context, state: State, deps: { schedule: () => void }): Omit<InteractionHandle, 'destroy'> {
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

  function getFirstSelectedCell(): { r: number; c: number } | null {
    const sel = state.selection
    if (!sel) return null
    const r = Math.min(sel.r0, sel.r1)
    const c = Math.min(sel.c0, sel.c1)
    return { r, c }
  }

  function getValueAt(r: number, c: number): string {
    const v = ctx.sheet.getCell(r, c)?.value
    return v == null ? '' : String(v)
  }

  return { applyTextColor, applyFillColor, setValueInSelection, getFirstSelectedCell, getValueAt }
}

