# Phase 2 - 多租户安全与数据持久化基础

## 1. 目标

- 建立“客户级隔离”能力，防止数据污染。
- 打通登录后写入/读取本客户数据的主链路。
- 在不破坏 Phase 1 交互体验的情况下接入后端。
- 承接 Phase 1 演示级中英双语（默认中文），并预埋完整多语言偏好能力。
- 承接 Phase 1 单位规则（`inch/mm`，默认 `inch`），确保持久化与回放一致。

## 2. 范围

### 2.1 In Scope

- Supabase 项目接入：
  - Auth（Email 或 GitHub）
  - PostgreSQL
  - RLS
- 数据库建模：
  - `tenants`
  - `profiles`
  - `tenant_members`
  - `container_profiles`
  - `product_specs`
  - `pallet_plans`
  - `load_runs`
- 前端会话与租户上下文：
  - 登录态管理
  - `currentTenantId` 管理
  - `currentLocale` 管理（默认 `zh-CN`）
  - `currentUnit` 管理（默认 `inch`）
- 基础仓储层：
  - 保存/读取柜型模板选择与单位设置
  - 保存/读取产品参数
  - 保存/读取托盘结果
  - 保存/读取装柜快照

### 2.2 Out of Scope

- 高级角色审批流程
- 管理后台跨租户运营工具
- 复杂报表和导出

## 3. 数据模型

### 3.1 关键字段约束

- 业务表必须有 `tenant_id`。
- 所有写入要记录 `created_by`。
- 快照字段用 `jsonb` 存规则和结果，便于回溯。
- `profiles` 增加 `preferred_locale`，允许值：`zh-CN/en/fr/de`，默认 `zh-CN`。
- `profiles` 增加 `preferred_unit`，允许值：`inch/mm`，默认 `inch`。
- `pallet_plans` 与 `load_runs` 记录 `container_profile_code` 与 `input_unit`，用于历史回放一致性。

### 3.2 最小表示例

```sql
product_specs (
  id uuid pk,
  tenant_id uuid not null,
  name text not null,
  l_mm numeric not null,
  w_mm numeric not null,
  h_mm numeric not null,
  input_unit text not null default 'inch',
  density_kg_m3 numeric,
  unit_weight_kg numeric,
  qty integer not null,
  color text,
  created_by uuid,
  created_at timestamptz default now()
)
```

## 4. RLS 安全策略

目标：用户只能操作自己所属 tenant 的数据。

策略要求：
1. 开启业务表 RLS。
2. `SELECT/INSERT/UPDATE/DELETE` 都校验：
   - `auth.uid()` 存在于 `tenant_members`
   - `tenant_members.tenant_id = row.tenant_id`
3. 禁止前端传任意 tenant_id 越权写入。

## 5. 代码落点

```txt
src/
  app/
    session.js
    locale.js
    units.js
  data/
    supabase-client.js
    repositories/
      container-profile.repo.js
      product-spec.repo.js
      pallet-plan.repo.js
      load-run.repo.js
db/
  migrations/
    001_init.sql
    002_rls.sql
    003_profile_locale.sql
    004_profile_unit_and_vehicle_refs.sql
```

## 6. 交付物

1. 可运行登录流程。
2. 数据表与迁移脚本。
3. RLS 策略脚本。
4. 前端仓储层接入。
5. 多租户隔离测试记录。
6. 语言偏好字段与读取链路（未登录/已登录）打通，默认中文生效。
7. 单位偏好字段与读取链路（未登录/已登录）打通，默认 `inch` 生效。
8. 柜型模板选择与历史回放字段打通（`container_profile_code`、`input_unit`）。

## 7. 测试清单

1. 用户 A 不能读取用户 B 数据。
2. 用户 A 不能写入用户 B 的 `tenant_id`。
3. 非成员用户访问业务表失败。
4. 同一用户可稳定读取自己历史计算记录。
5. 未设置语言偏好时，系统默认语言为 `zh-CN`。
6. 已登录用户设置 `preferred_locale` 后，重新登录仍可恢复该语言。
7. 未设置单位偏好时，系统默认单位为 `inch`。
8. 已登录用户设置 `preferred_unit` 后，重新登录仍可恢复该单位。
9. 历史记录回放时，柜型模板与单位与保存时一致。

## 8. 通过标准（Gate）

- 多租户隔离测试全部通过。
- 登录后主流程可完成“保存参数 + 拉取历史”。
- 无高优先级安全漏洞（越权读写）。
- 默认中文规则与语言偏好持久化验证通过。
- 默认 `inch` 规则与单位偏好持久化验证通过。

## 9. 风险与对策

- 风险：RLS 规则写错导致误放行。
  - 对策：先白名单策略，再做负向攻击测试。
- 风险：个人开发者不熟 SQL。
  - 对策：固定 migration 模板，迭代式小步提交。
