import type { State } from './types'

export function createState(): State {
  return {
    scroll: { x: 0, y: 0 },
    selection: undefined,
    dragMode: 'none',
    dragGrabOffset: 0,
    raf: 0,
  }
}

