<script setup lang="ts">
import { withDefaults, defineProps, defineOptions } from 'vue'

/**
 * IconWithSwatch
 * Small color swatch rendered under an icon (keeps the icon's original color).
 *
 * Usage:
 *  <IconWithSwatch :color="fillColor">
 *    <PaintBucket :size="18" />
 *  </IconWithSwatch>
 *
 * Notes:
 *  - This component does not tint the icon; it only shows a rounded swatch bar beneath it.
 *  - Use `offsetY`/`offsetX` for pixel-perfect alignment with different icon glyphs.
 */

export type IconWithSwatchProps = {
  /** Hex color (e.g. "#3b82f6") applied to the swatch bar */
  color: string
  /** Visual box size for the icon container (icon can still define its own size) */
  size?: number
  /** Swatch width in px */
  swatchWidth?: number
  /** Swatch height in px */
  swatchHeight?: number
  /** Swatch border radius in px */
  radius?: number
  /** Vertical offset in px below the icon box (positive pushes swatch down) */
  offsetY?: number
  /** Horizontal fine-tuning in px (positive moves swatch right) */
  offsetX?: number
}

defineOptions({ name: 'IconWithSwatch' })

const props = withDefaults(defineProps<IconWithSwatchProps>(), {
  size: 18,
  swatchWidth: 12,
  swatchHeight: 5,
  radius: 4,
  offsetY: 3,
  offsetX: -2,
})
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
