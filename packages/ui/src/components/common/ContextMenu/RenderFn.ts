import { defineComponent, type PropType, type VNode } from 'vue'
import type { MenuItem } from './types'

export default defineComponent({
  name: 'RenderFn',
  props: {
    item: { type: Object as PropType<MenuItem>, required: true },
    renderer: { type: Function as PropType<(it: MenuItem) => VNode>, required: true },
  },
  setup(props) {
    return () => props.renderer!(props.item)
  },
})
