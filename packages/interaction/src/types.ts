import type { Sheet } from '@sheet/core'
import type { CanvasRenderer } from '@sheet/renderer'

export type Selection = { r0: number; c0: number; r1: number; c1: number }

export type DragMode =
  | 'none'
  | 'select'
  | 'vscroll'
  | 'hscroll'
  | 'colheader'
  | 'rowheader'
  | 'colresize'
  | 'rowresize'

export interface AttachArgs {
  canvas: HTMLCanvasElement
  renderer: CanvasRenderer
  sheet: Sheet
}

export interface Context {
  canvas: HTMLCanvasElement
  renderer: CanvasRenderer
  sheet: Sheet
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
  // auto-scroll while dragging selection near edges
  autoRaf: number
  autoVX: number
  autoVY: number
  autoTargetVX: number
  autoTargetVY: number
  autoTs: number
  // last pointer position (client coords)
  lastClientX: number
  lastClientY: number
  // resize state
  resize?: {
    kind: 'col' | 'row'
    index: number
    startClient: number // x for col, y for row in client coords
    startSize: number
  }
}

export interface InteractionHandle {
  destroy(): void
  // selection-aware operations
  applyTextColor(color: string): void
  applyFillColor(backgroundColor: string): void
  setValueInSelection(text: string): void
  setColumnWidth(px: number): void
  setRowHeight(px: number): void
  getFirstSelectedCell(): { r: number; c: number } | null
  getValueAt(r: number, c: number): string
  // queries
  getSelection(): Selection | undefined
  getScroll(): { x: number; y: number }
}
