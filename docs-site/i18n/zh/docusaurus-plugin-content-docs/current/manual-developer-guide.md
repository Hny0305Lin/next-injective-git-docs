# 09 · 开发者指南

状态：手册章节。读者：开发者。最后更新：2026-10-05。

本章面向任何要在本地构建整套栈、扩展客户端或参与贡献的人：仓库布局、
CLI/Web/合约的构建与测试闭环、协议测试向量、如何为未来的套件版本添加
支持，以及项目运转所依赖的文档与证据规则。

## 仓库布局

| 路径 | 内容 |
|---|---|
| `contracts/evm-v2/` | Suite v3 —— 九个 Solidity 合约、Foundry 配置、已检入的 `abi/`、`artifacts/`、`out/` |
| `contracts/evm-v2-successor/` | Suite v4 —— 演进后的 `RepositoryCore.sol`；其余八个源文件与 v3 字节一致 |
| `cli/` | `igit`（`cmd/igit`）、`git-remote-igit`（`cmd/git-remote-igit`）、套件部署与迁移工具、`internal/` 包 |
| `web/` | React + Vite 浏览器应用（Suite 读取与 legacy EVM 交易使用 viem） |
| `protocol/` | 共享协议材料 —— `packmanifest/vectors.json` canonical-JSON 交叉向量 |
| `scripts/` | 源码、发布、迁移证据、IPFS 复制与运维门禁 |
| `archive/cosmwasm-v1/` | 隔离的只读 V1 源码、协议材料与证据工具——**不**属于默认构建 |
| `docs/` | 文档内容源（本手册在此） |

## 工具链

| 工具 | 版本 | 用途 |
|---|---|---|
| Go | 1.22+ | CLI 与工具 |
| Node.js | 24+ | Web 应用与文档站 |
| Foundry（`forge`） | 当前版本 | 可选合约测试；见下方 Foundry 注记 |
| Git | 任意较新 | 一切 |

任何工作流都不需要 `injectived` 与 WSL2。

## 构建与测试 CLI

```console
$ cd cli
$ go build -o igit             ./cmd/igit
$ go build -o git-remote-igit  ./cmd/git-remote-igit

$ go vet ./...
$ go test ./...
```

把两个二进制都放到 `PATH`；它们必须来自同一构建，因为 helper 与 CLI 之间
使用带版本的协议。测试完全离线运行：后继链经
`cli/internal/chain/successor/fakechain`（一个合约保真的假链）执行，云存储
经假 transport，Git 经真实本地 fixture。原生 Kubo 集成测试通过
`IGIT_RUN_NATIVE_KUBO_INTEGRATION=1` 选择启用，否则跳过。

扩展存储或链行为时的有用包：`internal/packmanifest`（canonical JSON）、
`internal/packstore`（writer/reader 适配器，`aws-s3` 在 `packstore/s3store`、
IPFS 在 `packstore/ipfsstore`）、`internal/storageconfig`（存储引用文件）、
`internal/safehttp`（SSRF 加固 transport）、`internal/byos`（后继推送/获取
服务）、`internal/remote`（带 v3/v4 分派的 Git remote helper）。

## 构建与测试 Web 应用

```console
$ cd web
$ npm ci
$ npm run dev            # Vite 开发服务器
$ npm run test:api       # API 级测试套件
$ npm run typecheck
$ npm run build

$ npm run test:storage-cross   # Go ⇄ TS canonical-JSON 交叉向量
$ npm run test:e2e             # Playwright 浏览器测试
```

本地环境变量（从 `.env.example` 复制）：`VITE_WALLETCONNECT_PROJECT_ID`
（一个公开的 Reown 项目标识，其允许清单需包含你的源站）以及仅 MapMonitor
页需要的 AMap key/安全码。绝不提交真实 key。

## 构建与测试合约

Solidity 精确锁定在 **`0.8.24`**（不是 `^`），启用优化器与 `via_ir`，且
**无外部依赖**。可移植门禁以锁定的 solc 编译、拒绝被禁用的升级原语
（`delegatecall`、`selfdestruct`）、强制 EIP-170/EIP-3860 限制，并且——对
后继而言——验证"与 v3 相比未变"的文件集与已检入 `abi/` / `artifacts/`
的一致性：

```console
$ npm ci --prefix contracts/evm-v2
$ npm run check --prefix contracts/evm-v2           # 或 --write-abi / --write-artifacts

$ npm ci --prefix contracts/evm-v2-successor
$ npm run check --prefix contracts/evm-v2-successor
```

装有 Foundry 时，你还可以额外运行套件的状态机测试、引导顺序、策略挂钩、
能力、gas 报告与不变量检查：

```console
$ cd contracts/evm-v2 && forge build && forge test -vvv
```

> **Foundry 注记。** 项目自己的机器当前 `PATH` 上没有 `forge`，因此项目
> 状态将 Foundry 门禁记录为 **BLOCKED（R04）**——可移植 solc 门禁是永远
> 可用的检查。如果你装有 Foundry，请运行它；但当证据被要求时，不得以
> solc 输出替代 Foundry 结果。

后继的 Go 绑定位于 `cli/internal/chain/successor`；内嵌 ABI 必须与
`abi/*.json` 保持一致，构建期测试会在漂移时失败。

## 协议向量

`protocol/packmanifest/vectors.json` 保存 canonical-JSON 交叉向量（正向与
拒绝用例，包括重复键、Unicode、排序、uint256 极值与超限输入），由真实的
TypeScript 实现生成，并由 Go 实现独立验证。在 `web/` 下用
`npm run test:storage-cross` 运行交叉检查。仅在有意修改 schema 时才重新
生成 fixture（`npm run fixtures:storage`）——绝不是为了让失败的用例通过。

## 为未来套件版本添加支持

客户端按链上 `suiteVersion()` 分派；未知版本（v5+）已经能通过验证并以最新
已知 ABI 读取并给出警告。要让客户端显式学习新版本：

1. **Web** —— 更新 `web/src/lib/suite-compat.ts`：把版本加入
   `KNOWN_VERSIONS`，扩展 reader ABI 表，并且——仅当 ref ABI 确实变化时
   ——在 `registry.ts` 加解码器、在 `gitstore.ts` 加 reader。
2. **CLI** —— 更新 `cli/cmd/git-remote-igit/main.go` 的版本探测/分派，以及
   `cli/internal/chain` 的 ABI 面（`suite_abi.go`、后继绑定）。
3. **合约** —— ref 形态变化意味着**全新套件**，绝不是升级既有套件；见
   [第 07 章](manual-protocol-contracts.md)。遵循 ADR 流程，并保持版本
   矩阵（`docs/suite-version-compatibility.md`）的权威地位。

## 发布与切换门禁（摘要）

带标签的发布只为 Linux、macOS 与 Windows 发布 `igit` 与
`git-remote-igit` 及 `checksums.txt`。发布工作流要求 Go vet/测试与 race
测试、Web API/类型/构建测试、固定 `solc 0.8.24` 编译、Foundry 套件测试、
已检入 ABI 与工件一致性、不可变 profile 守卫，以及确定性资产校验和。
公开 CLI/Web profile 守卫有意识地要求 `SuiteDirectory` **为空**，直到一次
单独评审过的切换同时更改两个 profile——完整证据清单见
[发布与切换](release.md)。

## 参与文档工作

文档是双仓库系统：

- **内容事实源**：主仓库的 `docs/`（英文是唯一事实源；中文是翻译层，
  绝不得超前英文）。
- **站点**：`next-injective-git-docs` 在 `docs-site/` 下承载 Docusaurus 3
  工具链，外加由 `npm run sync:docs` 产出的 `docs/` **只读镜像**——绝不
  手改镜像。

新增或修改页面的标准流程：

```console
# 1. 在主仓库 docs/ 中编辑/创建英文页
# 2. 在 docs-site/sidebars.js 中登记
# 3. 为未翻译页面生成中文占位
npm --prefix docs-site run gen:zh-stubs
# 4. 镜像并验证
npm --prefix docs-site run sync:docs
npm --prefix docs-site run build
```

写作或翻译前先查[术语表](glossary.md)；状态用语（`PASS`、`FAIL`、
`BLOCKED`、`NOT PROVEN`、`HISTORICAL`）逐字使用，不得弱化。不可变证据
——ADR、部署工件、plans、manifests、journals、receipts——绝不修改或
补造。

## 证据纪律

项目把主张与证据分开，贡献也应保持这一分离：

- 通过的主张绑定到命令、输出与（对发布而言）提交 SHA。计划不是证据；
  mock 不是真实环境证明。
- `NOT PROVEN` 与 `BLOCKED` 是一段工作窗口内合法的终态——如实报告；
  绝不补造缺失的结果。
- 测试网地址就是测试地址。它们不是正式地址，绝不能提交进已发布 profile。

## 接下来看什么

- 合约模型 → [第 07 章](manual-protocol-contracts.md)
- 存储协议 → [第 08 章](manual-byos-storage.md)
- 架构决策 → [ADR 索引](adr/)
- 当前工作状态 → [project status](project-status.md)、
  [backlog](backlog.md)、[delivery roadmap](delivery-roadmap.md)
