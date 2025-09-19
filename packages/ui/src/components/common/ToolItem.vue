<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, useSlots } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import type { Component } from 'vue'
// Generic Tool Item for toolbar with optional dropdown menu
const props = withDefaults(defineProps<{ 
  label?: string
  labelPosition?: 'bottom' | 'right' | 'none'
  ariaLabel?: string
  disabled?: boolean
  // Dropdown menu support
  menuItems?: Array<{ label: string; value: string; icon: Component }>
  modelValue?: string
  autoIcon?: boolean // when true and menuItems present, use selected item's icon as main icon
  alignMenu?: 'left' | 'right'
}>(), {
  label: '',
  ariaLabel: '',
  labelPosition: 'bottom',
  disabled: false,
  menuItems: () => [],
  modelValue: '',
  autoIcon: true,
  alignMenu: 'left',
})
const emit = defineEmits<{
  (e: 'click', ev: MouseEvent): void
  (e: 'update:modelValue', v: string): void
  (e: 'select', payload: { label: string; value: string }): void
}>()

const slots = useSlots()
const hasMenu = computed(() => !!props.menuItems && props.menuItems.length > 0)
const wantsMenu = computed(() => hasMenu.value || !!slots.menu)
const open = ref(false)
const root = ref<HTMLElement | null>(null)

const selected = computed<string | undefined>({
  get() { return props.modelValue },
  set(v) { emit('update:modelValue', v || '') },
})

const activeItem = computed(() => props.menuItems?.find(i => i.value === selected.value) || props.menuItems?.[0])
const activeIcon = computed<Component | null>(() => props.autoIcon && hasMenu.value ? (activeItem.value?.icon || null) : null)

function onButtonClick(ev: MouseEvent) {
  if (props.disabled) return
  if (wantsMenu.value) {
    open.value = !open.value
  } else {
    emit('click', ev)
  }
}

function onSelect(item: { label: string; value: string }) {
  emit('update:modelValue', item.value)
  emit('select', { label: item.label, value: item.value })
  open.value = false
}

function onOutside(e: MouseEvent) {
  if (!open.value) return
  if (!root.value) return
  if (!root.value.contains(e.target as Node)) open.value = false
}
function closeMenu() { open.value = false }
onMounted(() => document.addEventListener('mousedown', onOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', onOutside))
</script>

<template>
  <div ref="root" class="tool-item-wrap" :class="{ 'has-menu': hasMenu }">
    <button
      type="button"
      class="tool-item"
      :class="[
        props.label ? (props.labelPosition === 'right' ? 'pos-right' : (props.labelPosition === 'none' ? 'pos-none' : 'pos-bottom')) : (props.labelPosition === 'right' ? 'pos-right' : (props.labelPosition === 'none' ? 'pos-none' : 'pos-bottom')),
        { disabled: props.disabled }
      ]"
      :aria-label="ariaLabel || label"
      :aria-expanded="wantsMenu ? open : undefined"
      aria-haspopup="menu"
      @click="onButtonClick"
    >
      <span class="icon">
        <component :is="activeIcon" v-if="activeIcon" :size="18" />
        <slot v-else />
      </span>
      <span v-if="label && labelPosition !== 'none'" class="label">{{ label }}</span>
      <ChevronDown v-if="wantsMenu" class="caret" :size="14" />
    </button>
    <div v-if="open && wantsMenu" class="ti-menu" :class="['align-' + alignMenu]">
      <template v-if="$slots.menu">
        <slot name="menu" :close="closeMenu" />
      </template>
      <template v-else>
        <button
          v-for="mi in props.menuItems"
          :key="mi.value"
          type="button"
          class="ti-item"
          :class="{ active: mi.value === selected }"
          @click="onSelect(mi)"
        >
          <component :is="mi.icon" :size="16" />
          <span class="txt">{{ mi.label }}</span>
        </button>
      </template>
    </div>
  </div>
  
</template>

<style scoped>
.tool-item-wrap { position: relative; display: inline-block; }
.tool-item {
  border: 0;
  background: transparent;
  border-radius: 10px;
  color: #4b5563; /* icon/text color (lucide follows currentColor) */
  cursor: pointer;
}
.tool-item:hover { background: rgba(0,0,0,0.06); }
.tool-item.disabled { opacity: .5; cursor: not-allowed }

/* Layout variants */
.pos-bottom { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; height: 44px; padding: 4px 8px; }
.pos-right { display: inline-flex; flex-direction: row; align-items: center; gap: 6px; height: 28px; padding: 4px 8px; }
.pos-none  { display: inline-flex; flex-direction: row; align-items: center; justify-content: center; padding: 4px; height: 24px; width: 28px; border-radius: 8px; }

.icon { display: inline-flex; align-items: center; justify-content: center; }
.label { font-size: 12px; color: #6b7280; line-height: 1; }

.caret { margin-left: 4px; opacity: .7 }
.tool-item-wrap.has-menu > .tool-item.pos-none { width: auto; padding: 4px 6px; }

/* menu */
.ti-menu { position: absolute; top: calc(100% + 6px); left: 0; z-index: 1000; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; min-width: 160px; padding: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
.ti-menu.align-right { right: 0; left: auto; }
.ti-item { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; padding: 8px 10px; border: 0; background: transparent; cursor: pointer; border-radius: 6px; transition: background-color .12s ease }
.ti-item:hover { background: #f1f5ff }
.ti-item.active { background: #e8f1ff }
.ti-item:focus-visible { outline: 2px solid #cfe1ff; outline-offset: 2px }
</style>
