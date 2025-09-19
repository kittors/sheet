<script setup lang="ts">
import { Paintbrush, ClipboardPaste, Copy, Combine, Split } from "lucide-vue-next";
import ToolItem from "../common/ToolItem.vue";
import ToolGroup from "../common/ToolGroup.vue";
import FontControls from "./FontControls.vue";
// Emits: merge/unmerge commands upward to layout/app
const emit = defineEmits<{ (e: 'merge-cells'): void; (e: 'unmerge-cells'): void }>()
</script>

<template>
  <div class="toolbar-card" aria-label="toolbar-card">
    <!-- 左侧：格式刷 与 粘贴（大图标 + 底部文字） -->
    <ToolGroup direction="horizontal" :gap="2">
      <ToolItem label="格式刷">
        <Paintbrush :size="22" />
      </ToolItem>
      <ToolItem label="粘贴">
        <ClipboardPaste :size="22" />
      </ToolItem>
    </ToolGroup>

    <!-- 右侧：复制/粘贴 竖直排列，无底部文字 -->
    <ToolGroup direction="vertical" :gap="2">
      <ToolItem label-position="none" aria-label="剪切"
        ><ClipboardPaste :size="18"
      /></ToolItem>
      <ToolItem label-position="none" aria-label="复制"
        ><Copy :size="18"
      /></ToolItem>
    </ToolGroup>

    <!-- 竖向分割线 -->
    <div class="vsep"></div>

    <!-- 字体控制块：上下 group（上：两个下拉紧贴；下：四个样式icon） -->
    <FontControls />

    <!-- 合并/取消合并 -->
    <div class="vsep"></div>
    <ToolGroup :gap="2">
      <ToolItem label-position="none" aria-label="合并单元格" @click="emit('merge-cells')">
        <Combine :size="18" />
      </ToolItem>
      <ToolItem label-position="none" aria-label="取消合并" @click="emit('unmerge-cells')">
        <Split :size="18" />
      </ToolItem>
    </ToolGroup>
  </div>
</template>

<style scoped>
.toolbar-card {
  height: 56px; /* 略微高一些 */
  background: #ffffff;
  border-radius: 12px;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.06),
    0 1px 2px rgba(0, 0, 0, 0.04),
    inset 0 0 0 1px #e6eaf2;
  /* Allow dropdown menus to overflow outside */
  overflow: visible;
  display: flex;
  align-items: center;
  padding: 6px 10px;
}
.tool-item {
  border: 0;
  background: transparent;
  border-radius: 10px;
  color: #4b5563;
}
.tool-tile:hover {
  background: rgba(0, 0, 0, 0.06);
}
.tool-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 44px;
  padding: 4px 8px;
  cursor: pointer;
}
.label {
  font-size: 12px;
  color: #6b7280;
  line-height: 1;
}
.tool-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px;
}
.vsep {
  width: 1px;
  height: 32px;
  background: #e5e7eb;
  margin: 0 6px;
}
.btn {
  appearance: none;
  border: 0;
  background: transparent;
  border-radius: 8px;
  padding: 4px;
  height: 24px;
  width: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #4b5563;
  cursor: pointer;
}
.btn:hover {
  background: rgba(0, 0, 0, 0.06);
}
</style>
