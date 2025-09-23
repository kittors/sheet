<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    // Track length in px (available vertical space)
    length: number
    // Content/viewport sizes and current scrollTop
    content: number
    viewport: number
    scroll: number
    // Appearance
    thickness?: number
    minThumb?: number
    alwaysVisible?: boolean
  }>(),
  { thickness: 10, minThumb: 24, alwaysVisible: false },
)

const emit = defineEmits<{ (e: 'update:scroll', v: number): void }>()

const visible = computed(() => props.content > props.viewport + 1)
const trackLen = computed(() => Math.max(0, props.length))
const maxScroll = computed(() => Math.max(0, props.content - props.viewport))
const thumbSize = computed(() => {
  if (!visible.value) return 0
  const frac = Math.min(1, props.viewport / props.content)
  return Math.max(props.minThumb, Math.floor(trackLen.value * frac))
})
const maxPos = computed(() => Math.max(0, trackLen.value - thumbSize.value))
const thumbPos = computed(() => {
  if (!visible.value || maxScroll.value <= 0 || maxPos.value <= 0) return 0
  const ratio = props.scroll / maxScroll.value
  return Math.max(0, Math.min(maxPos.value, Math.floor(ratio * maxPos.value)))
})

let dragging = ref(false)
let dragOffset = 0 // pointer offset within thumb
let trackEl = ref<HTMLElement | null>(null)
let thumbEl = ref<HTMLElement | null>(null)

function pxToScroll(y: number) {
  const top = Math.max(0, Math.min(maxPos.value, y))
  if (maxPos.value <= 0) return 0
  return Math.floor((top / maxPos.value) * maxScroll.value)
}

function onThumbDown(e: PointerEvent) {
  if (!visible.value) return
  dragging.value = true
  thumbEl.value?.setPointerCapture(e.pointerId)
  const rect = thumbEl.value?.getBoundingClientRect()
  dragOffset = rect ? e.clientY - rect.top : 0
  e.preventDefault()
}
function onMove(e: PointerEvent) {
  if (!dragging.value || !visible.value) return
  const rect = trackEl.value?.getBoundingClientRect()
  if (!rect) return
  const y = e.clientY - rect.top - dragOffset
  emit('update:scroll', pxToScroll(y))
}
function onUp(e: PointerEvent) {
  if (!dragging.value) return
  try {
    thumbEl.value?.releasePointerCapture?.(e.pointerId)
  } catch (err) {
    void err
  }
  dragging.value = false
}

function onTrackDown(e: PointerEvent) {
  // Click on track pages to the click position (center thumb near click)
  if (!visible.value) return
  const rect = trackEl.value?.getBoundingClientRect()
  if (!rect) return
  const y = e.clientY - rect.top - Math.floor(thumbSize.value / 2)
  emit('update:scroll', pxToScroll(y))
}
</script>

<template>
  <div
    ref="trackEl"
    class="sbv-track"
    :style="{ width: thickness + 'px', height: length + 'px', opacity: (visible || alwaysVisible) ? 1 : 0.001 }"
    @pointerdown.self="onTrackDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
  >
    <div
      ref="thumbEl"
      class="sbv-thumb"
      :style="{ height: thumbSize + 'px', transform: `translateY(${thumbPos}px)` }"
      @pointerdown="onThumbDown"
    />
  </div>
</template>

<style scoped>
.sbv-track {
  position: absolute;
  top: 2px;
  right: 2px;
  bottom: auto;
  background: transparent;
  border-radius: 8px;
  pointer-events: auto;
  z-index: 1;
  transition: opacity 0.12s ease;
}
.sbv-thumb {
  position: relative;
  width: 100%;
  height: 100%;
  background: rgba(17, 24, 39, 0.25);
  border-radius: 8px;
  pointer-events: auto;
}
.sbv-thumb:hover { background: rgba(17, 24, 39, 0.35); }
.sbv-thumb:active { background: rgba(17, 24, 39, 0.45); }
</style>
