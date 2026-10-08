# igit 手册 —— 完整的用户与开发者指南

状态：手册主页。适用于当前 `dev` 线。最后更新：2026-10-05。

本手册是 Next Injective Git（igit）唯一、自成一体的完整操作说明：这是一个
Git 托管栈，其控制平面是一套不可升级的 Injective EVM 合约套件，其数据平面
是按版本分派的 pack 存储。

本手册同时面向**两类读者**：

- **用户**：安装 CLI、创建仓库、推送与克隆代码、在 Web 应用中浏览仓库，
  并理解每个界面所展示的内容。
- **开发者与运维**：需要链上合约模型、存储承诺协议、凭据规则、本地构建与
  测试闭环，以及项目确切的证据边界。

每一章都可以独立阅读。每个版本代际都有专属章节，配有具体命令与具体 URL。

## 本手册的组织方式

| # | 章节 | 读者 | 你将获得 |
|---|---|---|---|
| 00 | [手册主页](manual.md) | 两者 | 范围、版本地图、阅读路径、前置条件 |
| 01 | [快速开始](manual-getting-started.md) | 用户 | 安装、配置、第一个仓库、第一次推送 |
| 02 | [CLI 命令参考](manual-cli-reference.md) | 用户、运维 | 全部 `igit` 命令及精确语法 |
| 03 | [Web 应用指南](manual-web-guide.md) | 用户 | 每个界面、钱包流程、搜索、监控页 |
| 04 | [Suite v4（最新 EVM）实操](manual-suite-v4.md) | 用户、开发者 | BYOS 路径端到端，附完整示例 |
| 05 | [Suite v2 + v3（较早 EVM）实操](manual-suite-v2-v3.md) | 用户、开发者 | 旧 IPFS 路径端到端 |
| 06 | [CosmWasm v1 归档实操](manual-cosmwasm-v1-archive.md) | 用户、开发者 | 只读的历史仓库 |
| 07 | [链上合约与协议](manual-protocol-contracts.md) | 开发者 | 套件模型、ref 形态、验证链 |
| 08 | [BYOS 存储与凭据](manual-byos-storage.md) | 开发者、运维 | 存储配置、manifest、凭据规则 |
| 09 | [开发者指南](manual-developer-guide.md) | 开发者 | 仓库、构建、测试、CI、贡献 |
| 10 | [故障排查与 FAQ](manual-troubleshooting.md) | 两者 | 症状 → 原因 → 修复 |

## 你将遇到的三代版本

igit 有三代并存。它们**不是**同一运行时的不同选项，而是不同的协议代际：
链上 ref 形态不同、存储路径不同。客户端从不猜测——它从链上读取版本并分派。

| 代际 | 链上协议 | pack 存储 | 读/写 | 章节 |
|---|---|---|---|---|
| **Suite v4** | `suiteVersion() == 4` —— manifest 承诺（`manifestDigest` + `manifestSize` + `bootstrapLocator` + `revision`） | **BYOS**：你自有的 Amazon S3 或 Cloudflare R2 桶 | 可读**且可写** | [04](manual-suite-v4.md) |
| **Suite v2 + v3** | `suiteVersion() <= 3` —— `commitSha` + `packUris(string[])` | **IPFS**：经网关读取 `ipfs://CID` | 可读**且可写** | [05](manual-suite-v2-v3.md) |
| **CosmWasm v1** | CosmWasm 合约状态（独立的链路径） | 历史 IPFS | **只读**归档 | [06](manual-cosmwasm-v1-archive.md) |

全项目使用两层命名，务必区分：

- **EVM V2** 是*产品代际*名称。它描述的是把控制平面从 CosmWasm 迁到
  Injective EVM，从而使普通的 Windows 与 Linux 操作不再需要 WSL2、
  `injectived` 或本地 Kubo 守护进程。
- **Suite v3 / v4** 是*协议版本*号，从链上 `SuiteDirectory.suiteVersion()`
  读取。

因此“EVM V2 代际”同时涵盖 Suite v3 与 Suite v4。权威表述见
[ADR 0001](adr/0001-evm-v2-runtime-and-migration-scope.md) 与
[套件版本兼容矩阵](suite-version-compatibility.md)。

### 一句话选版本

- **Suite v4 是当前最新路径。** 它是 2026-10-05 交付的存储中立后继。pack
  上传到你的自有桶，manifest 承诺写入链上，读取端执行完整验证回读。
  → [第 04 章](manual-suite-v4.md)
- **Suite v2 与 v3 是较早的 EVM 路径。** Suite v3 是首个 EVM 发布，按设计
  已冻结；每个 ref 指向一个或多个 `ipfs://` CID。Suite v2 从未作为 EVM
  套件部署过——若真出现 v2 仓库，也会按 v3 形态读取。→ [第 05 章](manual-suite-v2-v3.md)
- **CosmWasm v1 已归档。** 只能通过显式的只读归档查看器访问，绝不作为
  自动回退。→ [第 06 章](manual-cosmwasm-v1-archive.md)

## 贯穿全册的实操示例

本手册所有实操示例使用同一个真实测试网账户，便于你把自己的输出与具体
结果对照：

| 字段 | 值 |
|---|---|
| Injective（bech32）地址 | `inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5` |
| EVM 地址 | `0x85EAC7BC081488AA77D1D82F9CB8E053DE1E4FA8` |
| 本地账户标签 | `igit-dev` |
| 示例仓库 | `demo-showcase` |
| 网络 | Injective 测试网（EVM 链 ID `1439`） |

同名仓库同时存在于多个代际。这正是 Web 应用接受 `?suite=` 参数的原因——
它表达的是读者指的是*哪个代际的同名副本*：

- 最新 EVM，Suite v4（BYOS）：
  `https://www.igit.xyz/inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase?suite=4`
- 较早 EVM，Suite v3（IPFS）：
  `https://www.igit.xyz/inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase?suite=3`
- 已归档的 CosmWasm v1（只读）：
  `https://www.igit.xyz/archive/cosmwasm-v1/inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase`

`?suite=` 参数的完整说明见
[第 03 章](manual-web-guide.md#suite-查询参数)，并按版本分别应用于
[第 04 章](manual-suite-v4.md#第-6-步--在-web-应用中浏览仓库)
与 [第 05 章](manual-suite-v2-v3.md#第-6-步--在-web-应用中浏览仓库)。

## 信任根在哪里

普通客户端——CLI、`git-remote-igit` 与 Web 应用——每个代际只信任**唯一**
一个已配置的 `SuiteDirectory` 地址。没有代理、没有 diamond、没有
`delegatecall`、没有隐式回退路径。客户端按顺序验证：

1. RPC 链 ID 与所配置的 profile 一致；
2. `suiteVersion()` 是已知版本（3 或 4）；
3. Directory 状态为 `active`；
4. 合约内存储的 `configuredChainId` 与当前 RPC 一致；
5. 每个模块地址可解析且每个模块代码哈希匹配；
6. 每个模块内部都绑定到同一个 Directory。

任何一步失败，客户端立即 fail-closed，绝不静默降级。见
[第 07 章](manual-protocol-contracts.md#验证链)。

测试网 profile 当前按以下顺序列出**两个** SuiteDirectory 地址：

```text
0xf987396475d0a4c96b722e993a95d8720a6292ad   # Suite v4（BYOS 后继）
0xf8844F90887731FFd607E1f59e39a3918F6eAb35   # Suite v3（IPFS）
```

**第一个**地址是主读取目标；列表内所有套件的仓库会在列表中合并显示。
这正是 `?suite=3` 与 `?suite=4` 在同一个仓库 URL 上有意义的原因。

## 前置条件

| 组件 | 要求 | 说明 |
|---|---|---|
| 操作系统 | 原生 Windows 或 Linux | EVM 路径**不**需要 WSL2 |
| Git | 任意较新版本，remote helper 需在 `PATH` 可见 | `igit` 将未知子命令转发给 `git` |
| Node.js | ≥ 24 | 仅用于构建文档站 |
| Go | 1.22 或更新 | 仅用于从源码构建 CLI |
| Injective 账户 | 持有少量 INJ 余额的测试网密钥 | gas 价格下限为 `160000000 wei` |
| 云存储桶 | Amazon S3 或 Cloudflare R2 | **仅 Suite v4**；v4 推送必需 |
| Kubo | 本地守护进程 | **仅 Suite v3**；v3 推送必需 |

普通 EVM 操作**不**需要 `injectived`。去掉它正是 EVM V2 代际的全部意义。

## 阅读路径

**如果你只想今天就用起来**

1. [第 01 章 —— 快速开始](manual-getting-started.md)
2. [第 04 章 —— Suite v4 实操](manual-suite-v4.md)
3. [第 03 章 —— Web 应用指南](manual-web-guide.md)
4. [第 10 章 —— 故障排查](manual-troubleshooting.md)

**如果你在旧 IPFS 代际上维护仓库**

1. [第 01 章 —— 快速开始](manual-getting-started.md)
2. [第 05 章 —— Suite v2 + v3 实操](manual-suite-v2-v3.md)
3. [第 02 章 —— CLI 参考](manual-cli-reference.md)

**如果你在做集成或审计**

1. [第 07 章 —— 合约与协议](manual-protocol-contracts.md)
2. [第 08 章 —— BYOS 存储与凭据](manual-byos-storage.md)
3. [第 09 章 —— 开发者指南](manual-developer-guide.md)

## 必须遵守的状态边界

本项目以受限词汇发布状态——`PASS`、`FAIL`、`BLOCKED`、`NOT PROVEN`、
`HISTORICAL`。这些标签在两种语言中原样使用，不得弱化。特别地：

- Suite v4 在 Injective 测试网、CLI/Web 版本分派、以及真实 Cloudflare R2
  端到端 Git 流程已**交付**。
- 真实 AWS S3 canary（金丝雀验证）、Foundry 门禁、后继发布证据、安全审计
  与主网治理审批仍**未完成**。
- 已发布网络 profile 中的 `SuiteDirectory` 在真实部署与切换（cutover）证据
  获批之前刻意保持为空。不得把测试地址当作正式地址。

权威记录见 [project status](project-status.md) 与
[acceptance evidence](acceptance-evidence.md)。

## 术语

翻译或改写任何内容前先查[术语表](glossary.md)。其中两条规则贯穿全册：

- **Suite v3** 指 IPFS/Kubo 旧路径。**Suite v4** 指 BYOS 后继，其生产配置
  **仅支持 Amazon S3 与 Cloudflare R2**。
- [BYOS 厂商路线图](roadmap-byos-providers.md)中追踪的六家中国大陆
  S3 兼容厂商**仅为 roadmap 候选**：未支持、未接入；其 endpoint 不得出现
  在任何配置示例或生产指引中。
