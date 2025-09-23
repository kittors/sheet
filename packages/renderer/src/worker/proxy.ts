import { exportSheet, type Sheet, type SheetOp, type Style } from '@sheet/core'
import type { RendererOptions } from '..'
import type { MeasureTextResult, WrapTextResult, CaretFromPointResult } from './protocol'
import type { FromWorker, ToWorker } from './protocol'

// Proxy object that mirrors the CanvasRenderer API and forwards to a worker
export class WorkerRenderer {
  private worker: Worker
  private lastViewportMetrics: any | null = null
  private lastScrollbars: any | null = null
  private pendingOps: SheetOp[] = []
  // Mirror CanvasRenderer public options so interaction can read metrics
  opts: RendererOptions
  private reqId = 1
  private pending = new Map<number, (data: any) => void>()

  constructor(canvas: HTMLCanvasElement, sheet: Sheet, opts: RendererOptions = {}) {
    const off = (canvas as any).transferControlToOffscreen?.()
    if (!off) throw new Error('OffscreenCanvas is not supported')
    // Resolve worker URL relative to this module
    // eslint-disable-next-line no-restricted-globals
    const url = new URL('./renderer-worker.ts', import.meta.url)
    this.worker = new Worker(url, { type: 'module' })
    this.worker.onmessage = (e: MessageEvent<any>) => {
      const msg = e.data
      if (msg.type === 'metrics') {
        this.lastViewportMetrics = msg.viewportMetrics
        this.lastScrollbars = msg.scrollbars
        return
      }
      if (
        msg.type === 'measureTextResult' ||
        msg.type === 'wrapTextResult' ||
        msg.type === 'caretFromPointResult'
      ) {
        const cb = this.pending.get(msg.id)
        if (cb) {
          this.pending.delete(msg.id)
          cb(msg)
        }
      }
    }
    const initMsg: ToWorker = {
      type: 'init',
      // @ts-ignore OffscreenCanvas structured clone
      canvas: off,
      opts,
      sheet: exportSheet(sheet),
      dpr: (globalThis as any).devicePixelRatio || 1,
    }
    this.worker.postMessage(initMsg, [off as any])
    // Instrument sheet to replicate ops into worker
    this.patchSheet(sheet)
    // Normalize and expose opts like CanvasRenderer does
    this.opts = {
      defaultRowHeight: opts.defaultRowHeight ?? 24,
      defaultColWidth: opts.defaultColWidth ?? 100,
      overscan: opts.overscan ?? 1,
      headerRowHeight: opts.headerRowHeight ?? 28,
      headerColWidth: opts.headerColWidth ?? 48,
      scrollbarThickness: opts.scrollbarThickness ?? 16,
      scrollbarThumbMinSize: opts.scrollbarThumbMinSize ?? 24,
      headerStyle: opts.headerStyle,
      headerLabels: opts.headerLabels,
    }

    // Ensure the worker receives a size immediately so first render isn't using default 300x150
    try {
      const rect = canvas.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width))
      const h = Math.max(1, Math.floor(rect.height))
      this.resize(w, h)
    } catch {}
  }

  private flushOps() {
    if (!this.pendingOps.length) return
    // Ensure ops are structured-cloneable (defensive deep copy)
    const safeOps = this.pendingOps.map((op) => {
      try {
        return JSON.parse(JSON.stringify(op))
      } catch {
        // Fallback: rebuild defineStyle payload shallowly; other ops are flat
        if ((op as any).type === 'defineStyle') {
          const st = (op as any).style || {}
          return {
            type: 'defineStyle',
            style: {
              id: st.id,
              font: st.font ? { ...st.font } : undefined,
              fill: st.fill ? { backgroundColor: st.fill.backgroundColor } : undefined,
              border: st.border
                ? {
                    top: st.border.top ? { ...st.border.top } : undefined,
                    bottom: st.border.bottom ? { ...st.border.bottom } : undefined,
                    left: st.border.left ? { ...st.border.left } : undefined,
                    right: st.border.right ? { ...st.border.right } : undefined,
                  }
                : undefined,
              alignment: st.alignment ? { ...st.alignment } : undefined,
            },
          }
        }
        return op
      }
    }) as any
    const msg: ToWorker = { type: 'applyOps', ops: safeOps }
    this.pendingOps.length = 0
    this.worker.postMessage(msg)
  }

  // Monkey-patch mutating methods to forward ops to worker
  private patchSheet(sheet: Sheet) {
    const self = this
    const orig = {
      setValue: sheet.setValue.bind(sheet),
      setCellStyle: sheet.setCellStyle.bind(sheet),
      setRowHeight: sheet.setRowHeight.bind(sheet),
      setColWidth: sheet.setColWidth.bind(sheet),
      addMerge: sheet.addMerge.bind(sheet),
      removeMergeAt: sheet.removeMergeAt.bind(sheet),
      defineStyle: sheet.defineStyle.bind(sheet),
    }
    sheet.setValue = function (r: number, c: number, value: any) {
      orig.setValue(r, c, value)
      self.pendingOps.push({ type: 'setValue', r, c, value })
    } as any
    sheet.setCellStyle = function (r: number, c: number, styleId: number) {
      orig.setCellStyle(r, c, styleId)
      self.pendingOps.push({ type: 'setCellStyle', r, c, styleId })
    } as any
    sheet.setRowHeight = function (r: number, h: number) {
      orig.setRowHeight(r, h)
      self.pendingOps.push({ type: 'setRowHeight', r, h })
    } as any
    sheet.setColWidth = function (c: number, w: number) {
      orig.setColWidth(c, w)
      self.pendingOps.push({ type: 'setColWidth', c, w })
    } as any
    sheet.addMerge = function (r: number, c: number, rows: number, cols: number) {
      const ok = orig.addMerge(r, c, rows, cols)
      if (ok) self.pendingOps.push({ type: 'addMerge', r, c, rows, cols })
      return ok
    } as any
    sheet.removeMergeAt = function (r: number, c: number) {
      const ok = orig.removeMergeAt(r, c)
      if (ok) self.pendingOps.push({ type: 'removeMergeAt', r, c })
      return ok
    } as any
    sheet.defineStyle = function (styleIn: Omit<Style, 'id'>) {
      const id = orig.defineStyle(styleIn)
      // Registry holds full style (with id) now
      const st = sheet.getStyle(id)!
      self.pendingOps.push({ type: 'defineStyle', style: st })
      return id
    } as any
  }

  resize(width: number, height: number) {
    const msg: ToWorker = { type: 'resize', width, height }
    this.worker.postMessage(msg)
  }

  setDpr(dpr: number) {
    const msg: ToWorker = { type: 'setDpr', dpr }
    this.worker.postMessage(msg)
  }

  render(_sheet: Sheet, scrollX: number, scrollY: number, mode: 'full' | 'ui' = 'full') {
    // apply accumulated ops then render
    this.flushOps()
    if (mode === 'ui') {
      const msg: ToWorker = { type: 'renderUiOnly', scrollX, scrollY } as any
      this.worker.postMessage(msg)
    } else {
      const msg: ToWorker = { type: 'render', scrollX, scrollY }
      this.worker.postMessage(msg)
    }
  }

  renderUiOnly(_sheet: Sheet, scrollX: number, scrollY: number) {
    this.flushOps()
    const msg: ToWorker = { type: 'renderUiOnly', scrollX, scrollY } as any
    this.worker.postMessage(msg)
  }

  setSelection(sel?: { r0: number; c0: number; r1: number; c1: number }, anchor?: { r: number; c: number }) {
    const msg: ToWorker = { type: 'setSelection', sel, anchor }
    this.worker.postMessage(msg)
  }
  setGuides(g?: { v?: number; h?: number }) {
    const msg: ToWorker = { type: 'setGuides', guides: g }
    this.worker.postMessage(msg)
  }
  getViewportMetrics() {
    return this.lastViewportMetrics
  }
  getScrollbars() {
    return this.lastScrollbars
  }
  setScrollbarState(state: Partial<{ vHover: boolean; hHover: boolean; vActive: boolean; hActive: boolean }>) {
    const msg: ToWorker = { type: 'setScrollbarState', state }
    this.worker.postMessage(msg)
  }
  setHeaderStyle(style: any) {
    const msg: ToWorker = { type: 'setHeaderStyle', style }
    this.worker.postMessage(msg)
  }
  setHeaderLabels(labels?: any) {
    const msg: ToWorker = { type: 'setHeaderLabels', labels }
    this.worker.postMessage(msg)
  }
  setEditor(editor?: any) {
    const msg: ToWorker = { type: 'setEditor', editor }
    this.worker.postMessage(msg)
  }

  // Text measurement RPCs for IME/layout on main thread
  async measureText(text: string, font?: Style['font'], defaultSize = 14): Promise<number> {
    const id = this.reqId++
    const msg: ToWorker = { type: 'measureText', id, text, font, defaultSize } as any
    return new Promise<number>((resolve) => {
      this.pending.set(id, (res: MeasureTextResult) => resolve(res.width))
      this.worker.postMessage(msg)
    })
  }
  async wrapTextIndices(
    text: string,
    maxWidth: number,
    font?: Style['font'],
    defaultSize = 14,
  ): Promise<Array<{ start: number; end: number }>> {
    const id = this.reqId++
    const msg: ToWorker = { type: 'wrapText', id, text, maxWidth, font, defaultSize } as any
    return new Promise((resolve) => {
      this.pending.set(id, (res: WrapTextResult) => resolve(res.lines))
      this.worker.postMessage(msg)
    })
  }

  async caretIndexFromPoint(
    text: string,
    relX: number,
    relY: number,
    opts: { maxWidth: number; font?: Style['font']; defaultSize?: number; lineHeight?: number },
  ): Promise<number> {
    const id = this.reqId++
    const msg: ToWorker = { type: 'caretFromPoint', id, text, relX, relY, opts } as any
    return new Promise<number>((resolve) => {
      this.pending.set(id, (res: CaretFromPointResult) => resolve(res.caret))
      this.worker.postMessage(msg)
    })
  }
}

export function createWorkerRenderer(canvas: HTMLCanvasElement, sheet: Sheet, opts?: RendererOptions) {
  return new WorkerRenderer(canvas, sheet, opts)
}
