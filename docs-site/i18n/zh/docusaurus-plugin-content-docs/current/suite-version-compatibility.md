# 套件版本兼容矩阵

状态：生效策略。最近更新：2026-10-05。

## 概述

igit 协议经历了多个世代。本文档是"存在哪些套件协议版本、各版本仓库内容
如何读取、CLI 与 Web 客户端支持什么"的**唯一事实源**。

## 协议版本表

| 版本 | 世代 | 链上 ref 形态 | Pack 获取 | CLI 读取 | Web 读取 |
|---------|-----|-------------------|----------------|------------|------------|
| v1 | CosmWasm（已归档） | CosmWasm 合约状态 | IPFS（历史） | 归档工具（只读） | `cosmwasm-v1.ts`（归档标签页） |
| v2 | EVM（v3 前，未部署） | —（假定与 v3 相同） | — | —（v3 回退） | v3 回退 |
| v3 | EVM V2 首个发布 | `commitSha + packUris(string[])` | IPFS 网关 | 旧路径（Kubo/网关） | `registry.ts` 旧路径 + `gitstore.ts` loadRef |
| v4 | EVM V2 后继 | `manifestDigest + manifestSize + bootstrapLocator + revision` | BYOS（aws-s3/cloudflare-r2） | BYOS 路径（已验证 manifest） | `registry.ts` 后继 + `gitstore.ts` loadVerifiedRef |
| v5+ | 未来 | 未知 | 未知 | —（需更新） | v4 ABI 回退 + 警告 |

## 规则

### R1：链上版本是权威
SuiteDirectory 合约上的 `suiteVersion()` 决定读写使用哪种协议形态。客户端
从不猜测；它们从链上读取版本并据此分派。

### R2：v3 及更早 → IPFS 路径
`suiteVersion <= 3` 的套件把 ref 存为 `commitSha + packUris[]`，每个
packUri 是一个 `ipfs://CID`。内容经 IPFS 网关获取。该路径已冻结，不再
新增功能。

### R3：v4 → BYOS 路径
`suiteVersion == 4` 的套件把 ref 存为 manifest 承诺（摘要/大小/定位符）
加一个单调递增的 revision 用于 CAS。内容经已验证的 manifest 读取器从用户
自有云存储（AWS S3 / Cloudflare R2）获取。这是当前活跃开发路径。

### R4：v5+ → 尽力回退
未知的未来版本（v5+）在套件验证时被接受，并尝试使用最新已知 ABI（v4）。
若 ABI 未变，浏览正常但显示警告徽标；若 ABI 已变，用户得到清晰的解码错误
而不是一刀切的版本拒绝。增加显式 v5 支持只需更新 `suite-compat.ts` 与
`registry.ts`/`gitstore.ts` 中对应的读取器。

### R5：v1（CosmWasm 归档）是独立通道
V1 仓库通过 Web 的专属归档标签页与 `archive/cosmwasm-v1` 工具访问。它们
是只读的，绝不与 EVM 套件读取混用。

### R6：同一时刻只指向一个 SuiteDirectory
CLI 与 Web 都只指向一个 SuiteDirectory 地址。要浏览另一套件世代的仓库，
就更换配置的地址。版本分派是透明的——读取器按链上版本自动选择。

## 实现要点

| 模块 | 职责 |
|--------|---------------|
| `web/src/lib/suite-compat.ts` | 版本分派表、ref 形态映射、未来版本策略 |
| `web/src/lib/transport.ts` | 套件验证（接受 v3+）、绑定中的版本 |
| `web/src/lib/registry.ts` | 由 `refShapeForVersion()` 分派的 ref 读取 |
| `web/src/lib/gitstore.ts` | 由 ref 承诺存在性分派的 pack 加载 |
| `cli/internal/remote/byos.go` | CLI BYOS 路径（v4） |
| `cli/internal/remote/helper.go` | CLI 旧 IPFS 路径（v3） |
| `cli/cmd/git-remote-igit/main.go` | CLI 版本探测与分派 |

## 迁移历史

| 转变 | 变化了什么 | 迁移数据了吗？ |
|-----------|--------------|----------------|
| v1 → v3（2026-08） | CosmWasm → EVM（全新套件，无导入） | 否（空状态切换） |
| v3 → v4（2026-10） | IPFS packUris → manifest 承诺 | 否（全新套件，无导入） |

未来的转变沿用同一模式：部署全新套件，新仓库落在新套件上，旧套件保持经
其原始路径可读。
