# ADR 0002：让 Git Pack 存储可插拔

> 译文说明：本页是 [英文原件](/docs/adr/pluggable-pack-storage)
> 的信息性中文翻译；`docs/adr/` 中的英文原件是唯一事实源（不可变证据）。

- 状态更新（2026-10-05）：已作为 Suite v4 交付——后继合约、CLI/Web 版本
  分派、真实 Cloudflare R2 端到端 Git 流程均为 PASS；真实 AWS S3 canary
  与主网发布门禁仍为 NOT PROVEN（[交付记录](../backlog.md)）
- 决策日期：2026-08-14
- 首发范围确认：2026-09-13，[ADR 0004](0004-mainnet-storage-neutral-successor-and-byos-scope.md)
- Suite v3 运行时按设计保持仅 IPFS（冻结的旧路径）；Suite v4 是已交付的
  BYOS 路径，且仅限 Amazon S3 / Cloudflare R2

## 背景

iGit 的产品核心是 Git 兼容的协作加上 Injective EVM 控制平面。Kubo/IPFS
是目前已实现的 pack 传输与持久化适配器，但它引入了本地守护进程和一套
IPFS 专属的运维栈。它不能成为对每个用户、每种部署的永久性架构要求。

当前的不可变套件只校验 `ipfs://` pack URI，当前 CLI 与 Web 的取回路径
也只认识 IPFS。Amazon S3 与 Cloudflare R2 无法通过修改文档、网关 URL 或
凭据来安全启用。

## 决策

1. 将 pack 存储视为稳定存储适配器接口背后可替换的数据平面。
2. 当前套件继续以 IPFS/Kubo 作为受支持适配器。
3. 首个主网发布实现用户自有的 Amazon S3 与 Cloudflare R2 存储桶。这些
   profile 不得依赖 Kubo、IPFS 网络或 iGit 运营的 IPFS 服务。自建对象
   存储（含 MinIO）、其他云与任意 S3 兼容端点不在本范围内。
4. 设计后继的链上 pack 引用，能标识允许的存储 scheme，并把内容完整性
   绑定独立于可变 URL。
5. 凭据、预签名 URL、会话令牌与私有访问细节不得进入链上状态、manifest、
   remote、日志与普通配置。用户通过本地安全凭据机制获得写入者与独立的
   读取者凭据；托管 broker 不是首发依赖。公开读取定位符是有意公开的、
   非机密的元数据。
6. 直接面向主网定位一个经过评审的存储中立后继套件。保留显式 v3 兼容性；
   仅在另行立项时迁移历史。当前套件不可变，无法承载新的载荷格式。
7. 使用 canonical JSON manifest，将有序 pack 与其副本分开，并把原始 pack
   的摘要与大小独立于存储位置绑定。该 schema 与 canonical 字节需要
   Go/TypeScript 交叉实现测试。
8. 首发仓库为公开。存储桶所有者自付云费用；双副本与私有仓库/加密属于
   后续工作，不是 AWS/R2 BYOS 交付的前置条件。

## 必备性质

- Git 消费 pack 字节前，先按稳定摘要验证。
- Push 在更新链上 ref 前验证已存字节。这是客户端策略与上传时的观测，
  不是 EVM 可用性证明。
- 失败的 ref 交易保留可重试内容，或记录可恢复的对象键。
- Clone 与 fetch 能解析所有被接受的 URI，且不要求凭据出现在 Git remote
  或链上状态中。
- 后继套件的新写入最初使用自包含、非 thin 的 pack，包括新分支/标签与
  force push。旧的增量行为被隔离，不得静默变成对另一 ref 的依赖。
- 每个受支持适配器在 Windows 与 Linux 都有干净环境的 E2E 覆盖。
- 每个 provider 有独立测试过的能力 profile 与最小权限/只读配置。版本化、
  保留、生命周期与加密能力不得假设可移植；本工作不启用任何自动删除/GC。
- 若迁移获批，须保留历史 pack 可用性，并提供从旧 `ipfs://` 条目到任何
  新引用格式的确定性映射。

## 后果

- 仅当使用当前 IPFS profile 时，Push 才需要 Kubo。
- 对象存储支持是一个协议与客户端工程，不是纯运维配置任务。
- 存储适配器接口降低了平台特定安装成本，允许部署按持久性、访问与成本
  要求选择 IPFS、S3 或 R2。
- 后继设计必须在底层对象存储使用可变键的情况下，保持内容寻址完整性。
- 编辑内容产生新的 pack/manifest 键与一次 ref 更新。管理员可以删除或
  破坏云对象，但客户端必须拒绝这些字节，而不是静默改写链上提交的历史。
- 详细的首发契约见
  [ADR 0004](0004-mainnet-storage-neutral-successor-and-byos-scope.md)
  与 [BYOS 实施规格](../storage-byos.md)。该设计已作为 Suite v4 交付；
  剩余未完成工作仅限真实 AWS canary、发布证据与
  [交付状态](../backlog.md) 中记录的主网门禁。
