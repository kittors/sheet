<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import ColorPickerPanel from './ColorPickerPanel.vue'

const props = withDefaults(
  defineProps<{
    visible: boolean
    color: string
    movable?: boolean
    maskColor?: string
    title?: string
    closeOnMask?: boolean
    width?: number
  }>(),
  {
    movable: true,
    maskColor: 'rgba(0,0,0,0.25)',
    title: '选择颜色',
    closeOnMask: true,
    width: 260,
  },
)
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'update:color', v: string): void
  (e: 'confirm', v: string): void
  (e: 'cancel'): void
}>()

const open = ref(false)
const localColor = ref<string>(props.color)
watch(
  () => props.visible,
  async (v) => {
    open.value = v
    if (v) {
      localColor.value = props.color
      // Wait for DOM to render the window, then center accurately
      await nextTick()
      centerWindow()
    }
  },
  { immediate: true },
)
watch(
  () => props.color,
  (v) => {
    if (!open.value) localColor.value = v
  },
)

const winRef = ref<HTMLDivElement | null>(null)
const pos = ref({ x: 0, y: 0 })
function centerWindow() {
  const w = winRef.value
  if (!w) return
  const ww = window.innerWidth
  const wh = window.innerHeight
  const bw = w.offsetWidth || 300
  const bh = w.offsetHeight || 240
  pos.value.x = Math.max(8, Math.floor((ww - bw) / 2))
  pos.value.y = Math.max(8, Math.floor((wh - bh) / 2))
}
onMounted(centerWindow)

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
  open.value = v
}
function onMaskClick() {
  if (props.closeOnMask) {
    emit('cancel')
    close(false)
  }
}
function onCancel() {
  emit('cancel')
  close(false)
}
function onConfirm() {
  emit('update:color', localColor.value)
  emit('confirm', localColor.value)
  close(false)
}
</script>

<template>
  <div
    v-if="open"
    class="cpd-mask"
    :style="{ background: props.maskColor }"
    @mousedown.self="onMaskClick"
  >
    <div
      ref="winRef"
      class="cpd-window"
      :style="{ left: pos.x + 'px', top: pos.y + 'px', width: props.width + 'px' }"
    >
      <div class="cpd-header" :class="{ movable: props.movable }" @mousedown="onHeaderDown">
        <span class="title">{{ props.title }}</span>
        <button class="xbtn" type="button" @click="onCancel">×</button>
      </div>
      <div class="cpd-body">
        <ColorPickerPanel v-model="localColor" @change="(c) => (localColor = c)" />
      </div>
      <div class="cpd-actions">
        <button type="button" class="btn" @click="onCancel">取消</button>
        <button type="button" class="btn primary" @click="onConfirm">确定</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpd-mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
}
.cpd-window {
  position: fixed;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.12);
}
.cpd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid #f1f5f9;
  cursor: default;
  user-select: none;
}
.cpd-header.movable {
  cursor: move;
}
.title {
  font-size: 13px;
  color: #374151;
}
.xbtn {
  border: 0;
  background: transparent;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.cpd-body {
  padding: 10px 12px 4px 12px;
}
.cpd-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 12px 12px 12px;
}
.btn {
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
}
.btn.primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
</style>
