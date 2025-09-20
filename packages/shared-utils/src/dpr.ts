// Returns the device pixel ratio, overridable for tests
export function getDPR(): number {
  if (typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number') {
    return Math.max(1, Math.min(4, window.devicePixelRatio))
  }
  return 1
}

// Resize canvas to account for DPR to keep crisp rendering
export function resizeCanvasForDPR(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  dpr = getDPR(),
): CanvasRenderingContext2D {
  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}
