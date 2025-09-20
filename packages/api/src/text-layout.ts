import type { Style } from '@sheet/core'

// Shared text layout helpers for editing and content rendering.
// Centralizes font string building, wrapping, ellipsis, and caret mapping.

let measureCtx: CanvasRenderingContext2D | null = null
function getCtx(): CanvasRenderingContext2D {
  if (measureCtx) return measureCtx
  // try OffscreenCanvas first (no DOM requirement)
  try {
    // @ts-ignore
    const osc = new OffscreenCanvas(1, 1)
    // @ts-ignore
    measureCtx = osc.getContext('2d') as CanvasRenderingContext2D
    if (measureCtx) return measureCtx
  } catch {}
  // fallback to DOM canvas
  const c = document.createElement('canvas')
  measureCtx = c.getContext('2d')!
  return measureCtx
}

export function fontStringFromStyle(font?: Style['font'], defaultSize = 14): string {
  const size = font?.size ?? defaultSize
  const family =
    font?.family ?? 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
  const weight = font?.bold ? 'bold' : 'normal'
  const italic = font?.italic ? 'italic ' : ''
  return `${italic}${weight} ${size}px ${family}`
}

export function measureText(text: string, font?: Style['font'], defaultSize = 14): number {
  const ctx = getCtx()
  ctx.font = fontStringFromStyle(font, defaultSize)
  return ctx.measureText(text).width
}

export function wrapTextIndices(
  text: string,
  maxWidth: number,
  font?: Style['font'],
  defaultSize = 14,
): Array<{ start: number; end: number }> {
  // Break text into visual lines that fit within maxWidth, honoring explicit newlines ("\n").
  // The returned segments are [start, end) index pairs into the original string. Newline characters
  // are not included in any segment; consecutive newlines yield zero-length segments.
  const ctx = getCtx()
  ctx.font = fontStringFromStyle(font, defaultSize)
  const lines: Array<{ start: number; end: number }> = []
  const n = text.length
  let base = 0
  while (base <= n) {
    // find next newline (or end of string)
    const nl = text.indexOf('\n', base)
    const paraEnd = nl === -1 ? n : nl
    const paraText = text.slice(base, paraEnd)
    if (paraText.length === 0) {
      // explicit blank line (e.g., consecutive \n or leading/trailing \n)
      lines.push({ start: base, end: base })
    } else {
      // wrap paragraph by width
      let i = 0
      const m = paraText.length
      while (i < m) {
        let lo = i + 1,
          hi = m
        while (lo <= hi) {
          const mid = Math.min(m, Math.max(i + 1, Math.floor((lo + hi) / 2)))
          const seg = paraText.slice(i, mid)
          const w = ctx.measureText(seg).width
          if (w <= maxWidth) lo = mid + 1
          else hi = mid - 1
        }
        const k = Math.max(i + 1, hi)
        lines.push({ start: base + i, end: base + k })
        i = k
      }
    }
    if (nl === -1) break
    // move past the newline character; caret positions may land at this index
    base = paraEnd + 1
    // If newline is at end of string, ensure we emit a trailing blank line
    if (base === n + 1) lines.push({ start: n, end: n })
  }
  return lines
}

export function caretIndexFromPoint(
  text: string,
  relX: number,
  relY: number,
  opts: { maxWidth: number; font?: Style['font']; defaultSize?: number; lineHeight?: number },
): number {
  const defaultSize = opts.defaultSize ?? 14
  const ctx = getCtx()
  ctx.font = fontStringFromStyle(opts.font, defaultSize)
  const lh = opts.lineHeight ?? Math.max(12, Math.round((opts.font?.size ?? defaultSize) * 1.25))
  const lines = wrapTextIndices(text, opts.maxWidth, opts.font, defaultSize)
  const lineIdx = Math.max(0, Math.min(lines.length - 1, Math.floor(relY / lh)))
  const seg = lines[lineIdx]
  let acc = 0
  let caret = seg.start
  for (let i = seg.start; i < seg.end; i++) {
    const w = ctx.measureText(text[i]).width
    if (acc + w / 2 >= relX) {
      caret = i
      break
    }
    acc += w
    caret = i + 1
  }
  return caret
}

export function ellipsize(
  text: string,
  maxWidth: number,
  font?: Style['font'],
  defaultSize = 14,
): string {
  const ctx = getCtx()
  ctx.font = fontStringFromStyle(font, defaultSize)
  if (ctx.measureText(text).width <= maxWidth) return text
  const ell = '...'
  let lo = 0,
    hi = text.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    const w = ctx.measureText(text.slice(0, mid) + ell).width
    if (w <= maxWidth) lo = mid + 1
    else hi = mid
  }
  const n = Math.max(0, lo - 1)
  return text.slice(0, n) + ell
}
