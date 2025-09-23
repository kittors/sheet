// Context menu configuration for sheet cells
// Note: UI behavior is handled in App.vue, this file only exports menu structure
import { Scissors, Copy, ClipboardPaste, AlignLeft, AlignCenter, AlignRight } from 'lucide-vue-next'
import type { ContextMenuItem } from '@sheet/ui'

export const cellMenu: ContextMenuItem[] = [
  { id: 'cut', label: '剪切', icon: Scissors, shortcut: '⌘X' },
  { id: 'copy', label: '复制', icon: Copy, shortcut: '⌘C' },
  { id: 'paste', label: '粘贴', icon: ClipboardPaste, shortcut: '⌘V' },
  { id: 'grp-sep-1', seperator: true },
  {
    id: 'insert',
    label: '插入',
    children: [
      { id: 'insert-row-above', label: '在上方插入行' },
      { id: 'insert-row-below', label: '在下方插入行' },
      { id: 'ins-sep-1', seperator: true },
      { id: 'insert-col-left', label: '在左侧插入列' },
      { id: 'insert-col-right', label: '在右侧插入列' },
    ],
  },
  {
    id: 'align',
    label: '对齐',
    children: [
      { id: 'align-left', label: '左对齐', icon: AlignLeft },
      { id: 'align-center', label: '水平居中', icon: AlignCenter },
      { id: 'align-right', label: '右对齐', icon: AlignRight },
      { id: 'aln-sep-1', seperator: true },
      { id: 'valign-top', label: '顶部对齐' },
      { id: 'valign-middle', label: '垂直居中' },
      { id: 'valign-bottom', label: '底部对齐' },
      {
        id: 'align-advanced',
        label: '高级',
        separatorBefore: true,
        children: [
          { id: 'distribute-h', label: '水平分布' },
          { id: 'distribute-v', label: '垂直分布' },
          {
            id: 'indent',
            label: '缩进',
            children: [
              { id: 'indent-increase', label: '增加缩进' },
              { id: 'indent-decrease', label: '减少缩进' },
            ],
          },
        ],
      },
    ],
  },
  { id: 'grp-sep-2', seperator: true },
  {
    id: 'format',
    label: '格式',
    children: [
      {
        id: 'number-format',
        label: '数字格式',
        children: [
          { id: 'fmt-general', label: '常规' },
          { id: 'fmt-number', label: '数值' },
          { id: 'fmt-percent', label: '百分比' },
          {
            id: 'fmt-decimal',
            label: '小数位',
            children: [
              { id: 'decimal-0', label: '0 位' },
              { id: 'decimal-1', label: '1 位' },
              { id: 'decimal-2', label: '2 位' },
              { id: 'decimal-3', label: '3 位' },
            ],
          },
        ],
      },
      {
        id: 'borders',
        label: '边框',
        children: [
          { id: 'border-all', label: '所有边框' },
          { id: 'border-outside', label: '外边框' },
          { id: 'border-inside', label: '内部边框' },
        ],
      },
      {
        id: 'text-orientation',
        label: '文本方向',
        children: [
          { id: 'orientation-horizontal', label: '水平' },
          { id: 'orientation-vertical', label: '垂直' },
          {
            id: 'orientation-angle',
            label: '角度',
            children: [
              { id: 'angle-45', label: '45 deg' },
              { id: 'angle-90', label: '90 deg' },
              { id: 'angle-135', label: '135 deg' },
            ],
          },
        ],
      },
    ],
  },
]

export default cellMenu

