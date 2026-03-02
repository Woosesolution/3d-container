# 自动 3D 装柜原型 V1.2 实施总览

本文件作为总索引。详细执行规范已拆分到 6 个 phase 文档，后续可直接按 phase 发给开发执行。

## Phase 文档

1. [phase1.md](/Users/admin/Documents/New%20project/planning/phase1.md)
2. [phase2.md](/Users/admin/Documents/New%20project/planning/phase2.md)
3. [phase3.md](/Users/admin/Documents/New%20project/planning/phase3.md)
4. [phase4.md](/Users/admin/Documents/New%20project/planning/phase4.md)
5. [phase5.md](/Users/admin/Documents/New%20project/planning/phase5.md)
6. [phase6.md](/Users/admin/Documents/New%20project/planning/phase6.md)

## 拆分原则

- 你要求在 Phase 1 就包含 3D 交互和自动装柜算法，因此 Phase 1 定义为可演示 MVP，并提供演示级中英双语（默认中文）。
- Phase 1 同时引入标准柜型模板选择（`20GP/40GP/40HC/45HC`）与尺寸单位切换（`inch/mm`，默认 `inch`）。
- Phase 2 专注多客户隔离与数据安全（Auth + RLS + tenant），并预埋多语言偏好字段。
- Phase 3 做算法和交互增强，提高质量和可解释性。
- Phase 4 做全量集成、回归测试、发布准备。
- Phase 5 做多语言增强与本地化质量收敛（在 Phase 1 中英基础上补齐 fr/de 与全量覆盖）。
- Phase 6 做载具模板扩展（卡车），在复用算法前提下扩展场景边界。

## 全局不变约束

- 技术栈：前端 `HTML/CSS/JavaScript + Three.js`，后端 `Supabase + PostgreSQL + Auth + RLS`（免费层起步）。
- 单位：尺寸输入支持 `inch/mm`（默认 `inch`），内部统一归一到 `mm`，渲染统一转换为 `m`；重量单位 `kg`。
- 安全：所有业务表必须具备 `tenant_id`，隔离依赖 RLS，不依赖前端过滤。
- 多语言：当前支持 `zh-CN / en / fr / de`，系统默认语言为 `zh-CN`。

## 全局非目标（当前版本）

- 不做 CAD 级异形建模编辑器。
- 不做高精度物理仿真（倾倒/摩擦/重心）。
- 不做离线优先和多端实时协作。
