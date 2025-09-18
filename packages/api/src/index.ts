import type { Sheet } from '@sheet/core'
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
}

export function createSheetApi(args: { sheet: Sheet; interaction?: InteractionHandle }): SheetApi {
  const { sheet, interaction } = args
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
  }
}

export type { InteractionHandle } from '@sheet/interaction'

