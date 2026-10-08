# ADR 0005：在 Suite v4 上通过 Manifest Schema 2 实现增量 Pack 上传

> 译文说明：本页是 [英文原件](/docs/adr/incremental-packs-via-manifest-schema-2)
> 的信息性中文翻译；`docs/adr/` 中的英文原件是唯一事实源（不可变证据）。

- 产品决策由用户确认：2026-10-05（Asia/Shanghai）。
- 实现状态：**已交付（2026-10-05，S08）**——schema-2 解析器（Go/TS 交叉
  向量）、`gitio` 增量 pack API、带回退的 byos 链上 push/fetch，且全部
  §2.3 准入门禁在本地真实 Git 测试中通过；同日在 `demo-showcase-byos`
  上验证了真实 Injective 测试网 + Cloudflare R2 的增量 push（schema-2
  链上 manifest、两个带显式依赖闭包的 pack、摘要匹配的公开读取、干净的
  冷启动 clone；见 [backlog](../backlog.md)）。
- 扩展 [ADR 0004](0004-mainnet-storage-neutral-successor-and-byos-scope.md)。
- 不修改 Suite v4 合约、`suiteVersion`、v3 旧路径或任何既有 manifest
  schema 1 对象。

## 背景

当前 v4 的每次 push 都上传一个自包含的全历史 pack
（`cli/internal/byos/byos.go` → `PackFullHistory`），因此桶所有者成本
（存储、请求、出口带宽与强制验证回读，见
[ADR 0004](0004-mainnet-storage-neutral-successor-and-byos-scope.md)）
随仓库全历史在每次 push 时增长。

Manifest schema 1 冻结了 `thin=false` / `dependsOn=[]` 与完整的非 thin
历史。开放问题把增量依赖优化列为后续工作，并规定"没有新的后继版本"不得
重开。用户现已显式决定排期实施，选择小改动路径。

本设计依赖的已验证代码事实：

- Go 与 TypeScript 解析器拒绝任何 `schemaVersion != 1`
  （`cli/internal/packmanifest/manifest.go`、`web/src/lib/packmanifest.ts`），
  未知版本已经 fail-closed。
- CLI `FetchRef` 与 Web `gitstore.loadVerifiedRef` 已经按顺序遍历
  `manifest.packs`，并在 Git 摄入前逐 pack 验证摘要/大小。
- `gitio.IndexVerified` 目前在每个 pack 之后检查目标 tip 与完整可达性；
  链上的中间 pack 不包含新 tip，因此验证必须拆分（逐 pack 字节/索引
  检查 + 一次最终的整集闭包检查）。

## 决策

用户于 2026-10-05 决定立即通过 manifest schema 2 构建增量 pack，且不
改动已部署的 Suite v4 合约：

1. **不改合约。** 链上承诺保持
   `manifestDigest + manifestSize + bootstrapLocator + revision`；链不读
   manifest 内容，因此 `suiteVersion` 保持 4，任何模块、ABI 或部署变更都
   不在范围内。
2. **Manifest schemaVersion 2 承载增量。** ref 的 manifest 列出一个有序、
   有界的 pack 链。快进（fast-forward）push 精确追加一个 pack，只包含
   该链尚不存在的对象，并以该 ref 自己的旧 tip 作为唯一排除基
   （`git rev-list --objects <new-tip> --not <old-tip>`）。兄弟 ref 绝不
   作为排除基（BYOS §2.3 保证每个 ref 独立可 clone）。
3. **显式闭包；绝不用 git thin pack。** 每个新条目声明的 `dependsOn`
   只能引用同一 manifest 中更早的条目；接收方验证仅向后的引用、无环
   拓扑序与有界深度。每个 pack 内部自足——不用 `--thin`、不用
   `--fix-thin`；原始 SHA-256 + 大小按现状逐 pack 验证后才让 Git 看到
   字节。
4. **Fail-closed 兼容性。** 今天的解析器会拒绝 schemaVersion 2 manifest；
   旧客户端必须报出可操作的双语升级错误，绝不静默回退。Schema 1
   manifest 与所有既有的摘要键对象保持有效且不变。
5. **空增量。** 不新增对象的快进 push（例如指向已发布提交的标签）复用
   既有 pack 集，仅换新的提交绑定并 revision+1；不发生 pack 上传。
6. **自动回退为全新的自包含完整 pack**（链重置为单一条目——BYOS §2.1
   认可的 repack 模式），触发条件：更新不是快进（历史重写）、先前
   manifest 缺失/损坏/验证失败、链将超过 16-pack 上限、或超过 2 GiB
   总大小预算。Force push 绝不免除 revision CAS。快进/祖先检查是客户端
   策略；链上只保留其 CAS 并发检查（BYOS §5：合约无法验证 Git 祖先
   关系）。
7. **ref 间独立是硬门禁。** 删除或重写任何其他 ref 不得影响本 ref 的
   闭包。BYOS §2.3 的准入标准——显式依赖闭包、无环拓扑序、边界、缺失
   依赖拒绝、跨 ref 删除测试——是强制性的 S08 验收标准，不是愿景。

## 范围之外

链压实/合并、孤儿 GC、跨 ref 或跨仓库依赖、git thin pack、合约或套件
版本变更、私有仓库，以及对 v3 IPFS 路径的任何变更。

## 后果

- Go/TS 解析器获得 schemaVersion 2 与新的交叉测试 canonical 向量；
  `protocol/packmanifest` 的 schema 2 向量由真实实现生成，绝不手写。
- `gitio` 需要 `PackIncremental` 入口，并把 `IndexVerified` 拆分为逐 pack
  字节/索引验证加一次最终整集闭包检查（最后一个 pack 之后
  `cat-file`/`fsck`）。
- Web 在整条链上保持逐 pack 预算（每 pack 32 MiB，总计 256 MiB）并解析
  schema 2。
- 每次 push 的上传成本不再随全历史增长；在压实被另行设计与审批之前，
  冷启动 clone 仍下载整条链。
- 本 ADR 是已记录的用户决策：只重开恰好一个冻结工程项（增量依赖 pack），
  不引入新的后继套件版本；开放问题中的其他冻结项保持关闭。
