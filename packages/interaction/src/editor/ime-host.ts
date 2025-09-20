import type { Context, State } from '../types'
import { wrapTextIndices } from '@sheet/api'

export function createImeHost(
  ctx: Context,
  state: State,
  deps: {
    beginAt: (r: number, c: number) => void
    insertText: (t: string) => void
    backspace: () => void
    del: () => void
    afterChange: () => void // caller handles maybeAutoGrow + push + updateImePosition
  },
) {
  let imeEl: HTMLTextAreaElement | null = null
  let imeComposing = false
  let imeAnchor = 0
  let imePrev = ''

  function ensure() {
    if (imeEl) return imeEl
    const ta = document.createElement('textarea')
    ta.autocapitalize = 'off'
    ta.autocomplete = 'off'
    ta.spellcheck = false
    ta.setAttribute('data-sheet-ime', '1')
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
    ta.style.pointerEvents = 'none'
    ta.style.width = '2px'
    ta.style.height = '1.2em'
    ta.style.caretColor = 'transparent'
    ta.style.whiteSpace = 'pre'

    ta.addEventListener('compositionstart', () => {
      if (!state.editor) {
        const sel = state.selection
        if (sel) {
          // Use selection anchor if present; fallback to top-left of selection
          let r = state.selectAnchor?.r ?? Math.min(sel.r0, sel.r1)
          let c = state.selectAnchor?.c ?? Math.min(sel.c0, sel.c1)
          const m = ctx.sheet.getMergeAt(r, c)
          if (m) {
            r = m.r
            c = m.c
          }
          deps.beginAt(r, c)
        }
      }
      const ed = state.editor
      if (!ed) return
      imeComposing = true
      imeAnchor = ed.selAll ? 0 : ed.caret
      if (ed.selAll) {
        ed.text = ''
        ed.caret = 0
        ed.selAll = false
      }
      imePrev = ''
    })

    ta.addEventListener('compositionupdate', (e) => {
      const ed = state.editor
      if (!ed) return
      const t = (e as CompositionEvent).data ?? ''
      const left = ed.text.substring(0, imeAnchor)
      const right = ed.text.substring(imeAnchor + imePrev.length)
      ed.text = left + t + right
      ed.caret = imeAnchor + t.length
      imePrev = t
      const style = ctx.sheet.getStyleAt(ed.r, ed.c)
      const wrap = !!style?.alignment?.wrapText
      let linePrefix = ''
      if (wrap) {
        const m = ctx.sheet.getMergeAt(ed.r, ed.c)
        let width = ctx.sheet.colWidths.get(ed.c) ?? ctx.metrics.defaultColWidth
        if (m && m.r === ed.r && m.c === ed.c) {
          width = 0
          for (let cc = m.c; cc < m.c + m.cols; cc++)
            width += ctx.sheet.colWidths.get(cc) ?? ctx.metrics.defaultColWidth
        }
        const padding = 8
        const maxW = Math.max(0, width - padding)
        const lines = wrapTextIndices(ed.text, maxW, style?.font, 14)
        let lineIndex = 0
        for (let li = 0; li < lines.length; li++) {
          if (ed.caret <= lines[li].end) {
            lineIndex = li
            break
          }
          lineIndex = li
        }
        const seg = lines[Math.min(lineIndex, Math.max(0, lines.length - 1))]
        linePrefix = ed.text.slice(seg.start, Math.min(seg.end, ed.caret))
      } else {
        linePrefix = ed.text.substring(0, ed.caret)
      }
      ta.value = linePrefix + t
      ta.selectionStart = ta.selectionEnd = linePrefix.length + t.length
      deps.afterChange()
    })

    ta.addEventListener('compositionend', (e) => {
      const ed = state.editor
      if (!ed) return
      const t = (e as CompositionEvent).data ?? ''
      const left = ed.text.substring(0, imeAnchor)
      const right = ed.text.substring(imeAnchor + imePrev.length)
      ed.text = left + t + right
      ed.caret = imeAnchor + t.length
      imeComposing = false
      imePrev = ''
      ta.value = ''
      deps.afterChange()
    })

    ta.addEventListener('beforeinput', (ev) => {
      const e = ev as InputEvent
      if (!state.editor) {
        if (e.inputType === 'insertText') {
          const sel = state.selection
          if (sel) {
            // Use selection anchor if present; fallback to top-left of selection
            let r = state.selectAnchor?.r ?? Math.min(sel.r0, sel.r1)
            let c = state.selectAnchor?.c ?? Math.min(sel.c0, sel.c1)
            const m = ctx.sheet.getMergeAt(r, c)
            if (m) {
              r = m.r
              c = m.c
            }
            deps.beginAt(r, c)
          }
        } else {
          return
        }
      }
      const ed = state.editor
      if (!ed) return
      if (imeComposing) return
      const type = e.inputType
      if (type === 'insertText') {
        const data = e.data ?? ''
        if (data) deps.insertText(data)
        e.preventDefault()
      } else if (type === 'insertLineBreak' || type === 'insertParagraph') {
        deps.insertText('\n')
        e.preventDefault()
      } else if (type === 'deleteContentBackward') {
        deps.backspace()
        e.preventDefault()
      } else if (type === 'deleteContentForward') {
        deps.del()
        e.preventDefault()
      }
    })

    imeEl = ta
    document.body.appendChild(ta)
    return ta
  }

  function show() {
    const ta = ensure()
    ta.style.display = 'block'
    try {
      ta.focus()
    } catch (e) {
      void e
    }
  }
  function hide() {
    if (!imeEl) return
    imeComposing = false
    imePrev = ''
    imeEl.style.left = `-99999px`
    imeEl.style.top = `-99999px`
  }
  function focus() {
    const ta = ensure()
    try {
      ta.focus()
    } catch (e) {
      void e
    }
  }
  function isComposing() {
    return imeComposing
  }
  function dispose() {
    if (imeEl && imeEl.parentElement) imeEl.parentElement.removeChild(imeEl)
    imeEl = null
    imeComposing = false
    imePrev = ''
  }

  return { ensure, show, hide, focus, isComposing, dispose }
}
