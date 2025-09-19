import type { Context, State } from './types'
import { wrapTextIndices } from '@sheet/api'

export function createEditor(ctx: Context, state: State, deps: { schedule: () => void }) {
  let blinkTimer: number = 0
  let caretVisible = true

  function startBlink() {
    stopBlink()
    caretVisible = true
    blinkTimer = window.setInterval(() => {
      caretVisible = !caretVisible
      push()
    }, 500)
  }
  function stopBlink() {
    if (blinkTimer) { clearInterval(blinkTimer); blinkTimer = 0 }
  }

  function push() {
    const ed = state.editor
    if (!ed) { ctx.renderer.setEditor(undefined); deps.schedule(); return }
    ctx.renderer.setEditor({ r: ed.r, c: ed.c, text: ed.text, caret: ed.caret, caretVisible })
    deps.schedule()
  }

  function beginAt(r: number, c: number, opts?: { replaceWith?: string }) {
    const m = ctx.sheet.getMergeAt(r, c)
    const ar = m ? m.r : r
    const ac = m ? m.c : c
    const v = ctx.sheet.getValueAt(ar, ac)
    const base = typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : ''
    const text = opts?.replaceWith != null ? opts.replaceWith : base
    const caret = text.length
    state.editor = { r: ar, c: ac, text, caret, startText: base }
    startBlink()
    maybeAutoGrow()
    push()
  }

  function commit() {
    const ed = state.editor
    if (!ed) return
    ctx.sheet.setValue(ed.r, ed.c, ed.text)
    state.editor = undefined
    stopBlink()
    push()
  }

  function cancel() {
    state.editor = undefined
    stopBlink()
    push()
  }

  function moveCaret(delta: number) {
    const ed = state.editor; if (!ed) return
    ed.caret = Math.max(0, Math.min(ed.text.length, ed.caret + delta))
    push()
  }
  function setCaret(pos: number) {
    const ed = state.editor; if (!ed) return
    ed.caret = Math.max(0, Math.min(ed.text.length, pos))
    push()
  }
  function insertText(t: string) {
    const ed = state.editor; if (!ed) return
    const left = ed.text.substring(0, ed.caret)
    const right = ed.text.substring(ed.caret)
    ed.text = left + t + right
    ed.caret += t.length
    maybeAutoGrow()
    push()
  }
  function backspace() {
    const ed = state.editor; if (!ed) return
    if (ed.caret <= 0) return
    ed.text = ed.text.substring(0, ed.caret - 1) + ed.text.substring(ed.caret)
    ed.caret -= 1
    maybeAutoGrow()
    push()
  }
  function del() {
    const ed = state.editor; if (!ed) return
    if (ed.caret >= ed.text.length) return
    ed.text = ed.text.substring(0, ed.caret) + ed.text.substring(ed.caret + 1)
    maybeAutoGrow()
    push()
  }

  // Auto grow row height for wrapText cells while editing
  function maybeAutoGrow() {
    const ed = state.editor; if (!ed) return
    const style = ctx.sheet.getStyleAt(ed.r, ed.c)
    const wrap = !!style?.alignment?.wrapText
    if (!wrap) return
    // compute available width across merged span
    const m = ctx.sheet.getMergeAt(ed.r, ed.c)
    let width = ctx.sheet.colWidths.get(ed.c) ?? ctx.metrics.defaultColWidth
    if (m && m.r === ed.r && m.c === ed.c) {
      width = 0
      for (let cc = m.c; cc < m.c + m.cols; cc++) width += ctx.sheet.colWidths.get(cc) ?? ctx.metrics.defaultColWidth
    }
    const padding = 8
    const maxW = Math.max(0, width - padding)
    const size = style?.font?.size ?? 14
    const lineH = Math.max(12, Math.round(size * 1.25))
    const lines = wrapTextIndices(ed.text, maxW, style?.font, 14).length
    const needed = Math.max(24, 3 + lines * lineH + 3)
    const cur = ctx.sheet.rowHeights.get(ed.r) ?? ctx.metrics.defaultRowHeight
    if (needed > cur) {
      ctx.sheet.setRowHeight(ed.r, needed)
    }
  }

  return { beginAt, commit, cancel, moveCaret, setCaret, insertText, backspace, del, stopBlink }
}
