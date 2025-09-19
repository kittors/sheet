<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'
import ContextMenuItem from './ContextMenuItem.vue'
import { CTX_MENU_KEY, type CtxMenuApi, type MenuItem } from './types'

const props = defineProps<{ level: number; items: MenuItem[] }>()
const api = inject(CTX_MENU_KEY)!

const listEl = ref<HTMLElement | null>(null)
const openToLeft = ref(false)

onMounted(() => {
  const rect = listEl.value?.getBoundingClientRect()
  if (rect) openToLeft.value = rect.right + 220 > window.innerWidth
})
</script>

<template>
  <ul ref="listEl" class="ctx-list" role="menu" :aria-level="props.level">
    <li v-for="(item, index) in props.items" :key="String(item.id)" class="ctx-row">
      <div v-if="item.seperator && index > 0" class="ctx-sep" />
      <button
        class="ctx-item"
        :class="{ active: api.isActive(props.level, index), disabled: api.isDisabled(item), 'has-children': api.hasChildren(item) }"
        role="menuitem"
        :aria-disabled="api.isDisabled(item) || undefined"
        @mouseenter="(ev) => api.onItemMouseEnter(props.level, index, item, ev)"
        @click="(ev) => api.onItemClick(item, ev)"
      >
        <ContextMenuItem :item="item" :has-children="api.hasChildren(item)" />
      </button>
      <div v-if="api.isActive(props.level, index) && api.hasChildren(item)" class="ctx-submenu" :class="openToLeft ? 'left' : 'right'">
        <ContextMenuList :level="props.level + 1" :items="item.children || []" />
      </div>
    </li>
  </ul>
</template>
