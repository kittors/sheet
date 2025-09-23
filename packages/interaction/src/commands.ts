import type { Context, State, InteractionHandle } from './types'
import type { Style } from '@sheet/core'

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

  function applyFont(patch: Partial<import('@sheet/core').Font>) {
    // normalize size limits globally (UI also clamps, but keep invariant here)
    const clamp = (n: number) => Math.min(72, Math.max(6, Math.round(n)))
    const normalized: Partial<import('@sheet/core').Font> = { ...patch }
    if (normalized.size != null) normalized.size = clamp(Number(normalized.size))
    const sel = state.selection
    if (!sel) return
    const r0 = Math.max(0, Math.min(sel.r0, sel.r1))
    const r1 = Math.min(ctx.sheet.rows - 1, Math.max(sel.r0, sel.r1))
    const c0 = Math.max(0, Math.min(sel.c0, sel.c1))
    const c1 = Math.min(ctx.sheet.cols - 1, Math.max(sel.c0, sel.c1))
    const selFullyContainsMerge = (m: { r: number; c: number; rows: number; cols: number }) => {
      const mr0 = m.r,
        mr1 = m.r + m.rows - 1
      const mc0 = m.c,
        mc1 = m.c + m.cols - 1
      return mr0 >= r0 && mr1 <= r1 && mc0 >= c0 && mc1 <= c1
    }
    const canApplyAt = (r: number, c: number) => {
      const m = ctx.sheet.getMergeAt(r, c)
      if (!m) return true
      if (!(m.r === r && m.c === c)) return false
      return selFullyContainsMerge(m)
    }
    forEachSelected((r, c) => {
      if (!canApplyAt(r, c)) return
      const base = ctx.sheet.getStyleAt(r, c)
      const next: Omit<Style, 'id'> = {
        font: { ...(base?.font ?? {}), ...normalized },
        fill: base?.fill,
        border: base?.border,
        alignment: base?.alignment,
      }
      const id = ctx.sheet.defineStyle(next)
      ctx.sheet.setCellStyle(r, c, id)
    })
    deps.schedule()
  }

  function applyTextColor(color: string) {
    const sel = state.selection
    if (!sel) return
    const r0 = Math.max(0, Math.min(sel.r0, sel.r1))
    const r1 = Math.min(ctx.sheet.rows - 1, Math.max(sel.r0, sel.r1))
    const c0 = Math.max(0, Math.min(sel.c0, sel.c1))
    const c1 = Math.min(ctx.sheet.cols - 1, Math.max(sel.c0, sel.c1))
    const selFullyContainsMerge = (m: { r: number; c: number; rows: number; cols: number }) => {
      const mr0 = m.r,
        mr1 = m.r + m.rows - 1
      const mc0 = m.c,
        mc1 = m.c + m.cols - 1
      return mr0 >= r0 && mr1 <= r1 && mc0 >= c0 && mc1 <= c1
    }
    const canApplyAt = (r: number, c: number) => {
      const m = ctx.sheet.getMergeAt(r, c)
      if (!m) return true
      if (!(m.r === r && m.c === c)) return false
      return selFullyContainsMerge(m)
    }
    forEachSelected((r, c) => {
      if (!canApplyAt(r, c)) return
      const base = ctx.sheet.getStyleAt(r, c)
      const next: Omit<Style, 'id'> = {
        font: { ...(base?.font ?? {}), color },
        fill: base?.fill,
        border: base?.border,
        alignment: base?.alignment,
      }
      const id = ctx.sheet.defineStyle(next)
      ctx.sheet.setCellStyle(r, c, id)
    })
    deps.schedule()
  }

  function applyFillColor(backgroundColor: string) {
    const sel = state.selection
    if (!sel) return
    const r0 = Math.max(0, Math.min(sel.r0, sel.r1))
    const r1 = Math.min(ctx.sheet.rows - 1, Math.max(sel.r0, sel.r1))
    const c0 = Math.max(0, Math.min(sel.c0, sel.c1))
    const c1 = Math.min(ctx.sheet.cols - 1, Math.max(sel.c0, sel.c1))
    const selFullyContainsMerge = (m: { r: number; c: number; rows: number; cols: number }) => {
      const mr0 = m.r,
        mr1 = m.r + m.rows - 1
      const mc0 = m.c,
        mc1 = m.c + m.cols - 1
      return mr0 >= r0 && mr1 <= r1 && mc0 >= c0 && mc1 <= c1
    }
    const canApplyAt = (r: number, c: number) => {
      const m = ctx.sheet.getMergeAt(r, c)
      if (!m) return true
      if (!(m.r === r && m.c === c)) return false
      return selFullyContainsMerge(m)
    }
    forEachSelected((r, c) => {
      if (!canApplyAt(r, c)) return
      const base = ctx.sheet.getStyleAt(r, c)
      const next: Omit<Style, 'id'> = {
        font: base?.font,
        fill: { ...(base?.fill ?? {}), backgroundColor },
        border: base?.border,
        alignment: base?.alignment,
      }
      const id = ctx.sheet.defineStyle(next)
      ctx.sheet.setCellStyle(r, c, id)
    })
    deps.schedule()
  }

  function applyBorder(args: {
    mode: 'none' | 'all' | 'outside' | 'custom'
    color?: string
    width?: number
    style?: import('@sheet/core').BorderStyle
    sides?: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean }
  }) {
    const sel = state.selection
    if (!sel) return
    const r0 = Math.max(0, Math.min(sel.r0, sel.r1))
    const r1 = Math.min(ctx.sheet.rows - 1, Math.max(sel.r0, sel.r1))
    const c0 = Math.max(0, Math.min(sel.c0, sel.c1))
    const c1 = Math.min(ctx.sheet.cols - 1, Math.max(sel.c0, sel.c1))
    const color = args.color ?? '#374151'
    const width = Math.max(1, Math.floor(args.width ?? 1))
    const style = args.style ?? 'solid'

    // Selection shape flags
    const isSingleCol = c0 === c1
    const isSingleRow = r0 === r1

    // Apply a given side onto a merge anchor if (r,c) lies within that merge and the
    // requested side coincides with the merge's external boundary.
    const applyMergeSideIfNeeded = (
      r: number,
      c: number,
      side: 'top' | 'bottom' | 'left' | 'right',
      spec: { color?: string; width?: number; style?: import('@sheet/core').BorderStyle },
    ) => {
      const m = ctx.sheet.getMergeAt(r, c)
      if (!m) return
      const isAnchor = m.r === r && m.c === c
      // If selection fully contains the merge, normal path will handle at anchor; skip here
      if (isAnchor && (m.r >= r0 && m.r + m.rows - 1 <= r1 && m.c >= c0 && m.c + m.cols - 1 <= c1)) return
      // Compute whether this selected cell side is also a merge boundary
      let match = false
      if (side === 'left') match = c === m.c
      else if (side === 'right') match = c === m.c + m.cols - 1
      else if (side === 'top') match = r === m.r
      else if (side === 'bottom') match = r === m.r + m.rows - 1
      if (!match) return
      // Additional restraint: for pure column selection, only propagate vertical sides;
      // for pure row selection, only propagate horizontal sides. For general rectangle, allow both.
      if (isSingleCol && (side === 'top' || side === 'bottom')) return
      if (isSingleRow && (side === 'left' || side === 'right')) return
      // Write onto merge anchor, preserving other sides
      const base = ctx.sheet.getStyleAt(m.r, m.c)
      const nb: NonNullable<Style['border']> = {
        top: base?.border?.top,
        bottom: base?.border?.bottom,
        left: base?.border?.left,
        right: base?.border?.right,
      }
      nb[side] = { color, width, style, ...spec }
      const next: Omit<Style, 'id'> = {
        font: base?.font,
        fill: base?.fill,
        alignment: base?.alignment,
        border: nb,
      }
      const id = ctx.sheet.defineStyle(next)
      ctx.sheet.setCellStyle(m.r, m.c, id)
    }

    // Helper: true if selection fully contains the given merge range
    const selFullyContainsMerge = (m: { r: number; c: number; rows: number; cols: number }) => {
      const mr0 = m.r,
        mr1 = m.r + m.rows - 1
      const mc0 = m.c,
        mc1 = m.c + m.cols - 1
      return mr0 >= r0 && mr1 <= r1 && mc0 >= c0 && mc1 <= c1
    }
    // Guard: skip applying to covered cells; and skip anchors unless the whole merge is selected
    const canApplyAt = (r: number, c: number): boolean => {
      const m = ctx.sheet.getMergeAt(r, c)
      if (!m) return true
      // covered cell (not anchor)
      if (!(m.r === r && m.c === c)) return false
      // anchor: only apply when selection fully contains the merge
      return selFullyContainsMerge(m)
    }

    if (args.mode === 'none') {
      // Explicitly suppress all four sides so neighbors won't re-draw the shared edge
      forEachSelected((r, c) => {
        if (!canApplyAt(r, c)) return
        const base = ctx.sheet.getStyleAt(r, c)
        const next: Omit<Style, 'id'> = {
          font: base?.font,
          fill: base?.fill,
          alignment: base?.alignment,
          border: {
            top: { style: 'none' as const, width: 0 },
            bottom: { style: 'none' as const, width: 0 },
            left: { style: 'none' as const, width: 0 },
            right: { style: 'none' as const, width: 0 },
          },
        }
        const id = ctx.sheet.defineStyle(next)
        ctx.sheet.setCellStyle(r, c, id)
      })
      deps.schedule()
      return
    }

    if (args.mode === 'all') {
      forEachSelected((r, c) => {
        if (!canApplyAt(r, c)) {
          // Covered by a merge: propagate only sides that coincide with merge outer boundary
          applyMergeSideIfNeeded(r, c, 'left', {})
          applyMergeSideIfNeeded(r, c, 'right', {})
          applyMergeSideIfNeeded(r, c, 'top', {})
          applyMergeSideIfNeeded(r, c, 'bottom', {})
          return
        }
        const base = ctx.sheet.getStyleAt(r, c)
        const next: Omit<Style, 'id'> = {
          font: base?.font,
          fill: base?.fill,
          alignment: base?.alignment,
          border: {
            top: { color, width, style },
            bottom: { color, width, style },
            left: { color, width, style },
            right: { color, width, style },
          },
        }
        const id = ctx.sheet.defineStyle(next)
        ctx.sheet.setCellStyle(r, c, id)
      })
      deps.schedule()
      return
    }

    if (args.mode === 'outside') {
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (!canApplyAt(r, c)) {
            // Covered by a merge: only propagate the sides that are requested by 'outside'
            if (r === r0) applyMergeSideIfNeeded(r, c, 'top', {})
            if (r === r1) applyMergeSideIfNeeded(r, c, 'bottom', {})
            if (c === c0) applyMergeSideIfNeeded(r, c, 'left', {})
            if (c === c1) applyMergeSideIfNeeded(r, c, 'right', {})
            continue
          }
          const base = ctx.sheet.getStyleAt(r, c)
          const top = r === r0 ? { color, width, style } : base?.border?.top
          const bottom = r === r1 ? { color, width, style } : base?.border?.bottom
          const left = c === c0 ? { color, width, style } : base?.border?.left
          const right = c === c1 ? { color, width, style } : base?.border?.right
          const border: NonNullable<Style['border']> = { top, bottom, left, right }
          const next: Omit<Style, 'id'> = {
            font: base?.font,
            fill: base?.fill,
            alignment: base?.alignment,
            border,
          }
          const id = ctx.sheet.defineStyle(next)
          ctx.sheet.setCellStyle(r, c, id)
        }
      }
      deps.schedule()
      return
    }

    // custom mode
    const sides = args.sides ?? {}
    const top = sides.top ? { color, width, style } : undefined
    const bottom = sides.bottom ? { color, width, style } : undefined
    const left = sides.left ? { color, width, style } : undefined
    const right = sides.right ? { color, width, style } : undefined
    forEachSelected((r, c) => {
      if (!canApplyAt(r, c)) {
        if (sides.top) applyMergeSideIfNeeded(r, c, 'top', {})
        if (sides.bottom) applyMergeSideIfNeeded(r, c, 'bottom', {})
        if (sides.left) applyMergeSideIfNeeded(r, c, 'left', {})
        if (sides.right) applyMergeSideIfNeeded(r, c, 'right', {})
        return
      }
      const base = ctx.sheet.getStyleAt(r, c)
      const border: NonNullable<Style['border']> = { top, bottom, left, right }
      const next: Omit<Style, 'id'> = {
        font: base?.font,
        fill: base?.fill,
        alignment: base?.alignment,
        border,
      }
      const id = ctx.sheet.defineStyle(next)
      ctx.sheet.setCellStyle(r, c, id)
    })
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
    applyBorder,
    applyFont,
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
