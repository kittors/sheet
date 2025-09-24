import type { Sheet } from '@sheet/core'
import type { CanvasRenderer } from '@sheet/renderer'

export type Selection = { r0: number; c0: number; r1: number; c1: number }

export type DragMode =
  | 'none'
  | 'select'
  // drag a text range inside the active editor
  | 'textselect'
  | 'vscroll'
  | 'hscroll'
  | 'colheader'
  | 'rowheader'
  | 'colresize'
  | 'rowresize'
  // drag freeze split lines from the corner handle
  | 'freezecol'
  | 'freezerow'

export interface AttachArgs {
  canvas: HTMLCanvasElement
  renderer: CanvasRenderer
  sheet: Sheet
  // Optional: native scroll host element that will drive smooth scrolling via scrollTop/Left.
  // When provided, wheel handling is disabled and we listen to 'scroll' on this host instead.
  // In the current UI, this is simply the parent element of the canvas (a hidden scroll container).
  scrollHost?: HTMLElement | null
  // Enable infinite scrolling behavior (rows/cols grow on demand)
  infiniteScroll?: boolean
}

export interface Context {
  canvas: HTMLCanvasElement
  renderer: CanvasRenderer
  sheet: Sheet
  infiniteScroll?: boolean
  metrics: {
    defaultColWidth: number
    defaultRowHeight: number
    headerColWidth: number
    headerRowHeight: number
    scrollbarThickness: number
    zoom: number
  }
}

export interface State {
  scroll: { x: number; y: number }
  selection?: Selection
  // anchor cell where a drag selection started (raw cell, not merged anchor)
  selectAnchor?: { r: number; c: number }
  // anchor caret index when starting a drag text-selection inside the editor
  textSelectAnchor?: number
  editor?: {
    r: number
    c: number
    text: string
    caret: number
    startText: string
    selAll?: boolean
    selStart?: number
    selEnd?: number
  }
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
  applyBorder(args: {
    mode: 'none' | 'all' | 'outside' | 'custom'
    color?: string
    width?: number
    style?: import('@sheet/core').BorderStyle
    sides?: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean }
  }): void
  setValueInSelection(text: string): void
  setColumnWidth(px: number): void
  setRowHeight(px: number): void
  mergeSelection(): void
  unmergeSelection(): void
  getFirstSelectedCell(): { r: number; c: number } | null
  getValueAt(r: number, c: number): string
  // font style operations
  applyFont(patch: Partial<import('@sheet/core').Font>): void
  // queries
  getSelection(): Selection | undefined
  getScroll(): { x: number; y: number }
  getZoom?(): number
  setZoom?(zoom: number): void
  // 命中测试：返回区域类别以及命中的单元格（如有）
  hitTest(
    clientX: number,
    clientY: number,
  ): { area: 'cell' | 'rowHeader' | 'colHeader' | 'outside'; cell?: { r: number; c: number } }
  // events
  onEditorChange?(
    cb: (e: {
      editing: boolean
      r: number
      c: number
      text: string
      caret: number
      selAll?: boolean
    }) => void,
  ): () => void
}
