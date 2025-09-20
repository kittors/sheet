<script setup lang="ts">
// Simple group wrapper to arrange tool items horizontally or vertically
// align controls cross-axis alignment (e.g., for vertical groups, left/center/right)
const props = withDefaults(
  defineProps<{
    direction?: 'horizontal' | 'vertical'
    gap?: number
    align?: 'start' | 'center' | 'end' | 'stretch'
  }>(),
  {
    direction: 'horizontal',
    gap: 0,
    align: 'center',
  },
)

function alignItemsValue(a: 'start' | 'center' | 'end' | 'stretch') {
  return a === 'start' ? 'flex-start' : a === 'end' ? 'flex-end' : a
}
</script>

<template>
  <div
    class="tool-group"
    :class="props.direction"
    :style="{ '--gap': props.gap + 'px', alignItems: alignItemsValue(props.align) }"
  >
    <slot />
  </div>
</template>

<style scoped>
.tool-group {
  display: inline-flex;
  align-items: center;
  gap: var(--gap);
}
.tool-group.vertical {
  flex-direction: column;
}
</style>
