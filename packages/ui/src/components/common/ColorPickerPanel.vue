<script setup lang="ts">
import { ref, watch, computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    width?: number
    height?: number
  }>(),
  {
    width: 220,
    height: 150,
  },
)
const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'change', v: string): void
}>()

type HSV = { h: number; s: number; v: number }

function clamp(n: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, n))
}
function hexToRgb(hex: string) {
  let s = hex.trim().replace(/^#/, '')
  if (s.length === 3)
    s = s
      .split('')
      .map((c) => c + c)
      .join('')
  const num = parseInt(s || '0', 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return { r, g, b }
}
function rgbToHex(r: number, g: number, b: number) {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const s = x.toString(16)
        return s.length === 1 ? '0' + s : s
      })
      .join('')
  )
}
function rgbToHsv(r: number, g: number, b: number): HSV {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
    else if (max === g) h = ((b - r) / d + 2) * 60
    else h = ((r - g) / d + 4) * 60
  }
  const s = max === 0 ? 0 : d / max
  const v = max
  return { h, s, v }
}
function hsvToRgb(h: number, s: number, v: number) {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0,
    g = 0,
    b = 0
  if (h >= 0 && h < 60) {
    r = c
    g = x
  } else if (h >= 60 && h < 120) {
    r = x
    g = c
  } else if (h >= 120 && h < 180) {
    g = c
    b = x
  } else if (h >= 180 && h < 240) {
    g = x
    b = c
  } else if (h >= 240 && h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}

const hsv = ref<HSV>({ h: 0, s: 0, v: 0 })

function setFromHex(hex: string) {
  const { r, g, b } = hexToRgb(hex || '#000000')
  hsv.value = rgbToHsv(r, g, b)
}
function hexFromHsv() {
  const { r, g, b } = hsvToRgb(hsv.value.h, hsv.value.s, hsv.value.v)
  return rgbToHex(r, g, b)
}

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return
    setFromHex(v)
  },
  { immediate: true },
)

function updateColor(trigger = true) {
  const hex = hexFromHsv()
  emit('update:modelValue', hex)
  if (trigger) emit('change', hex)
}

// SV area interactions
const svRef = ref<HTMLDivElement | null>(null)
function onSvDown(ev: MouseEvent | TouchEvent) {
  const isTouch = 'touches' in ev
  const start = isTouch ? ev.touches[0] : (ev as MouseEvent)
  moveAt(start.clientX, start.clientY)
  const onMove = (e: MouseEvent | TouchEvent) => {
    const p = 'touches' in e ? e.touches[0] : (e as MouseEvent)
    moveAt(p.clientX, p.clientY)
  }
  const onUp = () => {
    window.removeEventListener('mousemove', onMove as any)
    window.removeEventListener('touchmove', onMove as any)
    window.removeEventListener('mouseup', onUp)
    window.removeEventListener('touchend', onUp)
    updateColor(true)
  }
  window.addEventListener('mousemove', onMove as any)
  window.addEventListener('touchmove', onMove as any, { passive: false })
  window.addEventListener('mouseup', onUp)
  window.addEventListener('touchend', onUp)
  ev.preventDefault()
}
function moveAt(cx: number, cy: number) {
  const el = svRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const x = clamp((cx - r.left) / r.width)
  const y = clamp((cy - r.top) / r.height)
  hsv.value.s = x
  hsv.value.v = 1 - y
  updateColor(false)
}

// Hue slider
const hueRef = ref<HTMLDivElement | null>(null)
function onHueDown(ev: MouseEvent | TouchEvent) {
  const isTouch = 'touches' in ev
  const start = isTouch ? ev.touches[0] : (ev as MouseEvent)
  moveHue(start.clientX)
  const onMove = (e: MouseEvent | TouchEvent) => {
    const p = 'touches' in e ? e.touches[0] : (e as MouseEvent)
    moveHue(p.clientX)
  }
  const onUp = () => {
    window.removeEventListener('mousemove', onMove as any)
    window.removeEventListener('touchmove', onMove as any)
    window.removeEventListener('mouseup', onUp)
    window.removeEventListener('touchend', onUp)
    updateColor(true)
  }
  window.addEventListener('mousemove', onMove as any)
  window.addEventListener('touchmove', onMove as any, { passive: false })
  window.addEventListener('mouseup', onUp)
  window.addEventListener('touchend', onUp)
  ev.preventDefault()
}
function moveHue(cx: number) {
  const el = hueRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const x = clamp((cx - r.left) / r.width)
  hsv.value.h = x * 360
  updateColor(false)
}

const hueGradient =
  'linear-gradient(to right, rgb(255,0,0), rgb(255,255,0), rgb(0,255,0), rgb(0,255,255), rgb(0,0,255), rgb(255,0,255), rgb(255,0,0))'
const svBg = computed(() => {
  const { r, g, b } = hsvToRgb(hsv.value.h, 1, 1)
  return `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgb(${r},${g},${b}))`
})

const svDotStyle = computed(() => ({
  left: `calc(${hsv.value.s * 100}% - 7px)`,
  top: `calc(${(1 - hsv.value.v) * 100}% - 7px)`,
}))
const hueDotStyle = computed(() => ({ left: `calc(${(hsv.value.h / 360) * 100}% - 6px)` }))
</script>

<template>
  <div class="cpanel" :style="{ width: props.width + 'px' }">
    <div
      ref="svRef"
      class="sv"
      :style="{ background: svBg, height: props.height + 'px' }"
      @mousedown="onSvDown"
      @touchstart="onSvDown"
    >
      <div class="sv-dot" :style="svDotStyle" />
    </div>
    <div
      ref="hueRef"
      class="hue"
      :style="{ background: hueGradient }"
      @mousedown="onHueDown"
      @touchstart="onHueDown"
    >
      <div class="hue-dot" :style="hueDotStyle" />
    </div>
  </div>
</template>

<style scoped>
.cpanel {
  display: inline-flex;
  flex-direction: column;
  gap: 10px;
}
.sv {
  position: relative;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  cursor: crosshair;
}
.sv-dot {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3);
}
.hue {
  position: relative;
  height: 12px;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  cursor: pointer;
}
.hue-dot {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3);
  transform: translate(-50%, -50%);
}
</style>
