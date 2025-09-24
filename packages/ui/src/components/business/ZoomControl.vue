<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { Plus, Minus, ChevronUp } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: number
  min?: number
  max?: number
  step?: number
  presets?: number[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

// Defaults tailored for 25–200%
const min = computed(() => Math.max(1, props.min ?? 25))
const max = computed(() => Math.max(min.value, props.max ?? 200))
const step = computed(() => Math.max(1, props.step ?? 5))
const clampedValue = computed(() => clamp(props.modelValue))
const isAtMin = computed(() => clampedValue.value <= min.value + 0.001)
const isAtMax = computed(() => clampedValue.value >= max.value - 0.001)

const presetList = computed(() => {
  const base = props.presets ?? [25, 50, 75, 100, 125, 150, 175, 200]
  return base
    .map((p) => clamp(p))
    .filter((p, idx, arr) => p >= min.value && p <= max.value && arr.indexOf(p) === idx)
    .sort((a, b) => a - b)
})

const showPresets = ref(false)
const menuRef = ref<HTMLDivElement | null>(null)

function clamp(v: number) {
  if (!Number.isFinite(v)) return min.value
  return Math.min(max.value, Math.max(min.value, Math.round(v)))
}
function update(next: number) {
  const target = clamp(next)
  emit('update:modelValue', target)
}
function adjust(delta: number) {
  update(clampedValue.value + delta)
}

function onSliderInput(e: Event) {
  const value = Number((e.target as HTMLInputElement).value)
  update(value)
}

function togglePresets() {
  showPresets.value = !showPresets.value
}

function closePresets() {
  showPresets.value = false
}

function onDocumentClick(e: MouseEvent) {
  if (!showPresets.value) return
  const menuEl = menuRef.value
  if (!menuEl) return
  if (!menuEl.contains(e.target as Node)) closePresets()
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick, true)
})

watch(
  () => props.modelValue,
  (val) => {
    if (!Number.isFinite(val)) emit('update:modelValue', clamp(min.value))
  },
)
</script>

<template>
  <div class="zoom-control" role="group" aria-label="Zoom controls">
    <!-- Left: percent with up-arrow trigger -->
    <button type="button" class="zoom-display" @click.stop="togglePresets" title="选择预设比例">
      <span class="zoom-text">{{ Math.round(clampedValue) }}%</span>
      <ChevronUp class="chevron" :size="12" />
    </button>

    <!-- Slider with - / + ends -->
    <button type="button" class="zoom-button icon" :disabled="isAtMin" @click.prevent="adjust(-step)" title="缩小">
      <Minus :size="12" />
    </button>
    <label class="sr-only" for="zoom-slider">缩放比例</label>
    <input
      id="zoom-slider"
      class="zoom-slider"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="clampedValue"
      @input="onSliderInput"
      title="调整缩放"
      aria-label="调整缩放"
    />
    <button type="button" class="zoom-button icon" :disabled="isAtMax" @click.prevent="adjust(step)" title="放大">
      <Plus :size="12" />
    </button>

    <!-- Presets menu: bottom->top ascending (small at bottom, large at top) -->
    <transition name="zoom-menu">
      <div v-if="showPresets && presetList.length" ref="menuRef" class="zoom-presets" role="menu">
        <div class="presets-scroll">
          <button
            v-for="preset in presetList"
            :key="preset"
            type="button"
            class="preset-item"
            @click.stop="update(preset); closePresets()"
          >
            {{ preset }}%
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* Layout */
.zoom-control { display: inline-flex; align-items: center; gap: 8px; position: relative; padding: 0 6px; }
.zoom-button.icon { width: 20px; height: 20px; border: 1px solid #e5e7eb; border-radius: 6px; background: #fff; color: #4b5563; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.zoom-button.icon:disabled { opacity: .45; cursor: not-allowed; }
.zoom-button.icon:not(:disabled):hover { background: #f3f4f6; }

/* Percent trigger */
.zoom-display { min-width: 58px; height: 22px; border: 1px solid #e5e7eb; border-radius: 6px; background: #fff; padding: 0 8px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; color: #111827; cursor: pointer; user-select: none; font-size: 12px; }
.zoom-display:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
.chevron { color: #6b7280; }

/* Slender custom range slider */
.zoom-slider { -webkit-appearance: none; appearance: none; width: 160px; height: 16px; background: transparent; cursor: pointer; }
/* Track */
.zoom-slider::-webkit-slider-runnable-track { height: 4px; background: #d1d5db; border-radius: 999px; }
.zoom-slider::-moz-range-track { height: 4px; background: #d1d5db; border-radius: 999px; }
/* Thumb: white circle with border and inner gray dot */
.zoom-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; margin-top: -6px; width: 16px; height: 16px; border-radius: 50%; background: radial-gradient(circle at center, #9ca3af 0 3px, #ffffff 3px); border: 1px solid #d1d5db; box-shadow: 0 0 0 1px rgba(0,0,0,0.02); }
.zoom-slider::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: radial-gradient(circle at center, #9ca3af 0 3px, #ffffff 3px); border: 1px solid #d1d5db; box-shadow: 0 0 0 1px rgba(0,0,0,0.02); }
/* Hover focus states */
.zoom-slider:focus { outline: none; }
.zoom-slider:focus::-webkit-slider-runnable-track { background: #cfd4da; }
.zoom-slider:focus::-moz-range-track { background: #cfd4da; }

/* Presets menu (opens upward); items ascending bottom->top */
.zoom-presets { position: absolute; bottom: 28px; left: 0; width: 110px; padding: 6px; border-radius: 8px; border: 1px solid #d1d5db; background: #fff; box-shadow: 0 10px 25px rgba(15,23,42,.12); z-index: 20; }
.presets-scroll { display: flex; flex-direction: column-reverse; gap: 4px; max-height: 240px; overflow: auto; }
.preset-item { width: 100%; border: none; background: transparent; border-radius: 6px; padding: 6px 8px; text-align: left; color: #1f2937; cursor: pointer; font-size: 12px; }
.preset-item:hover, .preset-item:focus { background: #f3f4f6; }
.zoom-menu-enter-active,
.zoom-menu-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
}
.zoom-menu-enter-from,
.zoom-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
