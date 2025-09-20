// Pixel snapping helpers for crisp canvas strokes at any devicePixelRatio.
// Align stroke centers differently for odd/even line widths:
// - odd line widths (1, 3, …) should be centered on .5 coordinates
// - even line widths (2, 4, …) should be centered on integer coordinates

/** Return a snapped coordinate for a stroke center given desired logical coordinate and line width. */
export function snapCoord(coord: number, lineWidth: number): number {
  const lw = Math.max(1, Math.floor(lineWidth || 1))
  const offset = (lw & 1) === 1 ? 0.5 : 0
  return Math.floor(coord) + offset
}

/**
 * Compute snapped rectangle parameters suitable for ctx.rect(x, y, w, h)
 * so that all four edges render crisply for the given line width.
 *
 * left/top/right/bottom are logical coordinates (CSS pixels) before snapping.
 */
export function snappedRect(
  left: number,
  top: number,
  right: number,
  bottom: number,
  lineWidth: number,
): { x: number; y: number; w: number; h: number } {
  const lw = Math.max(1, Math.floor(lineWidth || 1))
  const offset = (lw & 1) === 1 ? 0.5 : 0
  const x0 = Math.floor(left) + offset
  const y0 = Math.floor(top) + offset
  // For odd lw we need to shrink span by 1 to keep opposite edges on .5 coords
  const shrink = offset ? 1 : 0
  const w = Math.max(0, Math.floor(right) - Math.floor(left) - shrink)
  const h = Math.max(0, Math.floor(bottom) - Math.floor(top) - shrink)
  return { x: x0, y: y0, w, h }
}

/** Stroke a crisp rectangle with the given style. Assumes current ctx state is configured. */
export function strokeCrispRect(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  right: number,
  bottom: number,
  lineWidth: number,
): void {
  const { x, y, w, h } = snappedRect(left, top, right, bottom, lineWidth)
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.stroke()
}

