<script setup lang="ts">
import { computed } from 'vue'
import ZoomControl from './ZoomControl.vue'

const props = defineProps<{
  zoom: number
  minZoom?: number
  maxZoom?: number
  step?: number
  presets?: number[]
}>()

const emit = defineEmits<{
  (e: 'update:zoom', value: number): void
}>()

const min = computed(() => props.minZoom ?? 20)
const max = computed(() => props.maxZoom ?? 400)
const step = computed(() => props.step ?? 10)

function onUpdate(value: number) {
  emit('update:zoom', value)
}
</script>

<template>
  <footer class="sheet-footer">
    <div class="footer-content">
      <div class="spacer"></div>
      <ZoomControl
        :model-value="zoom"
        :min="min"
        :max="max"
        :step="step"
        :presets="presets"
        @update:model-value="onUpdate"
      />
    </div>
  </footer>
</template>

<style scoped>
.sheet-footer {
  background: #f7f7f8;
  border-top: 1px solid #e5e7eb;
  padding: 4px 10px;
  min-height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.footer-content {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.spacer {
  flex: 1;
}
</style>
