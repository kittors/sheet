<script setup lang="ts">
import { ref, watch } from 'vue'
import ColorPickerPanel from './ColorPickerPanel.vue'
import UIButton from '../../common/Button.vue'
import Modal from '../../common/Modal.vue'

const props = withDefaults(
  defineProps<{
    visible: boolean
    color: string
    movable?: boolean
    maskColor?: string
    title?: string
    closeOnMask?: boolean
    width?: number
  }>(),
  {
    movable: true,
    maskColor: 'rgba(0,0,0,0.25)',
    title: '选择颜色',
    closeOnMask: true,
    width: 260,
  },
)
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'update:color', v: string): void
  (e: 'confirm', v: string): void
  (e: 'cancel'): void
}>()

const open = ref(false)
const localColor = ref<string>(props.color)
watch(
  () => props.visible,
  (v) => {
    open.value = v
    if (v) localColor.value = props.color
  },
  { immediate: true },
)
watch(
  () => props.color,
  (v) => {
    if (!open.value) localColor.value = v
  },
)

function onCancel() {
  emit('cancel')
  emit('update:visible', false)
}
function onConfirm() {
  emit('update:color', localColor.value)
  emit('confirm', localColor.value)
  emit('update:visible', false)
}
</script>

<template>
  <Modal
    v-model:visible="open"
    :title="title"
    :movable="movable"
    :mask-color="maskColor"
    :close-on-mask="closeOnMask"
    :width="width"
    @cancel="onCancel"
    @update:visible="(v) => emit('update:visible', v)"
  >
    <template #default>
      <ColorPickerPanel v-model="localColor" @change="(c) => (localColor = c)" />
    </template>
    <template #footer>
      <UIButton variant="ghost" @click="onCancel">取消</UIButton>
      <UIButton variant="primary" @click="onConfirm">确定</UIButton>
    </template>
  </Modal>
</template>

<style scoped>
/* No additional styles; Modal provides structure */
</style>
