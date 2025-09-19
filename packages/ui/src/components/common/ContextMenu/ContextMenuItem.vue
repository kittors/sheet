<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'
import RenderFn from './RenderFn'
import type { MenuItem } from './types'

defineProps<{ item: MenuItem; hasChildren: boolean }>()
</script>

<template>
  <div class="ctx-item-content" :class="{ 'no-ico': !item.icon }">
    <span v-if="item.icon" class="ctx-ico">
      <component :is="item.icon" v-if="typeof item.icon !== 'string'" :size="14" />
      <template v-else>{{ item.icon }}</template>
    </span>
    <template v-if="!item.customRender">
      <span class="ctx-label">{{ item.label }}</span>
      <span v-if="item.shortcut" class="ctx-shortcut">{{ item.shortcut }}</span>
      <ChevronRight v-if="hasChildren" :size="14" class="ctx-arrow" />
    </template>
    <template v-else>
      <component v-if="typeof item.customRender !== 'function'" :is="item.customRender" :item="item" />
      <RenderFn v-else :renderer="item.customRender" :item="item" />
    </template>
  </div>
</template>

