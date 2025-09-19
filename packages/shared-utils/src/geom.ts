// Geometry helpers shared across renderer/interaction layers

// Compute cumulative left offset of a column index given default width and overrides
export function colLeftFor(
  index: number,
  defaultColWidth: number,
  colWidths: Map<number, number>,
): number {
  let base = index * defaultColWidth
  if (colWidths && colWidths.size) {
    for (const [c, w] of colWidths) {
      if (c < index) base += w - defaultColWidth
    }
  }
  return base
}

// Compute cumulative top offset of a row index given default height and overrides
export function rowTopFor(
  index: number,
  defaultRowHeight: number,
  rowHeights: Map<number, number>,
): number {
  let base = index * defaultRowHeight
  if (rowHeights && rowHeights.size) {
    for (const [r, h] of rowHeights) {
      if (r < index) base += h - defaultRowHeight
    }
  }
  return base
}
