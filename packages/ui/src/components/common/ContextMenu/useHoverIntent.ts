import type { Ref } from 'vue'
import { pointInTriangle } from './geometry'
import type { MenuItem } from './types'

export function useHoverIntent(opts: {
  rootEl: Ref<HTMLElement | null>
  activePath: Ref<number[]>
  setActiveIndex: (level: number, index: number) => void
  isDisabled: (item: MenuItem) => boolean
}) {
  const hoverTimers = new Map<number, number>()
  const lastMouse = { x: 0, y: 0 }

  function clearAll() {
    for (const id of hoverTimers.values()) window.clearTimeout(id)
    hoverTimers.clear()
  }

  function onMouseMove(e: MouseEvent) {
    lastMouse.x = e.clientX
    lastMouse.y = e.clientY
  }

  function onItemMouseEnter(level: number, index: number, item: MenuItem, ev?: MouseEvent) {
    if (opts.isDisabled(item)) return
    const curIdx = opts.activePath.value[level]
    if (curIdx != null && curIdx !== index) {
      const delay = shouldDelaySwitch(level, ev)
      if (delay > 0) {
        const prev = hoverTimers.get(level)
        if (prev) window.clearTimeout(prev)
        const tid = window.setTimeout(() => opts.setActiveIndex(level, index), delay)
        hoverTimers.set(level, tid)
        return
      }
    }
    opts.setActiveIndex(level, index)
  }

  function shouldDelaySwitch(level: number, ev?: MouseEvent): number {
    const overlay = opts.rootEl.value
    if (!overlay) return 0
    const list = overlay.querySelector(`.ctx-list[aria-level="${level}"]`) as HTMLElement | null
    if (!list) return 0
    const activeBtn = list.querySelector('.ctx-item.active') as HTMLElement | null
    if (!activeBtn) return 0
    const row = activeBtn.closest('.ctx-row') as HTMLElement | null
    if (!row) return 0
    const submenu = row.querySelector(':scope > .ctx-submenu') as HTMLElement | null
    if (!submenu) return 0
    const r = row.getBoundingClientRect()
    const s = submenu.getBoundingClientRect()
    const cur = { x: (ev?.clientX ?? lastMouse.x), y: (ev?.clientY ?? lastMouse.y) }
    const openRight = s.left >= r.right
    const A = { x: openRight ? r.right : r.left, y: r.top }
    const B = { x: openRight ? s.left : s.right, y: s.top }
    const C = { x: openRight ? s.left : s.right, y: s.bottom }
    const inside = pointInTriangle(cur, A, B, C)
    return inside ? 180 : 0
  }

  return { onItemMouseEnter, onMouseMove, clearAll }
}

