import type { Component, VNode, InjectionKey } from 'vue'

export interface OpenContext {
  triggerEvent: MouseEvent | null
}

export interface MenuItem {
  id: string | number
  label?: string
  icon?: string | Component
  action?: (payload: { id: string | number; event: MouseEvent | KeyboardEvent | null }) => void | Promise<void>
  children?: MenuItem[]
  disabled?: boolean | ((ctx: OpenContext) => boolean)
  hidden?: boolean | ((ctx: OpenContext) => boolean)
  // When true and item has no own content, renders a full-width separator row.
  // Legacy spelling kept for backward compat.
  seperator?: boolean
  // When true, draws a separator line before this item.
  separatorBefore?: boolean
  shortcut?: string
  customRender?: Component | ((item: MenuItem) => VNode)
  keepOpen?: boolean
}

export const CTX_MENU_KEY: InjectionKey<CtxMenuApi> = Symbol('CTX_MENU') as InjectionKey<CtxMenuApi>

export interface CtxMenuApi {
  isDisabled: (item: MenuItem) => boolean
  hasChildren: (item: MenuItem) => boolean
  isActive: (level: number, index: number) => boolean
  onItemMouseEnter: (level: number, index: number, item: MenuItem, ev?: MouseEvent) => void
  onItemClick: (item: MenuItem, ev: MouseEvent) => void
}
