<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'

const props = withDefaults(
  defineProps<{
    visible: boolean
    title?: string
    movable?: boolean
    maskColor?: string
    closeOnMask?: boolean
    width?: number
    zIndex?: number
    showHeader?: boolean
    showClose?: boolean
  }>(),
  {
    movable: true,
    maskColor: 'rgba(0,0,0,0.25)',
    closeOnMask: true,
    width: 360,
    zIndex: 2000,
    showHeader: true,
    showClose: true,
  },
)

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'open'): void
  (e: 'close'): void
  (e: 'cancel'): void
}>()

const open = ref(false)
const winRef = ref<HTMLDivElement | null>(null)
const pos = ref({ x: 0, y: 0 })

watch(
  () => props.visible,
  async (v) => {
    open.value = v
    if (v) {
      await nextTick()
      centerWindow()
      emit('open')
    } else emit('close')
  },
  { immediate: true },
)

onMounted(() => {
  if (props.visible) centerWindow()
})

function centerWindow() {
  const w = winRef.value
  if (!w) return
  const ww = window.innerWidth
  const wh = window.innerHeight
  const bw = w.offsetWidth || (props.width ?? 360)
  const bh = w.offsetHeight || 240
  pos.value.x = Math.max(8, Math.floor((ww - bw) / 2))
  pos.value.y = Math.max(8, Math.floor((wh - bh) / 2))
}

let dragging = false
let dx = 0
let dy = 0
function onHeaderDown(e: MouseEvent) {
  if (!props.movable) return
  const el = winRef.value
  if (!el) return
  dragging = true
  dx = e.clientX - pos.value.x
  dy = e.clientY - pos.value.y
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
  e.preventDefault()
}
function onMove(e: MouseEvent) {
  if (!dragging) return
  const el = winRef.value
  if (!el) return
  const ww = window.innerWidth
  const wh = window.innerHeight
  const bw = el.offsetWidth
  const bh = el.offsetHeight
  let x = e.clientX - dx
  let y = e.clientY - dy
  const pad = 4
  x = Math.max(pad, Math.min(ww - bw - pad, x))
  y = Math.max(pad, Math.min(wh - bh - pad, y))
  pos.value.x = x
  pos.value.y = y
}
function onUp() {
  dragging = false
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseup', onUp)
}

function close(v = false) {
  emit('update:visible', v)
}
function onMaskClick() {
  if (props.closeOnMask) {
    emit('cancel')
    close(false)
  }
}
</script>

<template>
  <Transition name="ui-fade-mask">
    <div
      v-if="open"
      class="md-mask"
      :style="{ background: props.maskColor, zIndex: props.zIndex }"
      @mousedown.self="onMaskClick"
    >
      <Transition name="ui-modal-pop">
        <div
          ref="winRef"
          class="md-window"
          :style="{
            left: pos.x + 'px',
            top: pos.y + 'px',
            width: (props.width || 360) + 'px',
            zIndex: (props.zIndex || 2000) + 1,
          }"
        >
          <div
            v-if="props.showHeader"
            class="md-header"
            :class="{ movable: props.movable }"
            @mousedown="onHeaderDown"
          >
            <slot name="header" :close="close">
              <span class="title">{{ props.title }}</span>
              <button v-if="props.showClose" class="xbtn" type="button" @click="close(false)">
                ×
              </button>
            </slot>
          </div>
          <div class="md-body">
            <slot :close="close" />
          </div>
          <div class="md-footer">
            <slot name="footer" :close="close" />
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.md-mask {
  position: fixed;
  inset: 0;
}
.md-window {
  position: fixed;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  box-shadow: var(--panel-shadow);
}
.md-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid var(--color-neutral-100);
  cursor: default;
  user-select: none;
}
.md-header.movable {
  cursor: move;
}
.title {
  font-size: 13px;
  color: var(--text);
}
.xbtn {
  border: 0;
  background: transparent;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.md-body {
  padding: 10px 12px 4px 12px;
}
.md-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 12px 12px 12px;
}
</style>
