import type { Sheet } from '@sheet/core'
import { Workbook } from '@sheet/core'
import type { InteractionHandle } from '@sheet/interaction'

export interface SheetApi {
  // Queries
  getCellValue(r: number, c: number): string | number | boolean | null
  getCellStyle(r: number, c: number): ReturnType<Sheet['getStyle']>
  getSelection(): { r0: number; c0: number; r1: number; c1: number } | null
  getActiveCell(): { r: number; c: number } | null
  getRowCount(): number
  getColCount(): number
  getRowHeight(r: number): number | undefined
  getColWidth(c: number): number | undefined
  getScroll(): { x: number; y: number } | null
  // Commands (pass-through to interaction when present)
  applyTextColor(color: string): void
  applyFillColor(backgroundColor: string): void
  setValueInSelection(text: string): void
  mergeSelection(): void
  unmergeSelection(): void
  applyFontSize(size: number): void
  applyFontFamily(family: string): void
  applyHorizontalAlign(al: 'left' | 'center' | 'right'): void
  applyVerticalAlign(al: 'top' | 'middle' | 'bottom'): void
  // Events (rAF-polled subscriptions)
  onSelectionChange(cb: (sel: { r0: number; c0: number; r1: number; c1: number } | null) => void): () => void
  onScrollChange(cb: (scroll: { x: number; y: number }) => void): () => void
}

export function createSheetApi(args: { sheet: Sheet; interaction?: InteractionHandle }): SheetApi {
  const { sheet, interaction } = args
  // subscription state (started on demand)
  const selListeners: Array<(s: { r0: number; c0: number; r1: number; c1: number } | null) => void> = []
  const scrListeners: Array<(s: { x: number; y: number }) => void> = []
  let lastSel: { r0: number; c0: number; r1: number; c1: number } | null = interaction?.getSelection?.() ?? null
  let lastScr: { x: number; y: number } | null = interaction?.getScroll?.() ?? null
  let raf = 0
  const hasSubs = () => selListeners.length > 0 || scrListeners.length > 0
  type Sel = { r0: number; c0: number; r1: number; c1: number } | null
  type Scr = { x: number; y: number } | null
  const eqSel = (a: Sel, b: Sel) => {
    const aOk = !!a, bOk = !!b
    if (aOk !== bOk) return false
    if (!a || !b) return true
    return a.r0 === b.r0 && a.c0 === b.c0 && a.r1 === b.r1 && a.c1 === b.c1
  }
  const eqScr = (a: Scr, b: Scr) => {
    const aOk = !!a, bOk = !!b
    if (aOk !== bOk) return false
    if (!a || !b) return true
    return a.x === b.x && a.y === b.y
  }
  const pump = () => {
    if (!hasSubs()) return
    const curSel = interaction?.getSelection?.() ?? null
    const curScr = interaction?.getScroll?.() ?? lastScr ?? { x: 0, y: 0 }
    if (!eqSel(curSel, lastSel)) {
      lastSel = curSel
      for (const f of selListeners) f(curSel)
    }
    if (!eqScr(curScr, lastScr)) {
      lastScr = curScr
      for (const f of scrListeners) f(curScr)
    }
    raf = requestAnimationFrame(pump)
  }
  const ensureLoop = () => { if (!raf && hasSubs()) raf = requestAnimationFrame(pump) }

  return {
    // Queries
    getCellValue(r, c) { return sheet.getValueAt(r, c) ?? null },
    getCellStyle(r, c) { return sheet.getStyleAt(r, c) },
    getSelection() { return interaction?.getSelection() ?? null },
    getActiveCell() { return interaction?.getFirstSelectedCell() ?? null },
    getRowCount() { return sheet.rows },
    getColCount() { return sheet.cols },
    getRowHeight(r) { return sheet.rowHeights.get(r) },
    getColWidth(c) { return sheet.colWidths.get(c) },
    getScroll() { return interaction?.getScroll() ?? null },
    // Commands
    applyTextColor(color) { interaction?.applyTextColor(color) },
    applyFillColor(backgroundColor) { interaction?.applyFillColor(backgroundColor) },
    setValueInSelection(text) { interaction?.setValueInSelection(text) },
    mergeSelection() { interaction?.mergeSelection() },
    unmergeSelection() { interaction?.unmergeSelection() },
    applyFontSize(size) {
      const styleId = sheet.defineStyle({ font: { size } })
      const sel = interaction?.getSelection?.()
      if (!sel) return
      const r0 = Math.max(0, Math.min(sel.r0, sel.r1))
      const r1 = Math.min(sheet.rows - 1, Math.max(sel.r0, sel.r1))
      const c0 = Math.max(0, Math.min(sel.c0, sel.c1))
      const c1 = Math.min(sheet.cols - 1, Math.max(sel.c0, sel.c1))
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) sheet.setCellStyle(r, c, styleId)
    },
    applyFontFamily(family) {
      const styleId = sheet.defineStyle({ font: { family } })
      const sel = interaction?.getSelection?.()
      if (!sel) return
      const r0 = Math.max(0, Math.min(sel.r0, sel.r1))
      const r1 = Math.min(sheet.rows - 1, Math.max(sel.r0, sel.r1))
      const c0 = Math.max(0, Math.min(sel.c0, sel.c1))
      const c1 = Math.min(sheet.cols - 1, Math.max(sel.c0, sel.c1))
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) sheet.setCellStyle(r, c, styleId)
    },
    applyHorizontalAlign(al) {
      const styleId = sheet.defineStyle({ alignment: { horizontal: al } })
      const sel = interaction?.getSelection?.()
      if (!sel) return
      const r0 = Math.max(0, Math.min(sel.r0, sel.r1))
      const r1 = Math.min(sheet.rows - 1, Math.max(sel.r0, sel.r1))
      const c0 = Math.max(0, Math.min(sel.c0, sel.c1))
      const c1 = Math.min(sheet.cols - 1, Math.max(sel.c0, sel.c1))
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) sheet.setCellStyle(r, c, styleId)
    },
    applyVerticalAlign(al) {
      const styleId = sheet.defineStyle({ alignment: { vertical: al } })
      const sel = interaction?.getSelection?.()
      if (!sel) return
      const r0 = Math.max(0, Math.min(sel.r0, sel.r1))
      const r1 = Math.min(sheet.rows - 1, Math.max(sel.r0, sel.r1))
      const c0 = Math.max(0, Math.min(sel.c0, sel.c1))
      const c1 = Math.min(sheet.cols - 1, Math.max(sel.c0, sel.c1))
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) sheet.setCellStyle(r, c, styleId)
    },
    // Events
    onSelectionChange(cb) {
      selListeners.push(cb)
      ensureLoop()
      return () => {
        const i = selListeners.indexOf(cb)
        if (i >= 0) selListeners.splice(i, 1)
        if (!hasSubs() && raf) { cancelAnimationFrame(raf); raf = 0 }
      }
    },
    onScrollChange(cb) {
      scrListeners.push(cb)
      ensureLoop()
      return () => {
        const i = scrListeners.indexOf(cb)
        if (i >= 0) scrListeners.splice(i, 1)
        if (!hasSubs() && raf) { cancelAnimationFrame(raf); raf = 0 }
      }
    },
  }
}

// re-export if needed by consumers
// export type { InteractionHandle } from '@sheet/interaction'

// Shared helpers for UI/app layers
export type InitCell = { r: number; c: number; value: string | number | boolean | null }
export type InitMerge = { r: number; c: number; rows: number; cols: number }

export function applyCells(sheet: Sheet, cells?: InitCell[]) {
  if (!cells?.length) return
  for (const it of cells) {
    if (it.r >= 0 && it.r < sheet.rows && it.c >= 0 && it.c < sheet.cols) {
      sheet.setValue(it.r, it.c, it.value)
    }
  }
}

export function applyMerges(sheet: Sheet, merges?: InitMerge[]) {
  if (!merges?.length) return
  for (const m of merges) {
    if (m.rows >= 1 && m.cols >= 1) sheet.addMerge(m.r, m.c, m.rows, m.cols)
  }
}

export function createWorkbookWithSheet(args: { name?: string; rows?: number; cols?: number }) {
  const name = args.name ?? 'Sheet1'
  const rows = args.rows ?? 100
  const cols = args.cols ?? 100
  const wb = new Workbook()
  const sheet = wb.addSheet(name, rows, cols)
  return { workbook: wb, sheet }
}
