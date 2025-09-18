<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

export interface Option { label: string; value: string | number }
const props = withDefaults(defineProps<{ 
  modelValue?: string | number
  options: Option[]
  placeholder?: string
  width?: number
  join?: 'left' | 'right' | 'none'
}>(), {
  modelValue: '',
  placeholder: '',
  width: 0,
  join: 'none',
})
const emit = defineEmits<{ (e: 'update:modelValue', v: string | number): void; (e: 'select', opt: Option): void }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

function toggle() { open.value = !open.value }
function close() { open.value = false }
function onSelect(opt: Option) {
  emit('update:modelValue', opt.value)
  emit('select', opt)
  close()
}
function onOutside(e: MouseEvent) {
  if (!root.value) return
  if (!root.value.contains(e.target as Node)) close()
}
onMounted(() => document.addEventListener('mousedown', onOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', onOutside))

function displayLabel() {
  const v = props.modelValue
  const opt = props.options.find(o => o.value === v)
  return opt?.label ?? props.placeholder ?? ''
}
</script>

<template>
  <div ref="root" class="dd" :class="['join-' + join]" :style="{ width: (width ? width + 'px' : undefined) }">
    <button class="dd-btn" type="button" @click="toggle">
      <span class="dd-label">{{ displayLabel() }}</span>
      <ChevronDown :size="16" />
    </button>
    <div v-if="open" class="menu">
      <button
        v-for="opt in options"
        :key="String(opt.value)"
        class="item"
        :class="{ active: opt.value === modelValue }"
        :aria-selected="opt.value === modelValue"
        @click="onSelect(opt)"
      >{{ opt.label }}</button>
    </div>
  </div>
  
</template>

<style scoped>
.dd { position: relative; height: 28px; }
/* Make the button fill the specified width of the wrapper */
.dd-btn { width: 100%; height: 28px; padding: 0 8px; display: inline-flex; align-items: center; justify-content: space-between; gap: 6px; border: 1px solid #e5e7eb; background: #fff; border-radius: 8px; cursor: pointer; color: #111827 }
.dd-btn:hover { background: #f6f9ff; border-color: #cfe1ff }
.dd-label { font-size: 13px }
.menu { position: absolute; top: 32px; left: 0; z-index: 1000; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; width: 100%; min-width: 140px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); overflow: hidden; padding: 6px }
.item { display: block; width: 100%; text-align: left; padding: 8px 10px; border: 0; background: transparent; cursor: pointer; border-radius: 6px; transition: background-color .12s ease }
.item:hover { background: #f1f5ff }
.item.active { background: #e8f1ff }
.item:focus-visible { outline: 2px solid #cfe1ff; outline-offset: 2px }

/* Joined variant for two dropdowns紧密相连 */
.join-left .dd-btn { border-top-right-radius: 0; border-bottom-right-radius: 0; }
.join-right .dd-btn { border-top-left-radius: 0; border-bottom-left-radius: 0; border-left-color: #e5e7eb; margin-left: -1px; }
</style>
