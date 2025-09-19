import type { Context, State } from './types'
import { createEditor } from './editor'

export function attachKeyboard(ctx: Context, state: State, deps: { schedule: () => void }) {
  const ed = createEditor(ctx, state, deps)

  function getActiveCell(): { r: number; c: number } | null {
    const sel = state.selection
    if (!sel) return null
    const r = Math.min(sel.r0, sel.r1)
    const c = Math.min(sel.c0, sel.c1)
    return { r, c }
  }

  function onKeyDown(e: KeyboardEvent) {
    const editing = !!state.editor
    if (!editing) {
      // start editing
      if (e.key === 'Enter') {
        const ac = getActiveCell(); if (!ac) return
        ed.beginAt(ac.r, ac.c)
        e.preventDefault()
        return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const ac = getActiveCell(); if (!ac) return
        ed.beginAt(ac.r, ac.c, { replaceWith: e.key })
        e.preventDefault()
        return
      }
      return
    }

    // while editing
    if (e.key === 'Enter') { ed.commit(); e.preventDefault(); return }
    if (e.key === 'Escape') { ed.cancel(); e.preventDefault(); return }
    if (e.key === 'Backspace') { ed.backspace(); e.preventDefault(); return }
    if (e.key === 'Delete') { ed.del(); e.preventDefault(); return }
    if (e.key === 'ArrowLeft') { ed.moveCaret(-1); e.preventDefault(); return }
    if (e.key === 'ArrowRight') { ed.moveCaret(1); e.preventDefault(); return }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      ed.insertText(e.key)
      e.preventDefault()
      return
    }
  }

  window.addEventListener('keydown', onKeyDown)
  return {
    destroy() {
      window.removeEventListener('keydown', onKeyDown)
      ed.stopBlink()
    },
    editor: ed,
  }
}

