import { computeVisibleRange } from '../src/virtual'
import { describe, it, expect } from 'vitest'

describe('computeVisibleRange', () => {
  it('computes basic ranges with defaults', () => {
    const r = computeVisibleRange({
      scrollX: 0,
      scrollY: 0,
      viewportWidth: 100,
      viewportHeight: 60,
      colCount: 100,
      rowCount: 100000,
      defaultColWidth: 50,
      defaultRowHeight: 20,
    })
    expect(r.colStart).toBe(0)
    expect(r.colEnd).toBeGreaterThanOrEqual(1) // at least 2 cols fit
    expect(r.rowStart).toBe(0)
    expect(r.rowEnd).toBeGreaterThanOrEqual(2) // at least 3 rows fit
  })

  it('respects scroll offsets and overscan', () => {
    const r = computeVisibleRange({
      scrollX: 75, // in middle of col 1 (0-based)
      scrollY: 30, // in middle of row 1
      viewportWidth: 100,
      viewportHeight: 50,
      colCount: 5,
      rowCount: 5,
      defaultColWidth: 50,
      defaultRowHeight: 20,
      overscan: 1,
    })
    expect(r.colStart).toBe(0) // overscan backs up to col 0
    expect(r.rowStart).toBe(0)
    expect(r.colEnd).toBe(4)
    expect(r.rowEnd).toBe(4)
  })
})
