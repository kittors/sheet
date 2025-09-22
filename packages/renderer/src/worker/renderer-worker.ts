/// <reference lib="webworker" />
import { CanvasRenderer } from '..'
import { importSheet, applySheetOp, type SerializedSheet } from '@sheet/core'
import type {
  ToWorker,
  FromWorker,
  MeasureTextMsg,
  MeasureTextResult,
  WrapTextMsg,
  WrapTextResult,
  CaretFromPointMsg,
  CaretFromPointResult,
} from './protocol'
import {
  measureText as measureTextFn,
  wrapTextIndices as wrapTextFn,
  caretIndexFromPoint as caretFromPointFn,
} from '@sheet/api'

let renderer: CanvasRenderer | null = null
let sheet: ReturnType<typeof importSheet> | null = null

function postMetrics() {
  const viewportMetrics = renderer?.getViewportMetrics?.() ?? null
  // @ts-ignore private but stable snapshot for hit-testing
  const scrollbars = renderer?.getScrollbars?.() ?? null
  const msg: FromWorker = { type: 'metrics', viewportMetrics, scrollbars }
  // eslint-disable-next-line no-restricted-globals
  ;(self as any).postMessage(msg)
}

// eslint-disable-next-line no-restricted-globals
self.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data
  if (msg.type === 'init') {
    const { canvas, opts, sheet: snap, dpr } = msg
    sheet = importSheet(snap as SerializedSheet)
    // @ts-ignore 2D ctx
    renderer = new CanvasRenderer(canvas as any, { ...opts, dpr })
    return
  }
  if (!renderer || !sheet) return
  switch (msg.type) {
    case 'measureText': {
      const m = msg as MeasureTextMsg
      const width = measureTextFn(m.text, m.font as any, m.defaultSize ?? 14)
      const res: MeasureTextResult = { type: 'measureTextResult', id: m.id, width }
      ;(self as any).postMessage(res)
      break
    }
    case 'wrapText': {
      const m = msg as WrapTextMsg
      const lines = wrapTextFn(m.text, m.maxWidth, m.font as any, m.defaultSize ?? 14)
      const res: WrapTextResult = { type: 'wrapTextResult', id: m.id, lines }
      ;(self as any).postMessage(res)
      break
    }
    case 'caretFromPoint': {
      const m = msg as CaretFromPointMsg
      const caret = caretFromPointFn(m.text, m.relX, m.relY, m.opts as any)
      const res: CaretFromPointResult = { type: 'caretFromPointResult', id: m.id, caret }
      ;(self as any).postMessage(res)
      break
    }
    case 'setDpr':
      // Recreate DPR transform by resizing with same logical size
      ;(renderer as any).dpr = msg.dpr
      // Keep current logical size (viewport width/height in CSS px)
      const vm = renderer.getViewportMetrics?.()
      const w = vm?.viewportWidth ?? 0
      const h = vm?.viewportHeight ?? 0
      if (w && h) renderer.resize(w, h)
      break
    case 'resize':
      renderer.resize(msg.width, msg.height)
      break
    case 'setSelection':
      renderer.setSelection(msg.sel, msg.anchor)
      break
    case 'setGuides':
      renderer.setGuides(msg.guides)
      break
    case 'setScrollbarState':
      renderer.setScrollbarState(msg.state)
      break
    case 'setHeaderStyle':
      renderer.setHeaderStyle(msg.style)
      break
    case 'setHeaderLabels':
      renderer.setHeaderLabels(msg.labels)
      break
    case 'setEditor':
      renderer.setEditor(msg.editor)
      break
    case 'applyOps':
      for (const op of msg.ops) applySheetOp(sheet, op)
      break
    case 'render':
      renderer.render(sheet, msg.scrollX, msg.scrollY)
      postMetrics()
      break
    case 'renderUiOnly':
      renderer.render(sheet, msg.scrollX, msg.scrollY, 'ui')
      postMetrics()
      break
  }
}
