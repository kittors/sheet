export type Canvas2DContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

function isHTMLCanvasElement(canvas: HTMLCanvasElement | OffscreenCanvas): canvas is HTMLCanvasElement {
  return typeof HTMLCanvasElement !== 'undefined' && canvas instanceof HTMLCanvasElement
}

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
): Canvas2DContext {
  const w = Math.max(1, Math.floor(width * dpr))
  const h = Math.max(1, Math.floor(height * dpr))
  canvas.width = w
  canvas.height = h
  if (isHTMLCanvasElement(canvas)) {
    canvas.style.width = `${Math.max(1, Math.floor(width))}px`
    canvas.style.height = `${Math.max(1, Math.floor(height))}px`
  }
  const ctx = canvas.getContext('2d') as Canvas2DContext | null
  if (!ctx) {
    throw new Error('Failed to acquire 2D canvas context')
  }
  // In worker, dpr may be 1; still set transform to keep code path consistent
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}
