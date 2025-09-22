export interface Font {
  family?: string
  size?: number
  color?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  // Whether to draw a horizontal strike through the text (deletion mark)
  strikethrough?: boolean
}

// Border style; 'none' is an explicit suppression that wins over neighbor borders on shared edges
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'none'

export interface BorderSide {
  color?: string
  style?: BorderStyle
  width?: number
}

export interface Style {
  id: number
  font?: Font
  fill?: { backgroundColor?: string }
  border?: { top?: BorderSide; bottom?: BorderSide; left?: BorderSide; right?: BorderSide }
  alignment?: {
    horizontal?: 'left' | 'center' | 'right'
    vertical?: 'top' | 'middle' | 'bottom'
    // If true, renderer may wrap text within cell (future enhancement)
    wrapText?: boolean
    // Single-line overflow behavior when wrapText is false
    // 'overflow' (default): text may render beyond the cell if neighbors are empty
    // 'clip': text is clipped to the cell box
    // 'ellipsis': clipped with '...' appended
    overflow?: 'overflow' | 'clip' | 'ellipsis'
  }
}

export interface Cell {
  value?: string | number | boolean | null
  styleId?: number
}
