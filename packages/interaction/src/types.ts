import type { Sheet } from '@sheet/core'
import type { CanvasRenderer } from '@sheet/renderer'

export type Selection = { r0: number; c0: number; r1: number; c1: number }

export type DragMode = 'none' | 'select' | 'vscroll' | 'hscroll' | 'colheader' | 'rowheader'

export interface AttachArgs {
  canvas: HTMLCanvasElement
  renderer: CanvasRenderer
  sheet: Sheet
  debug?: boolean
}

export interface Context {
  canvas: HTMLCanvasElement
  renderer: CanvasRenderer
  sheet: Sheet
  debug: boolean
  metrics: {
    defaultColWidth: number
    defaultRowHeight: number
    headerColWidth: number
    headerRowHeight: number
    scrollbarThickness: number
  }
}

export interface State {
  scroll: { x: number; y: number }
  selection?: Selection
  dragMode: DragMode
  dragGrabOffset: number
  raf: number
}

export interface InteractionHandle {
  destroy(): void
  // selection-aware operations
  applyTextColor(color: string): void
  applyFillColor(backgroundColor: string): void
  setValueInSelection(text: string): void
  getFirstSelectedCell(): { r: number; c: number } | null
  getValueAt(r: number, c: number): string
}

