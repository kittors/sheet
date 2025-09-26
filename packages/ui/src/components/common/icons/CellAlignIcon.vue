<script setup lang="ts">
import { computed } from 'vue'

// Variants cover corner + axis alignments similar to Excel/WPS
type Variant =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'vertical-top'
  | 'vertical-middle'
  | 'vertical-bottom'
  | 'horizontal-left'
  | 'horizontal-center'
  | 'horizontal-right'

const props = withDefaults(defineProps<{ variant: Variant; size?: number | string }>(), {
  size: 18,
})

type Line = { x1: number; y1: number; x2: number; y2: number }

// Geometry tuned to look closer to Excel/WPS while keeping Lucide stroke style
// - Always draw 3 lines for visual consistency
// - For corner variants: lines are biased to that corner
// - For horizontal/vertical variants: bias only that axis, keep the other axis neutral
const L = 6 // inner left padding
const R = 18 // inner right padding
const T_TOP = [7, 9, 11]
const T_MID = [9, 12, 15]
const T_BOT = [13, 15, 17]

const lineMap: Record<Variant, Line[]> = {
  // Corners: combine horizontal + vertical bias
  'top-left': [
    { x1: L, y1: T_TOP[0], x2: 14, y2: T_TOP[0] },
    { x1: L, y1: T_TOP[1], x2: 12, y2: T_TOP[1] },
    { x1: L, y1: T_TOP[2], x2: 15, y2: T_TOP[2] },
  ],
  'top-right': [
    { x1: 10, y1: T_TOP[0], x2: R, y2: T_TOP[0] },
    { x1: 12, y1: T_TOP[1], x2: R, y2: T_TOP[1] },
    { x1: 9, y1: T_TOP[2], x2: R, y2: T_TOP[2] },
  ],
  'bottom-left': [
    { x1: L, y1: T_BOT[0], x2: 14, y2: T_BOT[0] },
    { x1: L, y1: T_BOT[1], x2: 12, y2: T_BOT[1] },
    { x1: L, y1: T_BOT[2], x2: 15, y2: T_BOT[2] },
  ],
  'bottom-right': [
    { x1: 10, y1: T_BOT[0], x2: R, y2: T_BOT[0] },
    { x1: 12, y1: T_BOT[1], x2: R, y2: T_BOT[1] },
    { x1: 9, y1: T_BOT[2], x2: R, y2: T_BOT[2] },
  ],

  // Vertical only: spread near top/middle/bottom, full-ish width
  'vertical-top': [
    { x1: L, y1: T_TOP[0], x2: R, y2: T_TOP[0] },
    { x1: L, y1: T_TOP[1], x2: R, y2: T_TOP[1] },
    { x1: L, y1: T_TOP[2], x2: R, y2: T_TOP[2] },
  ],
  'vertical-middle': [
    { x1: L, y1: T_MID[0], x2: R, y2: T_MID[0] },
    { x1: L, y1: T_MID[1], x2: R, y2: T_MID[1] },
    { x1: L, y1: T_MID[2], x2: R, y2: T_MID[2] },
  ],
  'vertical-bottom': [
    { x1: L, y1: T_BOT[0], x2: R, y2: T_BOT[0] },
    { x1: L, y1: T_BOT[1], x2: R, y2: T_BOT[1] },
    { x1: L, y1: T_BOT[2], x2: R, y2: T_BOT[2] },
  ],

  // Horizontal only: left/center/right bias with varied line lengths
  'horizontal-left': [
    { x1: L, y1: T_MID[0], x2: 16, y2: T_MID[0] },
    { x1: L, y1: T_MID[1], x2: 13, y2: T_MID[1] },
    { x1: L, y1: T_MID[2], x2: 15, y2: T_MID[2] },
  ],
  'horizontal-center': [
    { x1: 7, y1: T_MID[0], x2: 17, y2: T_MID[0] },
    { x1: 9, y1: T_MID[1], x2: 15, y2: T_MID[1] },
    { x1: 7, y1: T_MID[2], x2: 17, y2: T_MID[2] },
  ],
  'horizontal-right': [
    { x1: 10, y1: T_MID[0], x2: R, y2: T_MID[0] },
    { x1: 12, y1: T_MID[1], x2: R, y2: T_MID[1] },
    { x1: 9, y1: T_MID[2], x2: R, y2: T_MID[2] },
  ],
}

const lines = computed(() => lineMap[props.variant] ?? [])
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <line v-for="(l, idx) in lines" :key="idx" :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2" />
  </svg>
</template>
