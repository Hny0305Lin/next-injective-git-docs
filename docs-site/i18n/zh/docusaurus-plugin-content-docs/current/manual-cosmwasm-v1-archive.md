# 06 · CosmWasm v1 归档 —— 只读历史仓库

状态：手册章节。读者：用户与开发者。最后更新：2026-10-05。

CosmWasm v1 是 igit 的**第一代**。其控制平面是 Injective 测试网上的一个
CosmWasm `repo-registry` 合约，其 Windows 工作流需要 WSL2 来承载 Linux CLI、
`injectived` 与 Kubo。移除这一兼容环境正是 EVM 代际存在的原因——见
[ADR 0001](adr/0001-evm-v2-runtime-and-migration-scope.md)。

v1 → EVM 的过渡（2026-08）是一次**空状态全新套件切换**：没有导入任何仓库
数据。因此 V1 以它被留下时的样子存续——作为**只读归档**，经专属查看器与
只读 CLI 证据工具访问。它绝不是自动回退，也绝不与 EVM 套件读取混合
（[ADR 0003](adr/0003-fresh-evm-suite-and-v1-archive-preview.md)）。

本章通篇使用的实操示例：

| 字段 | 值 |
|---|---|
| 所有者 | `inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5` |
| 仓库 | `demo-showcase` |
| V1 注册表合约 | `inj1mg6x7ht3zyyszed9aq67q6kd0y5rtq7wf756jh`（Injective 测试网） |
| Web URL | `https://www.igit.xyz/archive/cosmwasm-v1/inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase` |

## 归档在哪里

归档拥有独立于 EVM 仓库路由的 URL 空间：

| 路由 | 展示 |
|---|---|
| `/archive/cosmwasm-v1` | 归档落地页：浏览与搜索归档的所有者与仓库 |
| `/archive/cosmwasm-v1/<owner>` | 归档所有者的仓库列表 |
| `/archive/cosmwasm-v1/<owner>/<repo>` | 归档仓库查看器 |

归档在主导航中**没有入口**。你通过直接 URL、搜索或监控页的链接到达它。
这是刻意的：当前工作发生在 EVM 代际上；归档属于历史。

搜索同样识别归档内容：搜索归档的所有者或仓库时会提供 **View other V1
Archive results**，它直接查询 CosmWasm 合约并链入归档路由。若查询不能解析
到归档所有者，页面会明说而不是静默失败。

## 第 1 步 —— 打开实操示例

```text
https://www.igit.xyz/archive/cosmwasm-v1/inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase
```

你应该看到的，以及它们的含义：

| 元素 | 含义 |
|---|---|
| 横幅 | **Migration to EVM V2 or newer required** —— "This repository remains readable from the CosmWasm V1 archive. Editing and current repository features require a future migration to the EVM V2 or newer Suite." |
| 横幅按钮 | **Migration unavailable** —— v1 → EVM 的仓库级迁移路径今天并不提供 |
| 合约类型徽章 | **CosmWasm V1** |
| 描述 | `igit demo: README, code, history` |
| 统计行 | HEAD SHA、分支数、标签数、packfile 数（该 ref 指向三个历史 IPFS pack） |
| 标签页 | Code、Commits、Refs —— **没有 Sponsors 标签**，因为经济模块是 EVM 套件的能力 |

Code 标签像 EVM 仓库一样渲染归档的树与 README。在 Sponsors 的位置，归档
仓库显示：

> Sponsorship is unavailable for archived CosmWasm V1 repositories.

## 第 2 步 —— 理解“只读”意味着什么

归档是链状态的忠实冻结视图：

- **无写入。** 不存在执行路径。归档工具从不加载签名器，也从不广播 V1 交易。
- **今天没有迁移。** 横幅上的 "Migration unavailable" 按钮说的是实话：
  仓库级的 v1 → EVM 导入尚未构建。EVM 套件引导时有意识地不导入 V1 数据。
- **审核被保留。** 历史审核决定仍然可见。例如，早期导入
  `inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/igit-dev` 于 2026-08-05 被
  **冻结**（创建时用了非预期的名字；由 `Huawei-IAM-Java` 取代）——冻结
  状态、历史元数据、交易与直接审计查询都被有意识地保留，因为注册表在链
  上。参见[已归档仓库](archived-repositories.md)。
- **用户名可重领、未迁移。** V1 的用户名托管（escrow）*没有*被搬过来。
  取而代之，EVM UsernameModule 在引导完成时开启了一个 **90 天原所有者
  重领窗口**；窗口内原 V1 所有者可以重领自己的名字：

  ```console
  $ igit username claim <name>
  original username "<name>" claimed
  ```

  窗口关闭后，未重领的名字遵循普通注册规则。参见
  [第 07 章 · UsernameModule](manual-protocol-contracts.md)。

## 第 3 步 —— 了解读取如何工作

归档经 Cosmos LCD 智能查询读取冻结的合约：

- **合约：** Injective 测试网上的
  `inj1mg6x7ht3zyyszed9aq67q6kd0y5rtq7wf756jh`（合约自切换以来未变；可在
  [测试网浏览器](https://testnet.explorer.injective.network/contract/inj1mg6x7ht3zyyszed9aq67q6kd0y5rtq7wf756jh/)
  查看）。
- **endpoint 按序尝试：** 官方 Injective sentry LCD
  （`https://testnet.sentry.lcd.injective.network`）与 Polkachu 社区 LCD
  （`https://injective-testnet-api.polkachu.com`）。会话会粘住最近应答的
  endpoint；重试与响应大小都有上界。
- **快照高度：** 每个会话固定一个快照高度（会话开始时的最新区块），并以
  `x-cosmos-block-height` 发送，使一次浏览会话读取一致的状态。CORS 预检
  拒绝自定义头的 endpoint 会以其最新已提交状态被查询——对写冻结的归档
  而言，这是可接受的有界漂移，优于直接让读取失败。

## 第 4 步 —— 使用只读 CLI 证据工具

CLI 提供三个归档子命令。它们与普通配置及签名器加载刻意隔离——不能执行
任何东西：

```console
$ igit archive query --lcd https://testnet.sentry.lcd.injective.network \
    --contract inj1mg6x7ht3zyyszed9aq67q6kd0y5rtq7wf756jh \
    --height <N> '{"repo_info":{"owner":"inj1...","name":"demo-showcase"}}'
```

- `query` 对冻结合约执行任意智能查询，固定在指定 `--height`，并打印缩进
  的 JSON 响应。
- `inventory` 从保存的 `tx_search` 与区块证据文件构建固定高度的归档清单。
- `verify` 依据清单与保存的证据复核快照——用于离线证明你浏览的就是链上
  当时状态的审计路径。

历史固定高度查询**只能**通过 `igit archive` 获得；它们既不是推送配置，
也不是 EVM 路径的回退。

## 第 5 步 —— 了解还有什么在支撑这些 pack

V1 packfile 仍由历史数据面固定：美国全量 Kubo 节点 pin 每个曾出现在 V1
`update_ref` 中的 CID，把带 SHA-256 校验的 CAR 归档导出到冷存储，并把已
验证 CID 清单同步到读网关所服务的 HK 热层。该管线在
[IPFS 数据面](infrastructure.md)中按建成状态记录，是 V1 代际的归档来源。
它不是 Suite v4 BYOS 路径的一部分。

## 第 6 步 —— 明确你刚刚证明了什么

- [x] 你可以通过显式的归档 URL 到达一个归档仓库。
- [x] 你理解它为什么只读、为什么迁移不可用。
- [x] 你知道合约、LCD endpoint 与快照高度从何而来。
- [x] 你可以用 `igit archive query` 自己执行固定高度智能查询，复现查看器
      展示的内容。

## 状态边界

归档按定义属于 HISTORICAL：它记录 V1 代际，不是当前验收的组成部分。归档
查看器、其路由与 `igit archive` 工具已交付；从 V1 到 EVM 套件的仓库迁移
路径**未实现**，任何现行计划也没有承诺它。90 天用户名重领窗口是绑定在
EVM 套件引导上的一次性事件；窗口是否仍开放取决于套件的激活日期——用
`igit username show <name>` 查询。

## 下一步

- 较早 EVM 代际 → [第 05 章 · Suite v2 + v3](manual-suite-v2-v3.md)
- 最新 EVM 代际 → [第 04 章 · Suite v4](manual-suite-v4.md)
- 完整版本矩阵 → [套件版本兼容矩阵](suite-version-compatibility.md)
- 某处失败 → [第 10 章 · 故障排查](manual-troubleshooting.md)
