import type { Context } from '../types'
import type { Style } from '@sheet/core'

export type AsyncWrapText = (
  text: string,
  maxWidth: number,
  font?: Style['font'],
  defaultSize?: number,
) => Promise<Array<{ start: number; end: number }>>

export type AsyncMeasureText = (
  text: string,
  font?: Style['font'],
  defaultSize?: number,
) => Promise<number>

export type AsyncCaretFromPoint = (
  text: string,
  relX: number,
  relY: number,
  opts: { maxWidth: number; font?: Style['font']; defaultSize?: number; lineHeight?: number },
) => Promise<number>

export function getWorkerRenderer(renderer: Context['renderer']): {
  wrapTextIndices?: AsyncWrapText
  measureText?: AsyncMeasureText
  caretIndexFromPoint?: AsyncCaretFromPoint
} {
  const candidate = renderer as {
    wrapTextIndices?: AsyncWrapText
    measureText?: AsyncMeasureText
    caretIndexFromPoint?: AsyncCaretFromPoint
  }
  return {
    wrapTextIndices:
      typeof candidate.wrapTextIndices === 'function'
        ? candidate.wrapTextIndices.bind(renderer)
        : undefined,
    measureText:
      typeof candidate.measureText === 'function' ? candidate.measureText.bind(renderer) : undefined,
    caretIndexFromPoint:
      typeof candidate.caretIndexFromPoint === 'function'
        ? candidate.caretIndexFromPoint.bind(renderer)
        : undefined,
  }
}
