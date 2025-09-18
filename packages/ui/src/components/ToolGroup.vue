<script setup lang="ts">
// Simple group wrapper to arrange tool items horizontally or vertically
const props = withDefaults(defineProps<{ direction?: 'horizontal' | 'vertical'; gap?: number }>(), {
  direction: 'horizontal',
  gap: 8,
})
</script>

<template>
  <div class="tool-group" :class="props.direction" :style="{ '--gap': (props.gap + 'px') }">
    <slot />
  </div>
</template>

<style scoped>
.tool-group { display: inline-flex; align-items: center; gap: var(--gap); }
.tool-group.vertical { flex-direction: column; align-items: center; }
</style>

