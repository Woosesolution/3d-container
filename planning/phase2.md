# Phase 2 - 多租户安全与数据持久化基础

## 1. 目标

- 建立“客户级隔离”能力，防止数据污染。
- 打通登录后写入/读取本客户数据的主链路。
- 在不破坏 Phase 1 交互体验的情况下接入后端。

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
  - `product_specs`
  - `pallet_plans`
  - `load_runs`
- 前端会话与租户上下文：
  - 登录态管理
  - `currentTenantId` 管理
- 基础仓储层：
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

### 3.2 最小表示例

```sql
product_specs (
  id uuid pk,
  tenant_id uuid not null,
  name text not null,
  l_mm numeric not null,
  w_mm numeric not null,
  h_mm numeric not null,
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
  data/
    supabase-client.js
    repositories/
      product-spec.repo.js
      pallet-plan.repo.js
      load-run.repo.js
db/
  migrations/
    001_init.sql
    002_rls.sql
```

## 6. 交付物

1. 可运行登录流程。
2. 数据表与迁移脚本。
3. RLS 策略脚本。
4. 前端仓储层接入。
5. 多租户隔离测试记录。

## 7. 测试清单

1. 用户 A 不能读取用户 B 数据。
2. 用户 A 不能写入用户 B 的 `tenant_id`。
3. 非成员用户访问业务表失败。
4. 同一用户可稳定读取自己历史计算记录。

## 8. 通过标准（Gate）

- 多租户隔离测试全部通过。
- 登录后主流程可完成“保存参数 + 拉取历史”。
- 无高优先级安全漏洞（越权读写）。

## 9. 风险与对策

- 风险：RLS 规则写错导致误放行。
  - 对策：先白名单策略，再做负向攻击测试。
- 风险：个人开发者不熟 SQL。
  - 对策：固定 migration 模板，迭代式小步提交。
