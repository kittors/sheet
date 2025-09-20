<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
    block?: boolean
    disabled?: boolean
    loading?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'md',
    block: false,
    disabled: false,
    loading: false,
  },
)

const cls = computed(() => [
  'btn',
  `btn-${props.variant}`,
  `btn-${props.size}`,
  { 'btn-block': props.block, disabled: props.disabled || props.loading },
])
</script>

<template>
  <button class="btn-base" :class="cls" type="button" :disabled="disabled || loading">
    <span class="spinner" v-if="loading" aria-hidden="true"></span>
    <span class="content"><slot /></span>
  </button>
  
</template>

<style scoped>
.btn-base {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1;
  gap: 8px;
  cursor: pointer;
  transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}
.btn-sm { height: 28px; padding: 0 10px; }
.btn-md { height: 32px; padding: 0 12px; }
.btn-lg { height: 40px; padding: 0 14px; font-size: 15px; }
.btn-block { width: 100%; }

/* Variants driven by CSS variables */
.btn-primary {
  background: var(--primary);
  color: var(--on-primary);
  border: 1px solid var(--primary);
}
.btn-primary:hover { background: var(--primary-hover); border-color: var(--primary-hover); }
.btn-primary:active { background: var(--primary-active); border-color: var(--primary-active); }

.btn-secondary {
  background: var(--color-primary-50);
  color: var(--primary);
  border: 1px solid var(--color-primary-100);
}
.btn-secondary:hover { background: var(--color-primary-100); }
.btn-secondary:active { background: var(--color-primary-200); }

.btn-outline {
  background: transparent;
  color: var(--primary);
  border: 1px solid var(--primary);
}
.btn-outline:hover { background: var(--color-primary-50); }
.btn-outline:active { background: var(--color-primary-100); }

.btn-ghost {
  background: transparent;
  color: var(--primary);
  border: 1px solid transparent;
}
.btn-ghost:hover { background: var(--color-primary-50); }
.btn-ghost:active { background: var(--color-primary-100); }

.btn.disabled,
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.5);
  border-top-color: var(--on-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>

