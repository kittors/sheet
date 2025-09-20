import type { Context } from './types'

// Expand a selection rectangle so that any intersecting merged ranges are fully included.
export function expandSelectionByMerges(
  ctx: Context,
  sel: { r0: number; c0: number; r1: number; c1: number },
) {
  const norm = () => {
    const r0 = Math.min(sel.r0, sel.r1)
    const r1 = Math.max(sel.r0, sel.r1)
    const c0 = Math.min(sel.c0, sel.c1)
    const c1 = Math.max(sel.c0, sel.c1)
    return { r0, c0, r1, c1 }
  }
  let changed = true
  while (changed) {
    changed = false
    const cur = norm()
    for (const m of ctx.sheet.merges) {
      const mr0 = m.r,
        mc0 = m.c
      const mr1 = m.r + m.rows - 1
      const mc1 = m.c + m.cols - 1
      const rOverlap = !(cur.r1 < mr0 || mr1 < cur.r0)
      const cOverlap = !(cur.c1 < mc0 || mc1 < cur.c0)
      if (rOverlap && cOverlap) {
        const next = {
          r0: Math.min(cur.r0, mr0),
          c0: Math.min(cur.c0, mc0),
          r1: Math.max(cur.r1, mr1),
          c1: Math.max(cur.c1, mc1),
        }
        if (next.r0 !== cur.r0 || next.c0 !== cur.c0 || next.r1 !== cur.r1 || next.c1 !== cur.c1) {
          sel.r0 = next.r0
          sel.c0 = next.c0
          sel.r1 = next.r1
          sel.c1 = next.c1
          changed = true
          break
        }
      }
    }
  }
}
