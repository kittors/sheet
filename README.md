# Sheet Monorepo

基于 TypeScript 的 Canvas 电子表格引擎与 Vue 3 UI 的多包工作区。采用 pnpm + Turborepo 管理，包含“核心模型 → 渲染 → 交互 → API → 组件 → 应用”的分层设计，并提供 `apps/web` 示例用于本地预览与联调。

— 实验性项目，接口在演进中。

## 功能亮点

- 高性能 Canvas 渲染：多图层（背景/内容/选区/冻结/滚动条/引导线），支持缩放与虚拟滚动。
- 交互统一：鼠标/触控板/键盘/IME，选区管理，滚动同步，自定义滚动条命中区域。
- 冻结窗格：顶/左冻结，命中测试与滚动几何均按冻结区计算。
- 样式系统：字体（家族/大小/粗体/斜体/下划线/删除线）、对齐、填充色、边框（含 outside/粗边）。
- 合并/拆分单元格：边界阻挡与网格绘制优化。
- UI 组件：工具栏、颜色选择、上下文菜单、滚动条、画布容器等，可直接拼装完整表格界面。
- Worker 支持：可在 OffscreenCanvas 中渲染（`WorkerRenderer`）。
- 无限滚动：按需扩展行列，适合大表格探索（可选）。

## 技术栈

- Node 22 + pnpm 工作区 + Turborepo
- TypeScript、tsup 打包 ESM/CJS + `.d.ts`
- Vue 3 + Vite（演示应用）
- Vitest（单测）、Playwright（E2E）
- ESLint 9（Flat Config）+ Prettier 3

## 目录结构

- `apps/web`：Vite + Vue 3 演示应用与 E2E 测试
- `packages/core`：工作簿/工作表/单元格等核心模型与快照/回放
- `packages/api`：以核心为基础的便捷 API（赋值、样式、合并、边框等）
- `packages/renderer`：Canvas 渲染器与多图层实现、滚动条与冻结线
- `packages/interaction`：命中测试、滚动/缩放、编辑器与选择框逻辑
- `packages/ui`：Vue 3 组件库（画布、工具栏、菜单、颜色选择、滚动条）
- `packages/shared-utils`：DPR/几何/虚拟范围等工具
- `packages/testing`：测试共享配置与工具

## 环境要求

- Node.js `>=22.17.0 <23`（根目录有 `.nvmrc`）
- pnpm `>=10.16.1`（根 `package.json` 指定 `packageManager`）

建议：

- `corepack enable` 启用 Corepack 对齐 pnpm 版本
- `nvm use` 或安装 `.nvmrc` 指定的 Node 版本

## 快速开始

```bash
pnpm install            # 安装依赖
pnpm dev                # 并行启动各包的 dev（Turbo）
pnpm dev:web            # 仅运行演示应用 apps/web
```

访问 `http://localhost:5173` 预览交互式表格。

## 常用脚本

- `pnpm build`：构建所有包（tsup + Turbo）
- `pnpm test`：运行各包的单元测试
- `pnpm --filter @sheet/web e2e`：在示例应用中跑 Playwright E2E
- `pnpm lint` / `pnpm lint:fix`：ESLint 检查/修复
- `pnpm format` / `pnpm format:check`：Prettier 格式化/检查
- `pnpm clean`：清理 `dist/`、`node_modules`、`.turbo`

## 使用示例

Vue 3 组件（推荐）：

```vue
<script setup lang="ts">
import '@sheet/ui/styles/theme.css'
import { SheetCanvas } from '@sheet/ui'
import { createWorkbookWithSheet, applyCells, applyMerges } from '@sheet/api'

const { sheet } = createWorkbookWithSheet({ name: 'Sheet1', rows: 100, cols: 40 })
applyCells(sheet, [{ r: 0, c: 0, v: 'Hello' }])
applyMerges(sheet, [{ r: 1, c: 1, rows: 2, cols: 3 }])
</script>

<template>
  <SheetCanvas :sheet="sheet" :infinite-scroll="true" />
  <!-- 可叠加工具栏、菜单、颜色选择等组件 -->
  <!-- <SheetControlLayout /> <ContextMenu /> <SheetFooter /> ... -->
  <!-- 详见 apps/web/src/App.vue:1 -->
  <!-- 以及 packages/ui/src/components/business/SheetCanvas.vue:1 -->
  <!-- 和 packages/ui/src/components/business/SheetToolbar.vue:1 -->
  <!-- 与 packages/ui/src/components/business/FontControls.vue:1 -->
  <!-- 或直接参考 apps/web/src/config/contextMenu.ts:1 菜单定义 -->
  
</template>
```

裸用渲染器（无需 Vue）：

```ts
import { CanvasRenderer } from '@sheet/renderer'
import { createWorkbookWithSheet } from '@sheet/api'

const { sheet } = createWorkbookWithSheet({ name: 'Sheet1', rows: 200, cols: 80 })
const canvas = document.querySelector('canvas')!
const renderer = new CanvasRenderer(canvas, { infiniteScroll: true })
renderer.render(sheet, 0, 0)
```

交互层集成：

```ts
import { attachSheetInteractions } from '@sheet/interaction'

const h = attachSheetInteractions({ canvas, renderer, sheet })
h.setZoom?.(1.25)         // 125%
// h.destroy() 组件卸载时调用
```

更多可参考示例应用 `apps/web/src/App.vue:1`。

## 架构概览

- 核心（`@sheet/core`）定义模型与快照/回放；
- 渲染（`@sheet/renderer`）以多图层驱动画布绘制，提供视口度量与滚动条几何；
- 交互（`@sheet/interaction`）进行命中测试、滚动/编辑/选择与冻结区坐标映射；
- API（`@sheet/api`）在交互+核心上封装易用方法（字体、对齐、边框、合并、填充等）；
- UI（`@sheet/ui`）保持“无状态/可组合”，由外部传入 `sheet`，事件上报给父组件；
- 应用（`@sheet/web`）示范数据加载、工具栏联动、右键菜单、缩放等。

## 测试与质量

- 单测：各包使用 Vitest（如 `packages/renderer/test/dummy.test.ts:1`）
- E2E：示例应用用 Playwright（`apps/web/tests/smoke.spec.ts:1`）
- Lint/格式化：ESLint 9 + Prettier 3（根 `eslint.config.mjs:1`、`prettierrc` 系列）

## 开发提示

- UI 主题样式在 `packages/ui/src/styles`，直接通过 Vite 别名引入。
- 示例数据位于 `apps/web/src/data`，可替换为后端返回或动态生成。
- Safari 边缘回弹问题：示例中在 Safari 关闭原生滚动主机，改为自定义 wheel 以避免抖动。
- OffscreenCanvas/Worker：见 `packages/renderer/src/worker`，可在 WebWorker 中渲染。

## 参与贡献

- 欢迎通过 Issue/PR 反馈与共建。
- 提交前建议执行：`pnpm lint`、`pnpm test`。

## 许可证

当前仓库未在根目录声明开源许可证；在明确授权前，请勿用于需要开放授权的场景。
