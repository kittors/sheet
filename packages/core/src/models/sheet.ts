import type { Cell, Style } from './cell'

/**
 * A merged-rectangle described by its anchor (top-left) and its span.
 * Invariants:
 * - rows >= 1, cols >= 1
 * - (r,c) is always within sheet bounds
 * - No overlap between items in `merges`
 * - Only the anchor cell may physically exist in `cells` for a merged area;
 *   all covered cells must not be present in `cells`.
 */
export interface MergeRange {
  r: number
  c: number
  rows: number
  cols: number
}

export class Sheet {
  name: string
  rows: number
  cols: number
  // Sparse cell storage: key = r,c
  private cells = new Map<string, Cell>()
  // Styles registry
  private styles = new Map<number, Style>()
  private styleSeq = 1
  // Row/col sizes
  rowHeights = new Map<number, number>()
  colWidths = new Map<number, number>()
  // Merged cells
  merges: MergeRange[] = []
  // Fast lookup for covered cells: key -> anchor key
  private mergeCoverIndex = new Map<string, string>()

  constructor(name: string, rows: number, cols: number) {
    this.name = name
    this.rows = rows
    this.cols = cols
  }

  private key(r: number, c: number) {
    return `${r},${c}`
  }

  /**
   * Returns the physical cell stored at (r,c) if any. Does not follow merges.
   * Use `getValueAt`/`getStyleAt` to resolve across merged coverage.
   */
  getCell(r: number, c: number): Cell | undefined {
    return this.cells.get(this.key(r, c))
  }

  /**
   * Sets the cell at (r,c). If (r,c) is covered by a merge, redirects to the anchor.
   */
  setCell(r: number, c: number, cell: Cell): void {
    const { ar, ac } = this.getMergeAnchorFor(r, c) ?? { ar: r, ac: c }
    this.cells.set(this.key(ar, ac), cell)
  }

  setValue(r: number, c: number, value: Cell['value']): void {
    const { ar, ac } = this.getMergeAnchorFor(r, c) ?? { ar: r, ac: c }
    const k = this.key(ar, ac)
    const cur = this.cells.get(k) || {}
    cur.value = value
    this.cells.set(k, cur)
  }

  defineStyle(style: Omit<Style, 'id'>): number {
    const id = this.styleSeq++
    const full: Style = { id, ...style }
    this.styles.set(id, full)
    return id
  }

  /** Define a style with an explicit id (used when hydrating from snapshots). */
  defineStyleWithId(style: Style): number {
    this.styles.set(style.id, style)
    if (style.id >= this.styleSeq) this.styleSeq = style.id + 1
    return style.id
  }

  getStyle(id?: number): Style | undefined {
    return id ? this.styles.get(id) : undefined
  }

  setCellStyle(r: number, c: number, styleId: number): void {
    const { ar, ac } = this.getMergeAnchorFor(r, c) ?? { ar: r, ac: c }
    const k = this.key(ar, ac)
    const cur = this.cells.get(k) || {}
    cur.styleId = styleId
    this.cells.set(k, cur)
  }

  setRowHeight(r: number, h: number) {
    this.rowHeights.set(r, h)
  }
  setColWidth(c: number, w: number) {
    this.colWidths.set(c, w)
  }

  /**
   * Returns the anchor (ar,ac) if (r,c) is covered by a merge and is not the anchor itself.
   * Returns null if (r,c) is not within any merge or is the anchor.
   */
  getMergeAnchorFor(r: number, c: number): { ar: number; ac: number } | null {
    const k = this.key(r, c)
    const ak = this.mergeCoverIndex.get(k)
    if (!ak) return null
    const [ar, ac] = ak.split(',').map((n) => +n)
    return { ar, ac }
  }

  /** True if (r,c) is the top-left anchor of a merge. */
  isMergeAnchor(r: number, c: number): boolean {
    return this.merges.some((m) => m.r === r && m.c === c)
  }

  /** Returns the merge range that contains (r,c), if any. */
  getMergeAt(r: number, c: number): MergeRange | undefined {
    // Fast path via cover index for non-anchors
    const a = this.getMergeAnchorFor(r, c)
    if (a) return this.merges.find((m) => m.r === a.ar && m.c === a.ac)
    // Check if it's an anchor
    return this.merges.find((m) => r >= m.r && r < m.r + m.rows && c >= m.c && c < m.c + m.cols)
  }

  /** Returns the value at logical position (r,c), following merges. */
  getValueAt(r: number, c: number): Cell['value'] | undefined {
    const { ar, ac } = this.getMergeAnchorFor(r, c) ?? { ar: r, ac: c }
    return this.getCell(ar, ac)?.value
  }

  /** Returns the style at logical position (r,c), following merges. */
  getStyleAt(r: number, c: number): Style | undefined {
    const { ar, ac } = this.getMergeAnchorFor(r, c) ?? { ar: r, ac: c }
    const id = this.getCell(ar, ac)?.styleId
    return this.getStyle(id)
  }

  /** Adds a merge rectangle after validating constraints and normalizing cells. */
  /** Attempts to add a merge; returns true if applied, false if rejected.
   * Behavior with existing merges:
   * - If an existing merge is fully contained within the new rectangle, it is removed (the new one supersedes it).
   * - If an existing merge partially overlaps but is not fully contained, the operation is rejected (caller should expand selection first).
   */
  addMerge(r: number, c: number, rows: number, cols: number): boolean {
    // Normalize inputs
    if (rows < 1 || cols < 1) return false
    const rEnd = r + rows - 1
    const cEnd = c + cols - 1
    if (r < 0 || c < 0 || rEnd >= this.rows || cEnd >= this.cols) return false
    const next: MergeRange = { r, c, rows, cols }
    // Handle overlaps: collect merges fully contained within `next`; reject partial overlaps
    const toRemove: MergeRange[] = []
    for (const m of this.merges) {
      if (!Sheet.rectsIntersect(m, next)) continue
      const mR1 = m.r,
        mR2 = m.r + m.rows - 1
      const mC1 = m.c,
        mC2 = m.c + m.cols - 1
      const fullyInside = mR1 >= r && mR2 <= rEnd && mC1 >= c && mC2 <= cEnd
      if (fullyInside) toRemove.push(m)
      else return false // partial overlap not allowed
    }
    // Remove contained merges
    if (toRemove.length) this.merges = this.merges.filter((m) => !toRemove.includes(m))
    // Remove any cells inside the region except anchor (anchor remains/created)
    for (let rr = r; rr <= rEnd; rr++) {
      for (let cc = c; cc <= cEnd; cc++) {
        if (rr === r && cc === c) continue
        this.cells.delete(this.key(rr, cc))
      }
    }
    this.merges.push(next)
    this.rebuildMergeCoverIndex()
    return true
  }

  /** Unmerge a rectangle that contains (r,c). No values are restored into interior cells. */
  /** Unmerge a rectangle that contains (r,c). Returns true if something was removed. */
  removeMergeAt(r: number, c: number): boolean {
    const m = this.getMergeAt(r, c)
    if (!m) return false
    const idx = this.merges.indexOf(m)
    if (idx >= 0) this.merges.splice(idx, 1)
    this.rebuildMergeCoverIndex()
    return true
  }

  /** Rebuilds the "covered by merge" index for fast lookup. */
  private rebuildMergeCoverIndex() {
    this.mergeCoverIndex.clear()
    for (const m of this.merges) {
      const ak = this.key(m.r, m.c)
      for (let rr = m.r; rr < m.r + m.rows; rr++) {
        for (let cc = m.c; cc < m.c + m.cols; cc++) {
          const k = this.key(rr, cc)
          if (rr === m.r && cc === m.c) continue // anchor itself is not considered covered
          this.mergeCoverIndex.set(k, ak)
        }
      }
    }
  }

  /** Utility: rectangle intersection test for merges. */
  static rectsIntersect(a: MergeRange, b: MergeRange): boolean {
    const aR1 = a.r,
      aR2 = a.r + a.rows - 1
    const aC1 = a.c,
      aC2 = a.c + a.cols - 1
    const bR1 = b.r,
      bR2 = b.r + b.rows - 1
    const bC1 = b.c,
      bC2 = b.c + b.cols - 1
    const rOverlap = aR1 <= bR2 && bR1 <= aR2
    const cOverlap = aC1 <= bC2 && bC1 <= aC2
    return rOverlap && cOverlap
  }
}

// Serialized transport used by worker renderer
export type SerializedSheet = {
  name: string
  rows: number
  cols: number
  rowHeights: Array<[number, number]>
  colWidths: Array<[number, number]>
  merges: MergeRange[]
  // sparse cells with style references by id
  cells: Array<{ r: number; c: number; value?: Cell['value']; styleId?: number }>
  styles: Style[]
}

export type SheetOp =
  | { type: 'setValue'; r: number; c: number; value: Cell['value'] }
  | { type: 'setCellStyle'; r: number; c: number; styleId: number }
  | { type: 'setRowHeight'; r: number; h: number }
  | { type: 'setColWidth'; c: number; w: number }
  | { type: 'addMerge'; r: number; c: number; rows: number; cols: number }
  | { type: 'removeMergeAt'; r: number; c: number }
  | { type: 'defineStyle'; style: Style }

export function exportSheet(sheet: Sheet): SerializedSheet {
  const cells: Array<{ r: number; c: number; value?: Cell['value']; styleId?: number }> = []
  // best-effort sparse walk: iterate known merges, row/col size overrides, and scan visible bounds
  // Since internal cells map is private, we rely on getCell hits by scanning within bounds
  for (let r = 0; r < sheet.rows; r++) {
    for (let c = 0; c < sheet.cols; c++) {
      const cell = sheet.getCell(r, c)
      if (!cell) continue
      cells.push({ r, c, value: cell.value, styleId: cell.styleId })
    }
  }
  const rowHeights = Array.from(sheet.rowHeights.entries())
  const colWidths = Array.from(sheet.colWidths.entries())
  const styles = Array.from((sheet as any).styles?.values?.() ?? []) as Style[]
  return {
    name: sheet.name,
    rows: sheet.rows,
    cols: sheet.cols,
    rowHeights,
    colWidths,
    merges: sheet.merges.slice(),
    cells,
    styles,
  }
}

export function importSheet(snap: SerializedSheet): Sheet {
  const s = new Sheet(snap.name, snap.rows, snap.cols)
  for (const st of snap.styles) s.defineStyleWithId(st)
  for (const [r, h] of snap.rowHeights) s.setRowHeight(r, h)
  for (const [c, w] of snap.colWidths) s.setColWidth(c, w)
  for (const m of snap.merges) s.addMerge(m.r, m.c, m.rows, m.cols)
  for (const cell of snap.cells) {
    if (cell.value !== undefined) s.setValue(cell.r, cell.c, cell.value)
    if (cell.styleId != null) s.setCellStyle(cell.r, cell.c, cell.styleId)
  }
  return s
}

export function applySheetOp(sheet: Sheet, op: SheetOp) {
  switch (op.type) {
    case 'setValue':
      sheet.setValue(op.r, op.c, op.value)
      break
    case 'setCellStyle':
      sheet.setCellStyle(op.r, op.c, op.styleId)
      break
    case 'setRowHeight':
      sheet.setRowHeight(op.r, op.h)
      break
    case 'setColWidth':
      sheet.setColWidth(op.c, op.w)
      break
    case 'addMerge':
      sheet.addMerge(op.r, op.c, op.rows, op.cols)
      break
    case 'removeMergeAt':
      sheet.removeMergeAt(op.r, op.c)
      break
    case 'defineStyle':
      sheet.defineStyleWithId(op.style)
      break
  }
}
