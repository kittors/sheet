export interface Font {
  family?: string
  size?: number
  color?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

export type BorderStyle = 'solid' | 'dashed' | 'dotted'

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
  alignment?: { horizontal?: 'left' | 'center' | 'right'; vertical?: 'top' | 'middle' | 'bottom'; wrapText?: boolean }
}

export interface Cell {
  value?: string | number | boolean | null
  styleId?: number
}
