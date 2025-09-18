import { describe, it, expect } from 'vitest'
import { createWorkbookWithSheet, applyCells, createSheetApi } from '../src/index'

describe('workbook helpers', () => {
  it('creates a workbook and sheet with defaults', () => {
    const { workbook, sheet } = createWorkbookWithSheet({})
    expect(workbook.sheets.length).toBe(1)
    expect(sheet.rows).toBe(100)
    expect(sheet.cols).toBe(100)
  })

  it('applies initial cells safely within bounds', () => {
    const { sheet } = createWorkbookWithSheet({ rows: 3, cols: 3 })
    applyCells(sheet, [
      { r: 0, c: 0, value: 'A1' },
      { r: 2, c: 2, value: 'C3' },
      { r: 99, c: 99, value: 'ignored' },
    ])
    expect(sheet.getCell(0, 0)?.value).toBe('A1')
    expect(sheet.getCell(2, 2)?.value).toBe('C3')
    expect(sheet.getCell(99, 99)).toBeUndefined()
  })
})

describe('SheetApi commands', () => {
  it('applies font and alignment commands to selection', () => {
    const { sheet } = createWorkbookWithSheet({ rows: 10, cols: 10 })
    const interaction: { getSelection: () => { r0: number; c0: number; r1: number; c1: number } } = {
      getSelection: () => ({ r0: 1, c0: 1, r1: 2, c1: 2 }),
    }
    const api = createSheetApi({ sheet, interaction })
    api.applyFontFamily('Inter')
    const cell1 = sheet.getCell(1, 1)
    expect(cell1 && cell1.styleId).toBeTruthy()
    let stId = cell1?.styleId as number
    let st = sheet.getStyle(stId)
    expect(st?.font?.family).toBe('Inter')

    api.applyHorizontalAlign('center')
    stId = (sheet.getCell(1, 1)?.styleId as number)
    st = sheet.getStyle(stId)
    expect(st?.alignment?.horizontal).toBe('center')

    api.applyVerticalAlign('middle')
    stId = (sheet.getCell(1, 1)?.styleId as number)
    st = sheet.getStyle(stId)
    expect(st?.alignment?.vertical).toBe('middle')

    // Applying size later overrides the style id; property should be present
    api.applyFontSize(18)
    stId = (sheet.getCell(1, 1)?.styleId as number)
    st = sheet.getStyle(stId)
    expect(st?.font?.size).toBe(18)
  })
})
