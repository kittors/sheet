<script setup lang="ts">
import { withDefaults, defineProps } from 'vue'

const props = withDefaults(
  defineProps<{
    color: string
    // Icon render size hint (purely visual; icon itself controls its own size)
    size?: number
    // Swatch dimensions in px
    swatchWidth?: number
    swatchHeight?: number
    radius?: number
    // Gap below the icon in px (swatch sits slightly below the icon box)
    offsetY?: number
    // Fine-tune horizontal offset in px (rarely needed)
    offsetX?: number
  }>(),
  {
    size: 18,
    swatchWidth: 12,
    swatchHeight: 5,
    radius: 4,
    offsetY: 3,
    offsetX: -2,
  },
)
</script>

<template>
  <span class="ci-wrap" :style="{ width: props.size + 'px', height: props.size + 'px' }">
    <span class="ci-icon">
      <slot />
    </span>
    <span
      class="ci-swatch"
      :style="{
        width: props.swatchWidth + 'px',
        height: props.swatchHeight + 'px',
        background: props.color,
        borderRadius: props.radius + 'px',
        bottom: '-' + props.offsetY + 'px',
        transform: 'translateX(calc(-50% + ' + props.offsetX + 'px))',
      }"
    />
  </span>
</template>

<style scoped>
.ci-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  line-height: 0;
}
.ci-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}
.ci-icon :where(svg) {
  display: block;
}
.ci-swatch {
  position: absolute;
  left: 50%;
  /* sits just below the icon box; fine-tuned with offsetY */
  transform: translateX(-50%);
  border: 1px solid #e5e7eb; /* subtle border as requested */
  box-sizing: border-box;
  pointer-events: none;
}
</style>
