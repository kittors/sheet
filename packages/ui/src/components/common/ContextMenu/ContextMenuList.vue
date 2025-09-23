<script setup lang="ts">
import { inject, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import ContextMenuItem from './ContextMenuItem.vue'
import { CTX_MENU_KEY, type MenuItem } from './types'

const props = defineProps<{ level: number; items: MenuItem[] }>()
const api = inject(CTX_MENU_KEY)!

const listEl = ref<HTMLElement | null>(null)
const parentScrollEl = ref<HTMLElement | null>(null)
// Per-row refs for precise submenu placement
const rowRefs = ref<Record<number, HTMLElement | null>>({})
const submenuRefs = ref<Record<number, HTMLElement | null>>({})
// Placement state per row
const openLeftMap = ref<Record<number, boolean>>({})
const offsetTopMap = ref<Record<number, number>>({})
const leftMap = ref<Record<number, number>>({})

onMounted(() => {
  // track parent scrollable submenu (if any) to recompute child submenu placement on scroll
  parentScrollEl.value = (listEl.value?.closest('.ctx-submenu') as HTMLElement | null) ?? null
  parentScrollEl.value?.addEventListener('scroll', recomputeAll, { passive: true })
  window.addEventListener('resize', recomputeAll)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', recomputeAll)
  parentScrollEl.value?.removeEventListener('scroll', recomputeAll)
})

function setRowRef(index: number, el: Element | null) {
  rowRefs.value[index] = (el as HTMLElement) || null
}
function setSubmenuRef(index: number, el: Element | null) {
  submenuRefs.value[index] = (el as HTMLElement) || null
  if (el)
    nextTick(() => {
      computePlacement(index)
      requestAnimationFrame(() => computePlacement(index))
    })
}

function recomputeAll() {
  // Recompute placement for any active submenu refs we have stored
  for (const k of Object.keys(submenuRefs.value)) {
    const idx = Number(k)
    if (submenuRefs.value[idx]) computePlacement(idx)
  }
}

function computePlacement(index: number) {
  const row = rowRefs.value[index]
  const sm = submenuRefs.value[index]
  if (!row || !sm) return
  const pad = 4
  const r = row.getBoundingClientRect()
  const s = sm.getBoundingClientRect()
  // Decide horizontal placement using viewport coordinates
  const desiredLeft = r.right + pad
  const altLeft = r.left - s.width - pad
  const wouldOverflowRight = desiredLeft + s.width > window.innerWidth - pad
  openLeftMap.value[index] = wouldOverflowRight
  const rawLeft = wouldOverflowRight ? altLeft : desiredLeft
  const minLeft = pad
  const maxLeft = Math.max(pad, window.innerWidth - s.width - pad)
  const clampedLeft = Math.min(Math.max(rawLeft, minLeft), maxLeft)
  leftMap.value[index] = Math.round(clampedLeft)
  // Vertical: clamp submenu within viewport with small padding
  const desiredTop = r.top
  const minTop = pad
  const maxTop = Math.max(pad, window.innerHeight - s.height - pad)
  const clampedTop = Math.min(Math.max(desiredTop, minTop), maxTop)
  // Store absolute top in viewport coordinates
  offsetTopMap.value[index] = Math.round(clampedTop)
}
</script>

<template>
  <ul ref="listEl" class="ctx-list" role="menu" :aria-level="props.level">
    <li
      v-for="(item, index) in props.items"
      :key="String(item.id)"
      class="ctx-row"
      :ref="(el) => setRowRef(index, el as any)"
    >
      <!-- Pure separator row: when item is marked as seperator and carries no own content -->
      <template
        v-if="
          item.seperator &&
          !item.label &&
          !item.icon &&
          !(item.children && item.children.length) &&
          !item.customRender
        "
      >
        <div v-if="index > 0" class="ctx-sep" />
      </template>
      <template v-else>
        <div v-if="item.separatorBefore && index > 0" class="ctx-sep" />
        <button
          class="ctx-item"
          :class="{
            active: api.isActive(props.level, index),
            disabled: api.isDisabled(item),
            'has-children': api.hasChildren(item),
          }"
          role="menuitem"
          :aria-disabled="api.isDisabled(item) || undefined"
          @mouseenter="(ev) => api.onItemMouseEnter(props.level, index, item, ev)"
          @click="(ev) => api.onItemClick(item, ev)"
        >
          <ContextMenuItem :item="item" :has-children="api.hasChildren(item)" />
        </button>
        <Transition name="ui-fade-scale-sub">
          <div
            v-if="api.isActive(props.level, index) && api.hasChildren(item)"
            class="ctx-submenu"
            :style="{ top: (offsetTopMap[index] || 0) + 'px', left: (leftMap[index] || 0) + 'px' }"
            :ref="(el) => setSubmenuRef(index, el as any)"
          >
            <ContextMenuList :level="props.level + 1" :items="item.children || []" />
          </div>
        </Transition>
      </template>
    </li>
  </ul>
</template>
