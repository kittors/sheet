import { Sheet } from './sheet'

export class Workbook {
  sheets: Sheet[] = []
  activeIndex = 0

  addSheet(name: string, rows: number, cols: number): Sheet {
    const s = new Sheet(name, rows, cols)
    this.sheets.push(s)
    return s
  }

  get active(): Sheet | undefined { return this.sheets[this.activeIndex] }
}
