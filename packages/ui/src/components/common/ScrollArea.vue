<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import VerticalScrollbar from './scrollbars/VerticalScrollbar.vue'
import HorizontalScrollbar from './scrollbars/HorizontalScrollbar.vue'

// A lightweight scroll container with custom vertical/horizontal scrollbars.
// Scrollbars are split into VerticalScrollbar and HorizontalScrollbar for reuse.
const props = withDefaults(
  defineProps<{
    maxHeight?: number | string
    maxWidth?: number | string
    scrollbar?: 'vertical' | 'horizontal' | 'both'
    thickness?: number
    thumbMinSize?: number
    alwaysVisible?: boolean
  }>(),
  {
    scrollbar: 'both',
    thickness: 10,
    thumbMinSize: 24,
    alwaysVisible: false,
  },
)

const root = ref<HTMLElement | null>(null)
const viewport = ref<HTMLDivElement | null>(null)

const showV = ref(false)
const showH = ref(false)
const vScroll = ref(0)
const hScroll = ref(0)

const styleWrapper = computed(() => {
  const st: Record<string, string> = { position: 'relative' }
  if (props.maxHeight !== undefined) st.maxHeight = toPx(props.maxHeight)
  if (props.maxWidth !== undefined) st.maxWidth = toPx(props.maxWidth)
  return st
})

function toPx(v: number | string) {
  return typeof v === 'number' ? `${v}px` : v
}

function updateGeometry() {
  const el = viewport.value
  if (!el) return
  const canV = props.scrollbar === 'both' || props.scrollbar === 'vertical'
  const canH = props.scrollbar === 'both' || props.scrollbar === 'horizontal'
  showV.value = canV && el.scrollHeight > el.clientHeight + 1
  showH.value = canH && el.scrollWidth > el.clientWidth + 1
  // Keep reactive scroll positions so thumbs update even when only scroll changes
  vScroll.value = el.scrollTop
  hScroll.value = el.scrollLeft
}

let onResizeObs: ResizeObserver | null = null
function attach() {
  const el = viewport.value
  if (!el) return
  el.addEventListener('scroll', updateGeometry, { passive: true })
  onResizeObs = new ResizeObserver(() => updateGeometry())
  onResizeObs.observe(el)
  // Also observe content size changes
  for (const n of Array.from(el.childNodes)) if (n instanceof Element) onResizeObs.observe(n)
  updateGeometry()
}
function detach() {
  const el = viewport.value
  if (el) el.removeEventListener('scroll', updateGeometry)
  onResizeObs?.disconnect()
  onResizeObs = null
}
onMounted(() => nextTick(attach))
onBeforeUnmount(detach)
watch(() => [props.maxHeight, props.maxWidth, props.scrollbar], () => nextTick(updateGeometry))
</script>

<template>
  <div ref="root" class="sa" :style="styleWrapper">
    <div ref="viewport" class="sa-viewport">
      <slot />
    </div>
    <!-- Vertical scrollbar (composed) -->
    <VerticalScrollbar
      v-if="showV || alwaysVisible"
      :length="(viewport?.clientHeight || 0) - (showH ? thickness : 0)"
      :content="viewport?.scrollHeight || 0"
      :viewport="viewport?.clientHeight || 0"
      :scroll="vScroll"
      :thickness="thickness"
      :min-thumb="thumbMinSize"
      :always-visible="alwaysVisible"
      @update:scroll="(v) => { if (viewport) viewport.scrollTop = v }"
    />
    <!-- Horizontal scrollbar (composed) -->
    <HorizontalScrollbar
      v-if="showH || alwaysVisible"
      :length="(viewport?.clientWidth || 0) - (showV ? thickness : 0)"
      :content="viewport?.scrollWidth || 0"
      :viewport="viewport?.clientWidth || 0"
      :scroll="hScroll"
      :thickness="thickness"
      :min-thumb="thumbMinSize"
      :always-visible="alwaysVisible"
      @update:scroll="(v) => { if (viewport) viewport.scrollLeft = v }"
    />
  </div>
  
</template>

<style scoped>
.sa {
  position: relative;
  width: 100%;
}
.sa-viewport {
  position: relative;
  overflow: auto;
  max-height: inherit; /* ensure viewport honors wrapper's max-height */
  max-width: inherit;
  /* Leave a bit of breathing room so the thumbs don't cover clickable content */
  padding-right: 6px;
  padding-bottom: 6px;
  /* Hide native scrollbars, keep momentum */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE 10+ */
}
.sa-viewport::-webkit-scrollbar {
  display: none; /* WebKit */
  width: 0;
  height: 0;
}
/* Scrollbar tracks and thumbs are now inside the split components */
</style>
