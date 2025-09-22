import type { Context, State } from '../types'
import { wrapTextIndices } from '@sheet/api'
import { createCaretBlinker } from './blink'
import { computeImeGeometry, placeImeHost } from './ime-position'
import { createTextOps } from './text-ops'
import { createImeHost } from './ime-host'

export function createEditor(
  ctx: Context,
  state: State,
  deps: {
    schedule: () => void
    onEditorUpdate?: (e: {
      r: number
      c: number
      text: string
      caret: number
      selAll?: boolean
    }) => void
    ensureVisible?: (r: number, c: number, mode: 'center' | 'nearest') => void
  },
) {
  const blinker = createCaretBlinker(() => push())
  // IME overlay state (moved into ime-host)
  // IME preview target when not editing
  let imePreview: { r: number; c: number; caret: number } | null = null

  const ime = createImeHost(ctx, state, {
    beginAt: (r, c) => beginAt(r, c),
    insertText: (t) => ops.insertText(t),
    backspace: () => ops.backspace(),
    del: () => ops.del(),
    afterChange: () => {
      ops.maybeAutoGrow()
      push()
      updateImePosition()
    },
  })

  function showIme() {
    ime.show()
    updateImePosition()
  }
  function hideIme() {
    ime.hide()
  }

  function prepareImeAt(r: number, c: number) {
    // Resolve merge anchor
    const m0 = ctx.sheet.getMergeAt(r, c)
    const ar = m0 ? m0.r : r
    const ac = m0 ? m0.c : c
    const v = ctx.sheet.getValueAt(ar, ac)
    const text = v == null ? '' : String(v)
    // caret at end of text by default
    imePreview = { r: ar, c: ac, caret: text.length }
    // Build linePrefix for visual alignment
    const style = ctx.sheet.getStyleAt(ar, ac)
    const wrap = !!style?.alignment?.wrapText
    let linePrefix = ''
    if (wrap) {
      // compute width across merge span
      let width = ctx.sheet.colWidths.get(ac) ?? ctx.metrics.defaultColWidth
      const m = ctx.sheet.getMergeAt(ar, ac)
      if (m && m.r === ar && m.c === ac) {
        width = 0
        for (let cc = m.c; cc < m.c + m.cols; cc++)
          width += ctx.sheet.colWidths.get(cc) ?? ctx.metrics.defaultColWidth
      }
      const padding = 8
      const maxW = Math.max(0, width - padding)
      const lines = wrapTextIndices(text, maxW, style?.font, 14)
      let lineIndex = 0
      for (let li = 0; li < lines.length; li++) {
        if (text.length <= lines[li].end) {
          lineIndex = li
          break
        }
        lineIndex = li
      }
      const seg = lines[Math.min(lineIndex, Math.max(0, lines.length - 1))]
      linePrefix = text.slice(seg.start, Math.min(seg.end, text.length))
    } else {
      linePrefix = text
    }
    const ta = ime.ensure()
    // mirror prefix and caret (do not focus to avoid unexpected activation)
    ta.value = linePrefix
    ta.selectionStart = ta.selectionEnd = linePrefix.length
    // keep host positioned for next input, but don't focus yet
    updateImePosition()
  }

  let imePosToken = 0
  async function updateImePosition() {
    // ensure host exists
    const ta = ime.ensure()
    const ed = state.editor
    // Choose source: editing state or prepared preview
    let src: { r: number; c: number; text: string; caret: number } | null = null
    if (ed) {
      src = { r: ed.r, c: ed.c, text: ed.text, caret: ed.caret }
    } else if (imePreview) {
      const m0 = ctx.sheet.getMergeAt(imePreview.r, imePreview.c)
      const ar0 = m0 ? m0.r : imePreview.r
      const ac0 = m0 ? m0.c : imePreview.c
      const v0 = ctx.sheet.getValueAt(ar0, ac0)
      const t0 = v0 == null ? '' : String(v0)
      src = { r: ar0, c: ac0, text: t0, caret: Math.max(0, Math.min(t0.length, imePreview.caret)) }
    }
    if (!src) {
      hideIme()
      return
    }
    const myTok = ++imePosToken
    const geom = await computeImeGeometry(ctx, state, src)
    if (myTok !== imePosToken) return
    placeImeHost(ctx, ta, geom)
  }

  // Keep non-editing overlay + IME host in sync with current selection
  function syncSelectionPreview() {
    if (state.editor) {
      updateImePosition()
      return
    }
    const sel = state.selection
    if (!sel) {
      ctx.renderer.setEditor(undefined)
      return
    }
    // Prefer the actual selection anchor (start of drag); fallback to top-left
    let r = state.selectAnchor?.r ?? Math.min(sel.r0, sel.r1)
    let c = state.selectAnchor?.c ?? Math.min(sel.c0, sel.c1)
    const m = ctx.sheet.getMergeAt(r, c)
    if (m) {
      r = m.r
      c = m.c
    }
    const v = ctx.sheet.getValueAt(r, c)
    const text = v == null ? '' : String(v)
    // render non-active overlay (no caret blink)
    ctx.renderer.setEditor({ r, c, text, caret: text.length, caretVisible: false })
    // position IME host to this anchor without focusing
    imePreview = { r, c, caret: text.length }
    updateImePosition()
  }

  // Ensure IME host exists immediately to avoid first-key lag
  // Keep it focused so the first keystroke goes through IME beforeinput/composition pipeline
  ;(function initImeHost() {
    ime.show()
    hideIme()
  })()

  function focusIme() {
    ime.focus()
  }
  function stopBlink() {
    blinker.stop()
  }

  function push() {
    const ed = state.editor
    if (!ed) {
      ctx.renderer.setEditor(undefined)
      deps.schedule()
      return
    }
    const selStart = ed.selAll ? 0 : (ed.selStart ?? ed.caret)
    const selEnd = ed.selAll ? ed.text.length : (ed.selEnd ?? ed.caret)
    ctx.renderer.setEditor({
      r: ed.r,
      c: ed.c,
      text: ed.text,
      caret: ed.caret,
      caretVisible: blinker.isVisible(),
      selAll: !!ed.selAll,
      selStart,
      selEnd,
    })
    deps.schedule()
    // notify listeners about live editor content
    deps.onEditorUpdate?.({ r: ed.r, c: ed.c, text: ed.text, caret: ed.caret, selAll: ed.selAll })
    updateImePosition()
  }

  function beginAt(r: number, c: number, opts?: { replaceWith?: string }) {
    const m = ctx.sheet.getMergeAt(r, c)
    const ar = m ? m.r : r
    const ac = m ? m.c : c
    const v = ctx.sheet.getValueAt(ar, ac)
    const base =
      typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : ''
    const text = opts?.replaceWith != null ? opts.replaceWith : base
    const caret = text.length
    state.editor = { r: ar, c: ac, text, caret, startText: base, selAll: false }
    imePreview = null
    blinker.start()
    ops.maybeAutoGrow()
    showIme()
    push()
  }

  function commit() {
    const ed = state.editor
    if (!ed) return
    ctx.sheet.setValue(ed.r, ed.c, ed.text)
    state.editor = undefined
    imePreview = null
    blinker.stop()
    hideIme()
    push()
  }

  function cancel() {
    state.editor = undefined
    imePreview = null
    blinker.stop()
    hideIme()
    push()
  }

  // Show a non-active editor overlay (no caret blink), without entering edit state
  function previewAt(r: number, c: number) {
    const m = ctx.sheet.getMergeAt(r, c)
    const ar = m ? m.r : r
    const ac = m ? m.c : c
    const v = ctx.sheet.getValueAt(ar, ac)
    const text = v == null ? '' : String(v)
    // Do not modify state.editor; just render overlay without caret
    ctx.renderer.setEditor({ r: ar, c: ac, text, caret: text.length, caretVisible: false })
    deps.schedule()
  }

  // Wire text operations
  const ops = createTextOps(ctx, state, { push })

  function dispose() {
    stopBlink()
    ime.dispose()
  }
  function isComposing() {
    return ime.isComposing()
  }
  function updateImeOverlay() {
    updateImePosition()
  }

  return {
    beginAt,
    commit,
    cancel,
    moveCaret: ops.moveCaret,
    setCaret: ops.setCaret,
    insertText: ops.insertText,
    backspace: ops.backspace,
    del: ops.del,
    stopBlink,
    previewAt,
    selectAll: ops.selectAll,
    dispose,
    isComposing,
    updateImeOverlay,
    focusIme,
    prepareImeAt,
    syncSelectionPreview,
    setSelectionRange: ops.setSelectionRange,
  }
}
