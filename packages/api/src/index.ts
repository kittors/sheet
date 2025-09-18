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
  const eqSel = (a: any, b: any) => !!a === !!b && (!a || (a.r0 === b.r0 && a.c0 === b.c0 && a.r1 === b.r1 && a.c1 === b.c1))
  const eqScr = (a: any, b: any) => !!a === !!b && (!a || (a.x === b.x && a.y === b.y))
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
    getCellValue(r, c) { return sheet.getCell(r, c)?.value ?? null },
    getCellStyle(r, c) { return sheet.getStyle(sheet.getCell(r, c)?.styleId) },
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

export function applyCells(sheet: Sheet, cells?: InitCell[]) {
  if (!cells?.length) return
  for (const it of cells) {
    if (it.r >= 0 && it.r < sheet.rows && it.c >= 0 && it.c < sheet.cols) {
      sheet.setValue(it.r, it.c, it.value)
    }
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
