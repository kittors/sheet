import type { Context, State } from './types'
import { createEditor } from './editor'

export function attachKeyboard(
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
  const ed = createEditor(ctx, state, deps)

  function getActiveCell(): { r: number; c: number } | null {
    const sel = state.selection
    if (!sel) return null
    // Prefer the actual selection anchor (start of drag); fallback to top-left of selection
    let r = state.selectAnchor?.r ?? Math.min(sel.r0, sel.r1)
    let c = state.selectAnchor?.c ?? Math.min(sel.c0, sel.c1)
    // If anchor lies in a merge, use merge anchor
    const m = ctx.sheet.getMergeAt(r, c)
    if (m) {
      r = m.r
      c = m.c
    }
    return { r, c }
  }

  function onKeyDown(e: KeyboardEvent) {
    const editing = !!state.editor
    const imeHasFocus =
      document.activeElement &&
      (document.activeElement as HTMLElement).getAttribute('data-sheet-ime') === '1'
    // Editing: handle Command/Ctrl + A (select all) before any early returns so IME state doesn't block it
    if (editing && (e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
      ed.selectAll()
      e.preventDefault()
      return
    }
    // Editing: handle Copy/Paste
    if (editing && (e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C')) {
      const edState = state.editor!
      const text = edState.text || ''
      const hasRange =
        edState.selAll ||
        (edState.selStart != null && edState.selEnd != null && edState.selStart !== edState.selEnd)
      const s = edState.selAll
        ? 0
        : Math.min(edState.selStart ?? edState.caret, edState.selEnd ?? edState.caret)
      const ee = edState.selAll
        ? text.length
        : Math.max(edState.selStart ?? edState.caret, edState.selEnd ?? edState.caret)
      const slice = hasRange ? text.slice(s, ee) : ''
      if (slice) {
        try {
          navigator.clipboard.writeText(slice)
        } catch (err) {
          void err
        }
      }
      e.preventDefault()
      return
    }
    if (editing && (e.metaKey || e.ctrlKey) && (e.key === 'v' || e.key === 'V')) {
      try {
        navigator.clipboard.readText().then((clip) => {
          if (clip) {
            ed.insertText(clip)
            deps.schedule()
          }
        })
      } catch (err) {
        void err
      }
      e.preventDefault()
      return
    }
    // While an IME composition is active, let the IME own the keystrokes
    if (editing && (e.isComposing || ed.isComposing?.())) {
      // Do not handle Enter/Backspace/etc here; composition events will update text
      return
    }
    // When not editing, let IME host receive text keys to start composition; we handle Enter navigation ourselves
    if (!editing && imeHasFocus) {
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') return
    }
    // If editing and IME host has focus, let beforeinput on textarea handle character input and deletions
    if (editing && imeHasFocus) {
      // Allow Enter handling below (commit or newline shortcut) only if not composing
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') return
    }
    if (!editing) {
      // navigation when not editing
      if (e.key === 'Enter') {
        // Move selection down (sheet-wide wrap). Respect merges when stepping down and stepping into merged blocks.
        const ac = getActiveCell()
        if (!ac) return
        let r = ac.r
        let c = ac.c
        const curM = ctx.sheet.getMergeAt(r, c)
        const curIsAnchor = !!curM && curM.r === r && curM.c === c
        if (curIsAnchor) r = curM!.r + curM!.rows
        else r = r + 1
        // Infinite mode: extend sheet instead of wrapping
        if (ctx.infiniteScroll) {
          if (r >= ctx.sheet.rows) ctx.sheet.rows = r + 1
          if (c >= ctx.sheet.cols) ctx.sheet.cols = c + 1
        } else {
          if (r >= ctx.sheet.rows) {
            r = 0
            c = c + 1
          }
          if (c >= ctx.sheet.cols) {
            c = 0
          }
        }
        // If landing inside a merged block, select the full block at its anchor
        const nextM = ctx.sheet.getMergeAt(r, c)
        let ar = r,
          ac2 = c,
          r1 = r,
          c1 = c
        if (nextM) {
          ar = nextM.r
          ac2 = nextM.c
          r1 = nextM.r + nextM.rows - 1
          c1 = nextM.c + nextM.cols - 1
        }
        state.selection = { r0: ar, r1, c0: ac2, c1 }
        // ensure visibility with minimal movement (edge-align if needed)
        deps.ensureVisible?.(ar, ac2, 'nearest')
        // Centralized schedule will sync overlay + IME positioning
        deps.schedule()
        e.preventDefault()
        return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Route character typing through the IME host so the first key participates in composition
        ed.focusIme?.()
        // Do not prevent default; let beforeinput on the IME host handle insertText and initialize editing
        return
      }
      return
    }

    // while editing (other shortcuts handled above)
    if (e.key === 'Enter') {
      // macOS: Control+Option+Enter inserts a newline while editing (do not commit)
      const isMac =
        typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
      if (isMac && e.ctrlKey && e.altKey && !e.metaKey) {
        // Ensure this cell is set to wrap text so newline is visible during edit and after commit
        const er = state.editor?.r ?? 0
        const ec = state.editor?.c ?? 0
        const curStyle = ctx.sheet.getStyleAt(er, ec)
        const alreadyWrap = !!curStyle?.alignment?.wrapText
        if (!alreadyWrap) {
          const newId = ctx.sheet.defineStyle({
            font: curStyle?.font,
            fill: curStyle?.fill,
            border: curStyle?.border,
            alignment: { ...(curStyle?.alignment ?? {}), wrapText: true },
          })
          ctx.sheet.setCellStyle(er, ec, newId)
        }
        ed.insertText('\n')
        e.preventDefault()
        return
      }
      // commit and move selection down
      const cur = state.editor
      ed.commit()
      // compute next cell (column-major wrap)
      let r = cur?.r ?? 0
      let c = cur?.c ?? 0
      const merge = ctx.sheet.getMergeAt(r, c)
      const isMergeAnchor = !!merge && merge.r === r && merge.c === c
      if (isMergeAnchor) r = merge!.r + merge!.rows
      else r = r + 1
      if (ctx.infiniteScroll) {
        if (r >= ctx.sheet.rows) ctx.sheet.rows = r + 1
        if (c >= ctx.sheet.cols) ctx.sheet.cols = c + 1
      } else {
        if (r >= ctx.sheet.rows) {
          r = 0
          c = c + 1
        }
        if (c >= ctx.sheet.cols) {
          c = 0
        }
      }
      // If landing inside a merged block, select the full block at its anchor
      const nextM = ctx.sheet.getMergeAt(r, c)
      let ar = r,
        ac2 = c,
        r1 = r,
        c1 = c
      if (nextM) {
        ar = nextM.r
        ac2 = nextM.c
        r1 = nextM.r + nextM.rows - 1
        c1 = nextM.c + nextM.cols - 1
      }
      state.selection = { r0: ar, r1, c0: ac2, c1 }
      // ensure visibility of the next active cell with minimal movement (Excel-like: bring to edge if needed)
      deps.ensureVisible?.(ar, ac2, 'nearest')
      // Centralized schedule will sync overlay + IME positioning
      deps.schedule()
      e.preventDefault()
      return
    }
    if (e.key === 'Escape') {
      ed.cancel()
      e.preventDefault()
      return
    }
    if (e.key === 'Backspace') {
      ed.backspace()
      e.preventDefault()
      return
    }
    if (e.key === 'Delete') {
      ed.del()
      e.preventDefault()
      return
    }
    if (e.key === 'ArrowLeft') {
      ed.moveCaret(-1)
      e.preventDefault()
      return
    }
    if (e.key === 'ArrowRight') {
      ed.moveCaret(1)
      e.preventDefault()
      return
    }
    if (!imeHasFocus && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Only handle direct text insertion when IME host is not focused
      ed.insertText(e.key)
      e.preventDefault()
      return
    }
  }

  window.addEventListener('keydown', onKeyDown)
  return {
    destroy() {
      window.removeEventListener('keydown', onKeyDown)
      ed.dispose?.()
    },
    editor: ed,
  }
}
