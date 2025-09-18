import { describe, it, expect } from 'vitest'
import { computeAvailViewport } from '../src/viewport'
import { applyVThumb, applyHThumb } from '../src/scrollbar'
import type { Context } from '../src/types'

function ctxStub(): Pick<Context, 'canvas' | 'sheet' | 'metrics'> {
  const canvas = { clientWidth: 300, clientHeight: 200 } as unknown as HTMLCanvasElement
  const sheet = {
    rows: 100,
    cols: 100,
    rowHeights: new Map<number, number>(),
    colWidths: new Map<number, number>(),
  } as unknown as Context['sheet']
  const metrics: Context['metrics'] = {
    defaultColWidth: 50,
    defaultRowHeight: 20,
    headerColWidth: 40,
    headerRowHeight: 40,
    scrollbarThickness: 12,
  }
  return { canvas, sheet, metrics }
}

describe('viewport sizing', () => {
  it('computes available viewport dimensions with scrollbars', () => {
    const ctx = ctxStub()
    const r = computeAvailViewport(ctx)
    // Base without scrollbars: 260x160. Both scrollbars visible -> subtract thickness from each
    expect(r.widthAvail).toBe(248)
    expect(r.heightAvail).toBe(148)
    expect(r.contentWidth).toBeGreaterThan(r.widthAvail)
    expect(r.contentHeight).toBeGreaterThan(r.heightAvail)
  })
})

describe('thumb application', () => {
  it('applies vertical and horizontal thumbs to state scroll', () => {
    const base = ctxStub()
    const trackSpanV = 100, thumbLenV = 50
    const trackSpanH = 120, thumbLenH = 40
    const ctx: Context = {
      ...base,
      // minimal stub for renderer
      renderer: {
        getScrollbars: () => ({
          vTrack: { x: 0, y: 0, w: 12, h: trackSpanV },
          vThumb: { x: 0, y: 0, w: 12, h: thumbLenV },
          hTrack: { x: 0, y: 0, w: trackSpanH, h: 12 },
          hThumb: { x: 0, y: 0, w: thumbLenH, h: 12 },
        }),
      } as unknown as Context['renderer'],
    }
    const state: { scroll: { x: number; y: number } } = { scroll: { x: 0, y: 0 } }

    // 50% of track (after accounting for thumb length)
    applyVThumb(ctx, state, (trackSpanV - thumbLenV) / 2)
    applyHThumb(ctx, state, (trackSpanH - thumbLenH) / 2)

    const { widthAvail, heightAvail, contentWidth, contentHeight } = computeAvailViewport(ctx)
    const maxX = Math.max(0, contentWidth - widthAvail)
    const maxY = Math.max(0, contentHeight - heightAvail)
    expect(state.scroll.x).toBeCloseTo(Math.floor(maxX / 2))
    expect(state.scroll.y).toBeCloseTo(Math.floor(maxY / 2))
  })
})
