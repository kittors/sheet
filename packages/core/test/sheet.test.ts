import { describe, it, expect } from 'vitest'
import { Sheet } from '../src/models/sheet'

describe('Sheet', () => {
  it('sets and gets cell values and styles', () => {
    const s = new Sheet('S', 100, 100)
    const id = s.defineStyle({ font: { color: '#f00' } })
    s.setCellStyle(0, 0, id)
    s.setValue(0, 0, 'A1')
    expect(s.getCell(0, 0)?.value).toBe('A1')
    expect(s.getStyle(s.getCell(0, 0)?.styleId)?.font?.color).toBe('#f00')
  })
})
