<script setup lang="ts">
// Generic Tool Item for toolbar
// Supports three label modes: bottom (default if label provided), right, none
const props = withDefaults(defineProps<{
  label?: string
  labelPosition?: 'bottom' | 'right' | 'none'
  ariaLabel?: string
  disabled?: boolean
}>(), {
  labelPosition: 'bottom',
  disabled: false,
})
const emit = defineEmits<{ (e: 'click', ev: MouseEvent): void }>()
function onClick(ev: MouseEvent) { if (!props.disabled) emit('click', ev) }
</script>

<template>
  <button
    type="button"
    class="tool-item"
    :class="[
      props.label ? (props.labelPosition === 'right' ? 'pos-right' : (props.labelPosition === 'none' ? 'pos-none' : 'pos-bottom')) : (props.labelPosition === 'right' ? 'pos-right' : (props.labelPosition === 'none' ? 'pos-none' : 'pos-bottom')),
      { disabled: props.disabled }
    ]"
    :aria-label="ariaLabel || label"
    @click="onClick"
  >
    <span class="icon"><slot /></span>
    <span v-if="label && labelPosition !== 'none'" class="label">{{ label }}</span>
  </button>
</template>

<style scoped>
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
</style>

