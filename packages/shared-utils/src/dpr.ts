// Returns the device pixel ratio, overridable for tests
export function getDPR(): number {
  if (typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number') {
    return Math.max(1, Math.min(4, window.devicePixelRatio))
  }
  return 1
}

// Resize canvas to account for DPR to keep crisp rendering
export function resizeCanvasForDPR(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  width: number,
  height: number,
  dpr = getDPR(),
): CanvasRenderingContext2D {
  const w = Math.max(1, Math.floor(width * dpr))
  const h = Math.max(1, Math.floor(height * dpr))
  ;(canvas as any).width = w
  ;(canvas as any).height = h
  // Only HTMLCanvasElement has style
  if ((canvas as any).style) {
    ;(canvas as any).style.width = `${Math.max(1, Math.floor(width))}px`
    ;(canvas as any).style.height = `${Math.max(1, Math.floor(height))}px`
  }
  const ctx = (canvas as any).getContext('2d') as CanvasRenderingContext2D
  // In worker, dpr may be 1; still set transform to keep code path consistent
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}
