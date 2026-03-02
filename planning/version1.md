# 自动 3D 装柜原型 V1.1 实施总览

本文件作为总索引。详细执行规范已拆分到 4 个 phase 文档，后续可直接按 phase 发给开发执行。

## Phase 文档

1. [phase1.md](/Users/admin/Documents/New%20project/planning/phase1.md)
2. [phase2.md](/Users/admin/Documents/New%20project/planning/phase2.md)
3. [phase3.md](/Users/admin/Documents/New%20project/planning/phase3.md)
4. [phase4.md](/Users/admin/Documents/New%20project/planning/phase4.md)

## 拆分原则

- 你要求在 Phase 1 就包含 3D 交互和自动装柜算法，因此 Phase 1 定义为可演示 MVP。
- Phase 2 专注多客户隔离与数据安全（Auth + RLS + tenant）。
- Phase 3 做算法和交互增强，提高质量和可解释性。
- Phase 4 做全量集成、回归测试、发布准备。

## 全局不变约束

- 技术栈：前端 `HTML/CSS/JavaScript + Three.js`，后端 `Supabase + PostgreSQL + Auth + RLS`（免费层起步）。
- 单位：输入 `mm/kg`，渲染统一转换为 `m`。
- 安全：所有业务表必须具备 `tenant_id`，隔离依赖 RLS，不依赖前端过滤。

## 全局非目标（当前版本）

- 不做 CAD 级异形建模编辑器。
- 不做高精度物理仿真（倾倒/摩擦/重心）。
- 不做离线优先和多端实时协作。
