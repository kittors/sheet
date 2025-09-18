import type { Sheet } from '@sheet/core'
import type { VisibleRange } from '@sheet/shared-utils'

export interface Viewport {
  width: number
  height: number
}

export interface ScrollState {
  x: number
  y: number
}

export interface RenderContext {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  dpr: number
  viewport: Viewport
  // content origin offsets (to account for headers)
  originX: number
  originY: number
  scroll: ScrollState
  sheet: Sheet
  visible: VisibleRange
  defaultRowHeight: number
  defaultColWidth: number
  selection?: { r0: number; c0: number; r1: number; c1: number }
  // content metrics
  contentWidth: number
  contentHeight: number
  viewportContentWidth: number
  viewportContentHeight: number
  // scrollbar metrics (thickness)
  scrollbar: {
    thickness: number
    minThumbSize: number
    vTrack: { x: number; y: number; w: number; h: number } | null
    vThumb: { x: number; y: number; w: number; h: number } | null
    hTrack: { x: number; y: number; w: number; h: number } | null
    hThumb: { x: number; y: number; w: number; h: number } | null
  }
  // scrollbar interaction state (for hover/active styling)
  scrollbarState: {
    vHover: boolean
    hHover: boolean
    vActive: boolean
    hActive: boolean
  }
  // optional resize/guide lines to render (canvas coordinates)
  guides?: {
    v?: number // x of vertical guide line
    h?: number // y of horizontal guide line
  }
}

export interface Layer {
  name: string
  render(ctx: RenderContext): void
}
