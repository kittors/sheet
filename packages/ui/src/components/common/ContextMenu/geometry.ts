export function pointInTriangle(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
) {
  const s1 = cross(a, b, p)
  const s2 = cross(b, c, p)
  const s3 = cross(c, a, p)
  const hasNeg = s1 < 0 || s2 < 0 || s3 < 0
  const hasPos = s1 > 0 || s2 > 0 || s3 > 0
  return !(hasNeg && hasPos)
}

export function cross(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}
