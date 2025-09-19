import type { State } from './types'

export function createState(): State {
  return {
    scroll: { x: 0, y: 0 },
    selection: undefined,
    selectAnchor: undefined,
    dragMode: 'none',
    dragGrabOffset: 0,
    raf: 0,
    autoRaf: 0,
    autoVX: 0,
    autoVY: 0,
    autoTargetVX: 0,
    autoTargetVY: 0,
    autoTs: 0,
    lastClientX: 0,
    lastClientY: 0,
  }
}
