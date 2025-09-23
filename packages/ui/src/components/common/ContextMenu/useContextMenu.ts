import { nextTick, reactive, ref } from 'vue'
import type { MenuItem, OpenContext } from './types'

export function useContextMenu() {
  const isOpen = ref(false)
  const position = reactive({ x: 0, y: 0 })
  const ctx: OpenContext = reactive({ triggerEvent: null })
  const rootEl = ref<HTMLElement | null>(null)
  const mainMenuEl = ref<HTMLElement | null>(null)
  const activePath = ref<number[]>([])

  function filterHidden(items: MenuItem[], c: OpenContext): MenuItem[] {
    return items
      .filter((it) => {
        if (typeof it.hidden === 'function') return !it.hidden(c)
        return !it.hidden
      })
      .map((it) => ({ ...it, children: it.children ? filterHidden(it.children, c) : undefined }))
  }

  function isDisabled(item: MenuItem): boolean {
    // Separators are not interactive by definition
    if (item.seperator) return true
    const d = item.disabled
    return typeof d === 'function' ? d(ctx) : !!d
  }

  function hasChildren(item: MenuItem): boolean {
    return !!(item.children && item.children.length)
  }

  function getItemsAtLevel(level: number, root: MenuItem[]): MenuItem[] {
    let cur: MenuItem[] = root
    for (let i = 0; i < level; i++) {
      const idx = activePath.value[i]
      const parent = cur[idx]
      cur = parent?.children ?? []
    }
    return cur
  }

  function setActiveIndex(level: number, index: number) {
    activePath.value.splice(level, activePath.value.length - level, index)
  }

  function nextEnabledIndex(items: MenuItem[], start: number): number {
    for (let i = start; i < items.length; i++) {
      if (!isDisabled(items[i])) return i
    }
    return -1
  }

  function prevEnabledIndex(items: MenuItem[], start: number): number {
    for (let i = Math.min(start, items.length - 1); i >= 0; i--) {
      if (!isDisabled(items[i])) return i
    }
    return -1
  }

  function tryOpenChild(level: number, root: MenuItem[]) {
    const items = getItemsAtLevel(level, root)
    const idx = activePath.value[level]
    const item = items[idx]
    if (item && item.children && item.children.length) {
      const first = nextEnabledIndex(item.children, 0)
      activePath.value.push(first === -1 ? 0 : first)
    }
  }

  function adjustMainMenuPosition() {
    const el = mainMenuEl.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    let x = position.x
    let y = position.y
    const pad = 4
    if (x + rect.width > window.innerWidth - pad) {
      x = Math.max(pad, window.innerWidth - rect.width - pad)
    }
    if (y + rect.height > window.innerHeight - pad) {
      y = Math.max(pad, window.innerHeight - rect.height - pad)
    }
    position.x = x
    position.y = y
  }

  async function openAt(x: number, y: number, event: MouseEvent | null = null, items: MenuItem[]) {
    position.x = x
    position.y = y
    ctx.triggerEvent = event
    isOpen.value = true
    const visible = filterHidden(items, ctx)
    const first = nextEnabledIndex(visible, 0)
    activePath.value = [first]
    await nextTick()
    adjustMainMenuPosition()
  }

  function close() {
    if (!isOpen.value) return
    isOpen.value = false
    activePath.value = []
  }

  return {
    isOpen,
    position,
    ctx,
    rootEl,
    mainMenuEl,
    activePath,
    filterHidden,
    isDisabled,
    hasChildren,
    getItemsAtLevel,
    setActiveIndex,
    nextEnabledIndex,
    prevEnabledIndex,
    tryOpenChild,
    adjustMainMenuPosition,
    openAt,
    close,
  }
}
