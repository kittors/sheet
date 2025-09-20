export interface PointerConfig {
  resize: {
    minCol: number
    minRow: number
    hitMargin: number // px threshold for resize hover/hit
  }
  autoScroll: {
    edgeMargin: number // px soft zone near edges
    maxV: number // px per frame at 60fps
    ease: number // [0,1] easing toward target velocity each frame
    stopThreshold: number // velocity threshold to consider 0
    dtClampMin: number // min frame factor for dt smoothing
    dtClampMax: number // max frame factor for dt smoothing
  }
  cursor: {
    defaultCursor: string
    pointerCursor: string
    colResizeCursor: string
    rowResizeCursor: string
    hoverPointerOnScrollbar: boolean
  }
}

export const defaultPointerConfig: PointerConfig = {
  resize: { minCol: 30, minRow: 16, hitMargin: 4 },
  autoScroll: {
    edgeMargin: 48,
    maxV: 24,
    ease: 0.2,
    stopThreshold: 0.1,
    dtClampMin: 0.5,
    dtClampMax: 2,
  },
  cursor: {
    defaultCursor: 'default',
    pointerCursor: 'pointer',
    colResizeCursor: 'col-resize',
    rowResizeCursor: 'row-resize',
    hoverPointerOnScrollbar: true,
  },
}
