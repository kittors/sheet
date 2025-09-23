// Message protocol between main thread proxy and renderer worker
import type { HeaderLabels, HeaderStyle, RendererOptions, CanvasRenderer, ViewportMetrics } from '..'
import type { SerializedSheet, SheetOp } from '@sheet/core'
import type { Style } from '@sheet/core'

export type InitMsg = {
  type: 'init'
  canvas: OffscreenCanvas
  opts: RendererOptions
  sheet: SerializedSheet
  dpr: number
}

export type ResizeMsg = { type: 'resize'; width: number; height: number }
export type SetDprMsg = { type: 'setDpr'; dpr: number }
export type RenderMsg = { type: 'render'; scrollX: number; scrollY: number }
export type RenderUiOnlyMsg = { type: 'renderUiOnly'; scrollX: number; scrollY: number }
export type SetSelectionMsg = {
  type: 'setSelection'
  sel?: { r0: number; c0: number; r1: number; c1: number }
  anchor?: { r: number; c: number }
}
export type SetGuidesMsg = { type: 'setGuides'; guides?: { v?: number; h?: number } }
export type SetScrollbarStateMsg = {
  type: 'setScrollbarState'
  state: Partial<{ vHover: boolean; hHover: boolean; vActive: boolean; hActive: boolean }>
}
export type SetHeaderStyleMsg = { type: 'setHeaderStyle'; style: Partial<HeaderStyle> }
export type SetHeaderLabelsMsg = { type: 'setHeaderLabels'; labels?: HeaderLabels }
export type SetEditorMsg = {
  type: 'setEditor'
  editor?: {
    r: number
    c: number
    text: string
    caret: number
    caretVisible: boolean
    selAll?: boolean
    selStart?: number
    selEnd?: number
  }
}
export type ApplyOpsMsg = { type: 'applyOps'; ops: SheetOp[] }

export type ToWorker =
  | InitMsg
  | ResizeMsg
  | SetDprMsg
  | RenderMsg
  | RenderUiOnlyMsg
  | SetSelectionMsg
  | SetGuidesMsg
  | SetScrollbarStateMsg
  | SetHeaderStyleMsg
  | SetHeaderLabelsMsg
  | SetEditorMsg
  | ApplyOpsMsg
  | MeasureTextMsg
  | WrapTextMsg

export type MetricsMsg = {
  type: 'metrics'
  viewportMetrics: ViewportMetrics | null
  scrollbars: CanvasRenderer['lastScrollbars'] | null
}

export type FromWorker = MetricsMsg

// Text measurement RPC
export type MeasureTextMsg = {
  type: 'measureText'
  id: number
  text: string
  font?: Style['font']
  defaultSize?: number
}
export type MeasureTextResult = { type: 'measureTextResult'; id: number; width: number }

export type WrapTextMsg = {
  type: 'wrapText'
  id: number
  text: string
  maxWidth: number
  font?: Style['font']
  defaultSize?: number
}
export type WrapTextResult = {
  type: 'wrapTextResult'
  id: number
  lines: Array<{ start: number; end: number }>
}

export type CaretFromPointMsg = {
  type: 'caretFromPoint'
  id: number
  text: string
  relX: number
  relY: number
  opts: { maxWidth: number; font?: Style['font']; defaultSize?: number; lineHeight?: number }
}
export type CaretFromPointResult = { type: 'caretFromPointResult'; id: number; caret: number }
