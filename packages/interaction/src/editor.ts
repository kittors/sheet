import type { Context, State } from './types'
import { wrapTextIndices } from '@sheet/api'

export function createEditor(
  ctx: Context,
  state: State,
  deps: {
    schedule: () => void
    onEditorUpdate?: (e: { r: number; c: number; text: string; caret: number; selAll?: boolean }) => void
    ensureVisible?: (r: number, c: number, mode: 'center' | 'nearest') => void
  },
) {
  let blinkTimer: number = 0
  let caretVisible = true
  // IME overlay state
  let imeEl: HTMLTextAreaElement | null = null
  let imeComposing = false
  let imeAnchor = 0
  let imePrev = ''
  // IME preview target when not editing
  let imePreview: { r: number; c: number; caret: number } | null = null

  function ensureImeEl() {
    if (imeEl) return imeEl
    const ta = document.createElement('textarea')
    ta.autocapitalize = 'off'
    ta.autocomplete = 'off'
    ta.spellcheck = false
    ta.setAttribute('data-sheet-ime', '1')
    // Use fixed positioning in viewport coordinates so placement is exact
    ta.style.position = 'fixed'
    ta.style.zIndex = '10'
    ta.style.opacity = '0'
    ta.style.border = '0'
    ta.style.background = 'transparent'
    ta.style.color = 'transparent'
    ta.style.resize = 'none'
    ta.style.padding = '0'
    ta.style.margin = '0'
    ta.style.outline = 'none'
    // Avoid user interactions; we programmatically manage focus
    ta.style.pointerEvents = 'none'
    // Minimal size; IME uses caret rect rather than element box
    ta.style.width = '2px'
    ta.style.height = '1.2em'
    ta.style.caretColor = 'transparent'
    ta.style.whiteSpace = 'pre'
    // Attach listeners
    ta.addEventListener('compositionstart', () => {
      // Ensure we're in editing state so composition updates have a target
      if (!state.editor) {
        const sel = state.selection
        if (sel) {
          const r = Math.min(sel.r0, sel.r1)
          const c = Math.min(sel.c0, sel.c1)
          beginAt(r, c)
        }
      }
      const ed = state.editor; if (!ed) return
      imeComposing = true
      imeAnchor = ed.selAll ? 0 : ed.caret
      if (ed.selAll) { ed.text = ''; ed.caret = 0; ed.selAll = false }
      imePrev = ''
      // Do not clear textarea here; it already mirrors linePrefix so IME anchors at the correct caret
    })
    ta.addEventListener('compositionupdate', (e) => {
      const ed = state.editor; if (!ed) return
      const t = (e as CompositionEvent).data ?? ''
      // replace previous composition run with new one
      const left = ed.text.substring(0, imeAnchor)
      const right = ed.text.substring(imeAnchor + imePrev.length)
      ed.text = left + t + right
      ed.caret = imeAnchor + t.length
      imePrev = t
      // Build a visual prefix for the current line so the IME caret within the host aligns with canvas caret
      const style = ctx.sheet.getStyleAt(ed.r, ed.c)
      const wrap = !!style?.alignment?.wrapText
      let linePrefix = ''
      if (wrap) {
        // compute current visual line segment
        // available width across merged span
        const m = ctx.sheet.getMergeAt(ed.r, ed.c)
        let width = ctx.sheet.colWidths.get(ed.c) ?? ctx.metrics.defaultColWidth
        if (m && m.r === ed.r && m.c === ed.c) {
          width = 0
          for (let cc = m.c; cc < m.c + m.cols; cc++) width += ctx.sheet.colWidths.get(cc) ?? ctx.metrics.defaultColWidth
        }
        const padding = 8
        const maxW = Math.max(0, width - padding)
        const lines = wrapTextIndices(ed.text, maxW, style?.font, 14)
        let lineIndex = 0
        for (let li = 0; li < lines.length; li++) { if (ed.caret <= lines[li].end) { lineIndex = li; break } lineIndex = li }
        const seg = lines[Math.min(lineIndex, Math.max(0, lines.length - 1))]
        linePrefix = ed.text.slice(seg.start, Math.min(seg.end, ed.caret))
      } else {
        linePrefix = ed.text.substring(0, ed.caret)
      }
      // mirror into textarea so IME candidate ties to correct caret (prefix + composing run)
      ta.value = linePrefix + t
      ta.selectionStart = ta.selectionEnd = (linePrefix.length + t.length)
      maybeAutoGrow()
      push()
      // keep overlay near caret
      updateImePosition()
    })
    ta.addEventListener('compositionend', (e) => {
      const ed = state.editor; if (!ed) return
      const t = (e as CompositionEvent).data ?? ''
      // finalize text (already applied in update); ensure caret is at end of composed run
      const left = ed.text.substring(0, imeAnchor)
      const right = ed.text.substring(imeAnchor + imePrev.length)
      ed.text = left + t + right
      ed.caret = imeAnchor + t.length
      imeComposing = false
      imePrev = ''
      // clear textarea value to avoid residual text on some browsers
      ta.value = ''
      maybeAutoGrow()
      push()
      updateImePosition()
    })
    // Handle non-IME typing via beforeinput so we don't need keydown for chars/backspace
    ta.addEventListener('beforeinput', (ev) => {
      const e = ev as InputEvent
      // Only auto-enter edit mode for real text insertion; ignore line breaks when not editing
      if (!state.editor) {
        if (e.inputType === 'insertText') {
          const sel = state.selection
          if (sel) {
            const r = Math.min(sel.r0, sel.r1)
            const c = Math.min(sel.c0, sel.c1)
            beginAt(r, c)
          }
        } else {
          return
        }
      }
      const ed = state.editor; if (!ed) return
      if (imeComposing) return
      const type = e.inputType
      if (type === 'insertText') {
        const data = e.data ?? ''
        if (data) insertText(data)
        e.preventDefault()
      } else if (type === 'insertLineBreak' || type === 'insertParagraph') {
        // Only handle line breaks while actively editing; otherwise let keyboard handler manage navigation
        insertText('\n')
        e.preventDefault()
      } else if (type === 'deleteContentBackward') {
        backspace()
        e.preventDefault()
      } else if (type === 'deleteContentForward') {
        del()
        e.preventDefault()
      }
    })
    imeEl = ta
    // mount to body so fixed coords align with viewport
    document.body.appendChild(ta)
    return ta
  }

  function showIme() {
    const ta = ensureImeEl()
    ta.style.display = 'block'
    try { ta.focus() } catch {}
    updateImePosition()
  }
  function hideIme() {
    if (!imeEl) return
    imeComposing = false
    imePrev = ''
    // Keep element present to avoid IME cold-start; move it off-screen instead of display:none
    imeEl.style.left = `-99999px`
    imeEl.style.top = `-99999px`
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
        for (let cc = m.c; cc < m.c + m.cols; cc++) width += ctx.sheet.colWidths.get(cc) ?? ctx.metrics.defaultColWidth
      }
      const padding = 8
      const maxW = Math.max(0, width - padding)
      const lines = wrapTextIndices(text, maxW, style?.font, 14)
      let lineIndex = 0
      for (let li = 0; li < lines.length; li++) { if (text.length <= lines[li].end) { lineIndex = li; break } lineIndex = li }
      const seg = lines[Math.min(lineIndex, Math.max(0, lines.length - 1))]
      linePrefix = text.slice(seg.start, Math.min(seg.end, text.length))
    } else {
      linePrefix = text
    }
    const ta = ensureImeEl()
    // mirror prefix and caret (do not focus to avoid unexpected activation)
    ta.value = linePrefix
    ta.selectionStart = ta.selectionEnd = linePrefix.length
    // keep host positioned for next input, but don't focus yet
    updateImePosition()
  }

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
  function updateImePosition() {
    if (!imeEl) return
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
    if (!src) { hideIme(); return }
    // compute cell rect in canvas coords
    const originX = ctx.metrics.headerColWidth
    const originY = ctx.metrics.headerRowHeight
    const x0 = originX + colLeft(src.c) - state.scroll.x
    const y0 = originY + rowTop(src.r) - state.scroll.y
    let w = ctx.sheet.colWidths.get(src.c) ?? ctx.metrics.defaultColWidth
    let h = ctx.sheet.rowHeights.get(src.r) ?? ctx.metrics.defaultRowHeight
    const m = ctx.sheet.getMergeAt(src.r, src.c)
    if (m && m.r === src.r && m.c === src.c) {
      w = 0; for (let cc = m.c; cc < m.c + m.cols; cc++) w += ctx.sheet.colWidths.get(cc) ?? ctx.metrics.defaultColWidth
      h = 0; for (let rr = m.r; rr < m.r + m.rows; rr++) h += ctx.sheet.rowHeights.get(rr) ?? ctx.metrics.defaultRowHeight
    }
    // compute caret offset
    const paddingX = 4
    const style = ctx.sheet.getStyleAt(src.r, src.c)
    const wrap = !!style?.alignment?.wrapText
    const sizePx = style?.font?.size ?? 14
    const lineH = Math.max(12, Math.round(sizePx * 1.25))
    let caretX = x0 + paddingX
    let caretY = y0 + (wrap ? 3 : Math.floor(h / 2))
    if (wrap) {
      const maxW = Math.max(0, w - 8)
      const lines = wrapTextIndices(src.text, maxW, style?.font, 14)
      let lineIndex = 0
      for (let li = 0; li < lines.length; li++) { if (src.caret <= lines[li].end) { lineIndex = li; break } lineIndex = li }
      const seg = lines[Math.min(lineIndex, Math.max(0, lines.length - 1))]
      const head = src.text.slice(seg.start, Math.min(seg.end, src.caret))
      // measure using canvas 2D since api provides measurement there as well
      const ctx2 = (ctx.renderer.ctx as CanvasRenderingContext2D)
      ctx2.save()
      // apply font
      if (style?.font) {
        const family = style.font.family ?? 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
        const weight = style.font.bold ? 'bold' : 'normal'
        const italic = style.font.italic ? 'italic ' : ''
        ctx2.font = `${italic}${weight} ${sizePx}px ${family}`
      } else {
        ctx2.font = `normal ${sizePx}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`
      }
      const advance = ctx2.measureText(head).width
      ctx2.restore()
      caretX = Math.floor(x0 + paddingX + advance)
      caretY = Math.floor(y0 + 3 + lineIndex * lineH)
      // Ensure host width matches wrapping width so platform wraps composition the same
      imeEl.style.width = `${Math.max(16, Math.floor(maxW))}px`
    } else {
      // single line
      const ctx2 = (ctx.renderer.ctx as CanvasRenderingContext2D)
      ctx2.save()
      if (style?.font) {
        const family = style.font.family ?? 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
        const weight = style.font.bold ? 'bold' : 'normal'
        const italic = style.font.italic ? 'italic ' : ''
        ctx2.font = `${italic}${weight} ${sizePx}px ${family}`
      } else {
        ctx2.font = `normal ${sizePx}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`
      }
      const head = src.text.substring(0, src.caret)
      const advance = ctx2.measureText(head).width
      ctx2.restore()
      caretX = Math.floor(x0 + paddingX + advance)
      caretY = Math.floor(y0 + (h - lineH) / 2)
      imeEl.style.width = `480px`
    }
    // Sync font metrics on IME host so platform positions candidate near our caret
    const fontFamily = style?.font?.family ?? 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
    const fontWeight = style?.font?.bold ? 'bold' : 'normal'
    const fontItalic = style?.font?.italic ? 'italic ' : ''
    imeEl.style.font = `${fontItalic}${fontWeight} ${sizePx}px ${fontFamily}`
    imeEl.style.lineHeight = `${lineH}px`
    // Place at viewport coordinates
    const rect = ctx.canvas.getBoundingClientRect()
    // If composing, caret inside host is at end of (linePrefix + composing run) we mirrored
    const left = rect.left + caretX
    // Position at caret baseline; adjust a bit so candidate appears just below caret
    const top = rect.top + caretY
    imeEl.style.left = `${Math.round(left)}px`
    imeEl.style.top = `${Math.round(top)}px`
    imeEl.style.height = `${lineH}px`
  }

  // Keep non-editing overlay + IME host in sync with current selection
  function syncSelectionPreview() {
    if (state.editor) { updateImePosition(); return }
    const sel = state.selection
    if (!sel) { ctx.renderer.setEditor(undefined); return }
    // anchor at top-left of selection, but if inside a merge, use its anchor
    let r = Math.min(sel.r0, sel.r1)
    let c = Math.min(sel.c0, sel.c1)
    const m = ctx.sheet.getMergeAt(r, c)
    if (m) { r = m.r; c = m.c }
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
    const ta = ensureImeEl()
    ta.style.display = 'block'
    try { ta.focus() } catch {}
    hideIme() // park offscreen until editing begins
  })()

  function focusIme() { const ta = ensureImeEl(); try { ta.focus() } catch {} }

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
    const selStart = ed.selAll ? 0 : (ed.selStart ?? ed.caret)
    const selEnd = ed.selAll ? ed.text.length : (ed.selEnd ?? ed.caret)
    ctx.renderer.setEditor({ r: ed.r, c: ed.c, text: ed.text, caret: ed.caret, caretVisible, selAll: !!ed.selAll, selStart, selEnd })
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
    const base = typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : ''
    const text = opts?.replaceWith != null ? opts.replaceWith : base
    const caret = text.length
    state.editor = { r: ar, c: ac, text, caret, startText: base, selAll: false }
    imePreview = null
    startBlink()
    maybeAutoGrow()
    showIme()
    push()
  }

  function commit() {
    const ed = state.editor
    if (!ed) return
    ctx.sheet.setValue(ed.r, ed.c, ed.text)
    state.editor = undefined
    imePreview = null
    stopBlink()
    hideIme()
    push()
  }

  function cancel() {
    state.editor = undefined
    imePreview = null
    stopBlink()
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

  function moveCaret(delta: number) {
    const ed = state.editor; if (!ed) return
    ed.caret = Math.max(0, Math.min(ed.text.length, ed.caret + delta))
    ed.selAll = false
    push()
  }
  function setCaret(pos: number) {
    const ed = state.editor; if (!ed) return
    ed.caret = Math.max(0, Math.min(ed.text.length, pos))
    ed.selAll = false
    ed.selStart = undefined
    ed.selEnd = undefined
    push()
  }
  function insertText(t: string) {
    const ed = state.editor; if (!ed) return
    const hasRange = (ed.selAll || (ed.selStart != null && ed.selEnd != null && ed.selStart !== ed.selEnd))
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
    push()
  }
  function backspace() {
    const ed = state.editor; if (!ed) return
    const hasRange = (ed.selAll || (ed.selStart != null && ed.selEnd != null && ed.selStart !== ed.selEnd))
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
    push()
  }
  function del() {
    const ed = state.editor; if (!ed) return
    const hasRange = (ed.selAll || (ed.selStart != null && ed.selEnd != null && ed.selStart !== ed.selEnd))
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
    push()
  }

  function selectAll() {
    const ed = state.editor; if (!ed) return
    ed.selAll = true
    ed.selStart = undefined
    ed.selEnd = undefined
    ed.caret = ed.text.length
    push()
  }

  function setSelectionRange(a: number, b: number) {
    const ed = state.editor; if (!ed) return
    const s = Math.max(0, Math.min(ed.text.length, Math.min(a, b)))
    const e = Math.max(0, Math.min(ed.text.length, Math.max(a, b)))
    ed.selAll = false
    ed.selStart = s
    ed.selEnd = e
    ed.caret = e
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

  function dispose() {
    stopBlink()
    if (imeEl && imeEl.parentElement) imeEl.parentElement.removeChild(imeEl)
    imeEl = null
    imeComposing = false
    imePrev = ''
  }
  function isComposing() { return imeComposing }
  function updateImeOverlay() { updateImePosition() }

  return { beginAt, commit, cancel, moveCaret, setCaret, insertText, backspace, del, stopBlink, previewAt, selectAll, dispose, isComposing, updateImeOverlay, focusIme, prepareImeAt, syncSelectionPreview, setSelectionRange }
}
