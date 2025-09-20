<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, useSlots } from 'vue'
import { ChevronDown, ChevronUp } from 'lucide-vue-next'
import type { Component } from 'vue'
// Generic Tool Item for toolbar with optional dropdown menu
const props = withDefaults(
  defineProps<{
    label?: string
    labelPosition?: 'bottom' | 'right' | 'none'
    ariaLabel?: string
    disabled?: boolean
    // Dropdown menu support
    menuItems?: Array<{ label: string; value: string; icon: Component }>
    modelValue?: string
    autoIcon?: boolean // when true and menuItems present, use selected item's icon as main icon
    alignMenu?: 'left' | 'right'
    // Split mode: main button triggers click; caret toggles menu
    split?: boolean
  }>(),
  {
    label: '',
    ariaLabel: '',
    labelPosition: 'bottom',
    disabled: false,
    menuItems: () => [],
    modelValue: '',
    autoIcon: true,
    alignMenu: 'left',
    split: false,
  },
)
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
  get() {
    return props.modelValue
  },
  set(v) {
    emit('update:modelValue', v || '')
  },
})

const activeItem = computed(
  () => props.menuItems?.find((i) => i.value === selected.value) || props.menuItems?.[0],
)
const activeIcon = computed<Component | null>(() =>
  props.autoIcon && hasMenu.value ? activeItem.value?.icon || null : null,
)

function onButtonClick(ev: MouseEvent) {
  if (props.disabled) return
  if (wantsMenu.value) {
    if (props.split) {
      // In split mode, main button behaves as a plain action
      emit('click', ev)
    } else {
      open.value = !open.value
    }
  } else {
    emit('click', ev)
  }
}

function onCaretClick(ev: MouseEvent) {
  if (props.disabled) return
  open.value = !open.value
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
function closeMenu() {
  open.value = false
}
onMounted(() => document.addEventListener('mousedown', onOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', onOutside))
</script>

<template>
  <div ref="root" class="tool-item-wrap" :class="{ 'has-menu': hasMenu }">
    <!-- Split mode: main action button + separate caret button -->
    <template v-if="props.split">
      <div class="tool-split">
        <button
        type="button"
        class="tool-item"
        :class="[
          props.label
            ? props.labelPosition === 'right'
              ? 'pos-right'
              : props.labelPosition === 'none'
                ? 'pos-none'
                : 'pos-bottom'
            : props.labelPosition === 'right'
              ? 'pos-right'
              : props.labelPosition === 'none'
                ? 'pos-none'
                : 'pos-bottom',
          { disabled: props.disabled },
        ]"
        :aria-label="ariaLabel || label"
        @click="onButtonClick"
      >
        <span class="icon">
          <component :is="activeIcon" v-if="activeIcon" :size="18" />
          <slot v-else />
        </span>
        <span v-if="label && labelPosition !== 'none'" class="label">{{ label }}</span>
        </button>
        <button
        v-if="wantsMenu"
        type="button"
        class="caret-btn"
        aria-haspopup="menu"
        :aria-expanded="open"
        @click.stop="onCaretClick"
      >
        <component :is="open ? ChevronUp : ChevronDown" class="caret" :size="14" />
      </button>
      </div>
    </template>

    <!-- Non-split mode: single button includes caret -->
    <button
      v-else
      type="button"
      class="tool-item"
      :class="[
        props.label
          ? props.labelPosition === 'right'
            ? 'pos-right'
            : props.labelPosition === 'none'
              ? 'pos-none'
              : 'pos-bottom'
          : props.labelPosition === 'right'
            ? 'pos-right'
            : props.labelPosition === 'none'
              ? 'pos-none'
              : 'pos-bottom',
        { disabled: props.disabled },
      ]"
      :aria-label="ariaLabel || label"
      :aria-expanded="!props.split && wantsMenu ? open : undefined"
      aria-haspopup="menu"
      @click="onButtonClick"
    >
      <span class="icon">
        <component :is="activeIcon" v-if="activeIcon" :size="18" />
        <slot v-else />
      </span>
      <span v-if="label && labelPosition !== 'none'" class="label">{{ label }}</span>
      <component v-if="wantsMenu" :is="open ? ChevronUp : ChevronDown" class="caret" :size="14" />
    </button>
    <Transition name="ui-fade-scale">
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
    </Transition>
  </div>
</template>

<style scoped>
.tool-item-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 2px; /* small gap between main and caret when split */
}
.tool-item {
  border: 0;
  background: transparent;
  border-radius: 10px;
  color: #4b5563; /* icon/text color (lucide follows currentColor) */
  cursor: pointer;
}
.tool-item:hover {
  background: rgba(0, 0, 0, 0.06);
}
.tool-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Layout variants */
.pos-bottom {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 44px;
  padding: 4px 8px;
}
.pos-right {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 4px 8px;
}
.pos-none {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 4px;
  height: 24px;
  width: 28px;
  border-radius: 8px;
}

.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.label {
  font-size: 12px;
  color: #6b7280;
  line-height: 1;
}

.caret {
  margin-left: 4px;
  opacity: 0.7;
}
.caret-btn {
  border: 0;
  background: transparent;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.tool-item-wrap.has-menu > .tool-item.pos-none {
  width: auto;
  padding: 4px 6px;
}

/* Split group: join main and caret as a single control with unified hover */
.tool-split {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid transparent;
  border-radius: 10px;
  overflow: hidden; /* clip children corners */
}
.tool-split .caret { margin-left: 0; }
.tool-split:hover {
  background: rgba(0, 0, 0, 0.06);
  border-color: #e5e7eb;
}
.tool-split .tool-item,
.tool-split .caret-btn {
  background: transparent;
  border-radius: 0; /* corners handled by container */
}
.tool-split .caret-btn {
  border-left: 1px solid transparent;
  padding: 0 4px; /* bring caret closer to icon */
}
.tool-split:hover .caret-btn {
  border-left-color: rgba(0, 0, 0, 0.08);
}
.tool-split .tool-item:hover,
.tool-split .caret-btn:hover {
  background: transparent; /* container handles hover bg */
}

/* menu */
.ti-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 1000;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  min-width: 160px;
  padding: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}
.ti-menu.align-right {
  right: 0;
  left: auto;
}
.ti-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
  transition: background-color 0.12s ease;
}
.ti-item:hover {
  background: #f1f5ff;
}
.ti-item.active {
  background: #e8f1ff;
}
.ti-item:focus-visible {
  outline: 2px solid #cfe1ff;
  outline-offset: 2px;
}
</style>
