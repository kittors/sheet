# Sheet Monorepo

一个基于 TypeScript 的多包工作区，用于构建 Canvas 渲染的电子表格体验。仓库采用 pnpm + Turbo 的单体仓库结构，包含核心数据模型、渲染、交互与 Vue 3 UI 组件，并提供 `apps/web` 作为实时预览示例。

## 功能亮点

- **Canvas 渲染引擎**：`@sheet/renderer` 使用多图层策略绘制背景、内容、选区、冻结区与滚动条，支持缩放、虚拟滚动与无限扩展画布。
- **强大的交互层**：`@sheet/interaction` 统一处理鼠标、触控板、键盘及 IME 编辑流程，提供选区管理、滚动同步与快捷键命令。
- **模块化核心模型**：`@sheet/core` 定义工作簿、工作表、单元格等基础类型，`@sheet/api` 在其上封装单元格更新、合并、样式定义等便捷方法。
- **Vue 3 UI 组件**：`@sheet/ui` 提供工具栏、上下文菜单、颜色选择器、画布容器等组件，可快速拼装出完整的电子表格界面。
- **演示应用**：`apps/web` 基于 Vite 构建，演示工作表初始化、JSON 数据加载以及工具栏联动等能力，并集成 Playwright 端到端测试脚本。

## 仓库结构

| 路径 | 说明 |
| --- | --- |
| `apps/web` | 面向浏览器的演示应用（Vite + Vue 3）。 |
| `packages/core` | 工作簿与单元格核心数据模型。 |
| `packages/api` | 基于核心模型的操作 API（应用初始数据、合并、样式等）。 |
| `packages/renderer` | Canvas 渲染引擎，支持虚拟滚动、冻结窗格与缩放。 |
| `packages/interaction` | 交互控制层，处理指针、键盘、滚轮与编辑状态。 |
| `packages/ui` | Vue 3 组件库（画布、工具栏、上下文菜单等）。 |
| `packages/shared-utils` | Canvas 与几何计算等共享工具方法。 |
| `packages/testing` | 测试辅助工具与配置。 |

## 环境要求

- Node.js `>=22.17.0 <23`
- pnpm `>=10.16.1`

建议在仓库根目录运行 `corepack enable` 来启用与项目匹配的 pnpm 版本。

## 快速开始

```bash
pnpm install          # 安装所有依赖
pnpm dev              # 启动所有包的开发任务（Turbo）
pnpm dev:web          # 仅运行演示应用（apps/web）
```

应用启动后访问 `http://localhost:5173` 即可预览交互式电子表格。

## 常用脚本

- `pnpm build`：构建所有包的产物（tsup + Turbo）。
- `pnpm test`：运行工作区内可用的单元测试或占位脚本。
- `pnpm --filter @sheet/web e2e`：在演示应用中运行 Playwright 端到端测试。
- `pnpm lint` / `pnpm lint:fix`：执行 ESLint 检查或修复。
- `pnpm format` / `pnpm format:check`：使用 Prettier 统一格式。
- `pnpm clean`：清理 `dist/`、`node_modules` 与 `.turbo` 缓存。

## 开发提示

- UI 样式统一存放于 `packages/ui/styles`，通过 Vite 别名在应用中直接引入。
- 数据示例位于 `apps/web/src/data`，可替换为后端返回或实时生成的数据以验证 API。
- 如需在 WebWorker 中渲染，可参考 `@sheet/renderer` 中的 `OffscreenCanvas` 与 DPR 适配逻辑。
- 提交前推荐执行 `pnpm lint` 与 `pnpm test`，确保代码质量。

## 贡献

欢迎通过 Issue 或 Pull Request 进行功能建议与问题反馈。提交代码前，请遵循项目现有的代码风格与包结构。

## 许可证

当前仓库未在根目录声明开源许可证，如需使用请先与维护者确认授权范围。
