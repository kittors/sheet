<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, watch } from 'vue'
import ContextMenuList from './ContextMenuList.vue'
import './styles.css'
import { useContextMenu } from './useContextMenu'
import { useHoverIntent } from './useHoverIntent'
import type { MenuItem, CtxMenuApi } from './types'
import { CTX_MENU_KEY } from './types'

const props = withDefaults(
  defineProps<{
    menuItems: MenuItem[]
    targetSelector?: string
    customClass?: string
    keepOpenOnClick?: boolean
    listenGlobal?: boolean
  }>(),
  {
    targetSelector: '',
    customClass: '',
    keepOpenOnClick: false,
    listenGlobal: false,
  },
)

const emit = defineEmits<{
  (e: 'open', ev: MouseEvent | null): void
  (e: 'close', ev: MouseEvent | null): void
  (e: 'select', id: string | number, ev: MouseEvent | KeyboardEvent | null): void
}>()

// Public API
defineExpose({ openAt, openWithEvent, close })

const cm = useContextMenu()
const visibleTree = computed(() => cm.filterHidden(props.menuItems, cm.ctx))
// 解构需要在模板中使用的响应式引用，避免模板中访问嵌套 ref 导致不解包
const isOpen = cm.isOpen
const rootEl = cm.rootEl
const mainMenuEl = cm.mainMenuEl
const position = cm.position

const { onItemMouseEnter, onMouseMove, clearAll } = useHoverIntent({
  rootEl: cm.rootEl,
  activePath: cm.activePath,
  setActiveIndex: cm.setActiveIndex,
  isDisabled: cm.isDisabled,
})

// Provide API to list/items
const api: CtxMenuApi = {
  isDisabled: cm.isDisabled,
  hasChildren: cm.hasChildren,
  isActive: (level, index) => cm.activePath.value[level] === index,
  onItemMouseEnter,
  onItemClick,
}
provide(CTX_MENU_KEY, api)

async function openAt(x: number, y: number, event: MouseEvent | null = null) {
  await cm.openAt(x, y, event, props.menuItems)
  emit('open', event)
}
function openWithEvent(ev: MouseEvent) {
  ev.preventDefault()
  openAt(ev.clientX, ev.clientY, ev)
}
function close(ev: MouseEvent | null = null) {
  if (!cm.isOpen.value) return
  cm.close()
  clearAll()
  emit('close', ev)
}

function onContextMenuCapture(e: MouseEvent) {
  const target = e.target as Element | null
  let matched = false
  if (props.targetSelector && target instanceof Element) {
    const el = target.closest(props.targetSelector)
    if (el) matched = true
  }
  if (props.listenGlobal && !matched) matched = true
  if (matched) openWithEvent(e)
}

function onGlobalMouseDown(e: MouseEvent) {
  if (!cm.isOpen.value) return
  const target = e.target as Element
  const inPanel = target && (target.closest('.ctx-menu') || target.closest('.ctx-submenu'))
  if (!inPanel) close(e)
}

function onGlobalKeydown(e: KeyboardEvent) {
  if (!cm.isOpen.value) return
  const key = e.key
  if (key === 'Escape') {
    e.preventDefault()
    close(null)
    return
  }
  const level = cm.activePath.value.length - 1
  const items = cm.getItemsAtLevel(level, visibleTree.value)
  if (!items.length) return
  const idx = cm.activePath.value[level] ?? -1
  if (key === 'ArrowDown') {
    e.preventDefault()
    const next = cm.nextEnabledIndex(items, idx + 1)
    if (next !== -1) cm.setActiveIndex(level, next)
  } else if (key === 'ArrowUp') {
    e.preventDefault()
    const prev = cm.prevEnabledIndex(items, idx - 1)
    if (prev !== -1) cm.setActiveIndex(level, prev)
  } else if (key === 'ArrowRight') {
    e.preventDefault()
    cm.tryOpenChild(level, visibleTree.value)
  } else if (key === 'ArrowLeft') {
    e.preventDefault()
    if (level > 0) cm.activePath.value.pop()
  } else if (key === 'Enter') {
    e.preventDefault()
    const item = items[idx]
    if (!item) return
    if (item.children && item.children.length) cm.tryOpenChild(level, visibleTree.value)
    else if (!cm.isDisabled(item)) handleSelect(item, e)
  }
}

async function handleSelect(item: MenuItem, ev: MouseEvent | KeyboardEvent) {
  emit('select', item.id, ev)
  if (item.action) await item.action({ id: item.id, event: ev })
  const hasKids = !!(item.children && item.children.length)
  const keep = item.keepOpen ?? props.keepOpenOnClick
  if (!keep && !hasKids) close(null)
}

function onItemClick(item: MenuItem, ev: MouseEvent) {
  ev.stopPropagation()
  if (cm.isDisabled(item)) return
  if (cm.hasChildren(item)) return
  handleSelect(item, ev)
}

onMounted(() => {
  document.addEventListener('mousedown', onGlobalMouseDown)
  document.addEventListener('keydown', onGlobalKeydown)
  document.addEventListener('mousemove', onMouseMove)
  if (props.targetSelector || props.listenGlobal) {
    document.addEventListener('contextmenu', onContextMenuCapture, true)
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onGlobalMouseDown)
  document.removeEventListener('keydown', onGlobalKeydown)
  document.removeEventListener('mousemove', onMouseMove)
  if (props.targetSelector || props.listenGlobal) {
    document.removeEventListener('contextmenu', onContextMenuCapture, true)
  }
})

watch(isOpen, async (v) => {
  if (v) {
    await nextTick()
    rootEl.value?.focus()
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="rootEl"
      class="ctx-overlay"
      :class="customClass"
      tabindex="0"
      @contextmenu.prevent
      @mousemove="onMouseMove"
    >
      <div
        ref="mainMenuEl"
        class="ctx-menu"
        :style="{ left: position.x + 'px', top: position.y + 'px' }"
      >
        <ContextMenuList :level="0" :items="visibleTree" />
      </div>
    </div>
  </Teleport>
</template>
