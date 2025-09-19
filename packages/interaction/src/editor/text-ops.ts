import type { Context, State } from '../types'
import { wrapTextIndices } from '@sheet/api'

export function createTextOps(ctx: Context, state: State, deps: { push: () => void }) {
  function maybeAutoGrow() {
    const ed = state.editor
    if (!ed) return
    const style = ctx.sheet.getStyleAt(ed.r, ed.c)
    const wrap = !!style?.alignment?.wrapText
    if (!wrap) return
    const m = ctx.sheet.getMergeAt(ed.r, ed.c)
    let width = ctx.sheet.colWidths.get(ed.c) ?? ctx.metrics.defaultColWidth
    if (m && m.r === ed.r && m.c === ed.c) {
      width = 0
      for (let cc = m.c; cc < m.c + m.cols; cc++)
        width += ctx.sheet.colWidths.get(cc) ?? ctx.metrics.defaultColWidth
    }
    const padding = 8
    const maxW = Math.max(0, width - padding)
    const size = style?.font?.size ?? 14
    const lineH = Math.max(12, Math.round(size * 1.25))
    const lines = wrapTextIndices(ed.text, maxW, style?.font, 14).length
    const needed = Math.max(24, 3 + lines * lineH + 3)
    const cur = ctx.sheet.rowHeights.get(ed.r) ?? ctx.metrics.defaultRowHeight
    if (needed > cur) ctx.sheet.setRowHeight(ed.r, needed)
  }

  function moveCaret(delta: number) {
    const ed = state.editor
    if (!ed) return
    ed.caret = Math.max(0, Math.min(ed.text.length, ed.caret + delta))
    ed.selAll = false
    deps.push()
  }
  function setCaret(pos: number) {
    const ed = state.editor
    if (!ed) return
    ed.caret = Math.max(0, Math.min(ed.text.length, pos))
    ed.selAll = false
    ed.selStart = undefined
    ed.selEnd = undefined
    deps.push()
  }
  function insertText(t: string) {
    const ed = state.editor
    if (!ed) return
    const hasRange =
      ed.selAll || (ed.selStart != null && ed.selEnd != null && ed.selStart !== ed.selEnd)
    const s = ed.selAll ? 0 : Math.min(ed.selStart ?? ed.caret, ed.selEnd ?? ed.caret)
    const e = ed.selAll ? ed.text.length : Math.max(ed.selStart ?? ed.caret, ed.selEnd ?? ed.caret)
    const left = ed.text.substring(0, hasRange ? s : ed.caret)
    const right = ed.text.substring(hasRange ? e : ed.caret)
    ed.text = left + t + right
    ed.caret = (left + t).length
    ed.selAll = false
    ed.selStart = undefined
    ed.selEnd = undefined
    maybeAutoGrow()
    deps.push()
  }
  function backspace() {
    const ed = state.editor
    if (!ed) return
    const hasRange =
      ed.selAll || (ed.selStart != null && ed.selEnd != null && ed.selStart !== ed.selEnd)
    if (hasRange) {
      const s = ed.selAll ? 0 : Math.min(ed.selStart!, ed.selEnd!)
      const e = ed.selAll ? ed.text.length : Math.max(ed.selStart!, ed.selEnd!)
      ed.text = ed.text.substring(0, s) + ed.text.substring(e)
      ed.caret = s
      ed.selAll = false
      ed.selStart = undefined
      ed.selEnd = undefined
    } else {
      if (ed.caret <= 0) return
      ed.text = ed.text.substring(0, ed.caret - 1) + ed.text.substring(ed.caret)
      ed.caret -= 1
    }
    maybeAutoGrow()
    deps.push()
  }
  function del() {
    const ed = state.editor
    if (!ed) return
    const hasRange =
      ed.selAll || (ed.selStart != null && ed.selEnd != null && ed.selStart !== ed.selEnd)
    if (hasRange) {
      const s = ed.selAll ? 0 : Math.min(ed.selStart!, ed.selEnd!)
      const e = ed.selAll ? ed.text.length : Math.max(ed.selStart!, ed.selEnd!)
      ed.text = ed.text.substring(0, s) + ed.text.substring(e)
      ed.caret = s
      ed.selAll = false
      ed.selStart = undefined
      ed.selEnd = undefined
    } else {
      if (ed.caret >= ed.text.length) return
      ed.text = ed.text.substring(0, ed.caret) + ed.text.substring(ed.caret + 1)
    }
    maybeAutoGrow()
    deps.push()
  }

  function selectAll() {
    const ed = state.editor
    if (!ed) return
    ed.selAll = true
    ed.selStart = undefined
    ed.selEnd = undefined
    ed.caret = ed.text.length
    deps.push()
  }

  function setSelectionRange(a: number, b: number) {
    const ed = state.editor
    if (!ed) return
    const s = Math.max(0, Math.min(ed.text.length, Math.min(a, b)))
    const e = Math.max(0, Math.min(ed.text.length, Math.max(a, b)))
    ed.selAll = false
    ed.selStart = s
    ed.selEnd = e
    ed.caret = e
    deps.push()
  }

  return {
    moveCaret,
    setCaret,
    insertText,
    backspace,
    del,
    selectAll,
    setSelectionRange,
    maybeAutoGrow,
  }
}
