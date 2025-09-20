<script setup lang="ts">
import { withDefaults, defineProps, defineEmits } from 'vue'

const props = withDefaults(
  defineProps<{
    colors: string[]
    value?: string
    columns?: number
    swatchSize?: number
    gap?: number
    moreLabel?: string
  }>(),
  {
    columns: 5,
    swatchSize: 24,
    gap: 6,
    moreLabel: '更多颜色',
  },
)

const emit = defineEmits<{
  (e: 'select', color: string): void
  (e: 'more'): void
}>()

function onSelect(c: string) {
  emit('select', c)
}
function onMore() {
  emit('more')
}
</script>

<template>
  <div
    class="cg-grid"
    :style="{
      gridTemplateColumns: `repeat(${props.columns}, ${props.swatchSize}px)`,
      gridAutoRows: props.swatchSize + 'px',
      gap: props.gap + 'px',
    }"
  >
    <button
      v-for="c in props.colors"
      :key="c"
      type="button"
      class="cg-swatch"
      :class="{ selected: props.value && c.toLowerCase() === String(props.value).toLowerCase() }"
      :style="{ background: c, width: props.swatchSize + 'px', height: props.swatchSize + 'px' }"
      :aria-label="c"
      @click="onSelect(c)"
    />
  </div>
  <button type="button" class="cg-more" @click="onMore">{{ props.moreLabel }}</button>
</template>

<style scoped>
.cg-grid {
  display: grid;
  margin-bottom: 6px;
}
.cg-swatch {
  display: inline-block;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  cursor: pointer;
}
.cg-swatch.selected {
  outline: 2px solid #3b82f6;
  outline-offset: 0;
}
.cg-more {
  display: inline-flex;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
}
.cg-more:hover {
  background: #f1f5ff;
}
</style>
