import type { Cell, Style } from './cell'

export interface MergeRange { r: number; c: number; rows: number; cols: number }

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

  constructor(name: string, rows: number, cols: number) {
    this.name = name
    this.rows = rows
    this.cols = cols
  }

  private key(r: number, c: number) { return `${r},${c}` }

  getCell(r: number, c: number): Cell | undefined { return this.cells.get(this.key(r, c)) }

  setCell(r: number, c: number, cell: Cell): void { this.cells.set(this.key(r, c), cell) }

  setValue(r: number, c: number, value: Cell['value']): void {
    const k = this.key(r, c)
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

  getStyle(id?: number): Style | undefined { return id ? this.styles.get(id) : undefined }

  setCellStyle(r: number, c: number, styleId: number): void {
    const k = this.key(r, c)
    const cur = this.cells.get(k) || {}
    cur.styleId = styleId
    this.cells.set(k, cur)
  }

  setRowHeight(r: number, h: number) { this.rowHeights.set(r, h) }
  setColWidth(c: number, w: number) { this.colWidths.set(c, w) }

  addMerge(r: number, c: number, rows: number, cols: number) {
    this.merges.push({ r, c, rows, cols })
  }
}
