# 07 · 链上合约与协议

状态：手册章节。读者：开发者。最后更新：2026-10-05。

本章是 igit 控制平面的开发者视角模型：套件是什么、它如何部署并冻结、每个
合约做什么、两个 EVM ref 形态如何不同，以及客户端在读或写之前究竟验证
什么。来源：`contracts/evm-v2/`（Suite v3）、`contracts/evm-v2-successor/`
（Suite v4）与[套件版本兼容矩阵](suite-version-compatibility.md)。

## 套件一览

控制平面是一个**不可升级**的九合约套件。没有代理、没有 diamond、没有
`delegatecall`、没有升级入口；构建门禁会拒绝任何匹配
`delegatecall|selfdestruct` 的生产源码文件，激活后也不存在能够更改模块的
owner 或治理角色。

**基础设施合约（2 个）** —— 不是模块、不参与激活循环：

| 合约 | 职责 |
|---|---|
| `SuiteDirectory` | 唯一信任根：状态机、链 ID、快照根、模块地址/代码哈希注册表、`verifyModule` |
| `BootstrapCoordinator` | 一次性有序引导：向 Directory 注册模块、在滚动承诺下导入状态、激活 |

**生产模块（7 个）** —— 各由一个 `SuiteIds` 常量与 `moduleId()` 标识：

| 模块 | `SuiteIds` 常量 | 职责 |
|---|---|---|
| `RepositoryCore` | `igit.module.repository-core` | 仓库身份、ref、协作者、有界 fork、带时间锁的所有权 |
| `RecoveryModule` | `igit.module.recovery` | 守护人配置与带时间锁的多签审批恢复 |
| `ModerationModule` | `igit.module.moderation` | 状态、报告、申诉与强制性策略挂钩 |
| `EconomicModule` | `igit.module.economic` | 原生 INJ 赞助、收益分成、平台费 |
| `UsernameModule` | `igit.module.username` | 保留名与限时的原所有者重领 |
| `BadgeModule` | `igit.module.badge` | 不可转让贡献徽章 |
| `ReleaseModule` | `igit.module.release` | 不可变的 `(version, platform) → sha256` 发布校验和 |

`SuiteIds.REQUIRED_MODULES = 7`。每个模块继承 `SuiteModule`，后者提供引导
状态、滚动承诺折叠与两个贯穿全局的访问修饰符：`onlyBootstrap` 与
`onlyActiveSuite`。

## 部署与冻结

一个套件在一段有向序列中从无到不可变：

1. **构造函数钉死上下文。** `SuiteDirectory(authority, chainId,
   snapshotRoot)` 要求非零 authority、`chainId == block.chainid` 与非零快照
   根。`configuredChainId` 与 `snapshotRoot` 是 `immutable`。
2. **协调器恰好配置一次。** `setBootstrapCoordinator` 检查协调器运行时代码
   哈希、交叉校验协调器自身的 `suiteDirectory()`/`snapshotRoot()` 绑定，
   然后**清零 `bootstrapAuthority`**——永远无法设置第二个协调器。
3. **每个模块恰好配置一次。** `configureModule` 只接受七个必需 id、要求
   实时代码匹配期望哈希，并要求模块内部绑定（`suiteDirectory()`、
   `bootstrapCoordinator()`、`moduleId()`）完全一致。
4. **状态按固定顺序导入。** 协调器推进单一 `nextModuleIndex`；批次按计数、
   序号与折叠到
   `keccak256(abi.encode(rollingRoot, moduleId, sequence, count, payloadHash))`
   的滚动根记账。终结 Username 模块还额外要求非零的用户名托管证据哈希——
   证明 V1 托管负债未被迁移的链上宣誓。
5. **激活原子且永久。** `activate()` 复查链 ID、要求七个模块全部在位且代码
   哈希匹配、`bootstrapFinalized()` 为真、`readyForActivation()` 通过，然后
   置 `state = Active` 并发出 `SuiteActivated`。

不存在回到 `Bootstrapping` 的代码路径：没有停用、没有模块重注册、没有协调
器替换、没有代码哈希更新。这就是协议变更——包括 v3 → v4 的 ref 形态变更
——只能是**全新套件**、绝不是升级的原因。

## 验证链

普通客户端（CLI、`git-remote-igit`、Web）只信任一个已配置的
`SuiteDirectory` 地址，并在任何读或写之前验证：

1. RPC `eth_chainId` 与所配置 profile 一致（测试网 `1439`，规划中的主网
   `1776`）。
2. Directory 在一个钉住的区块标签上有代码——随后所有读取都使用同一标签，
   一致快照。
3. `state == Active`（`1`）。
4. `suiteVersion()` 是已知版本——**3 或 4**；v5+ 能通过验证，但以最新已知
   ABI 读取并给出警告；早于 3 的版本被拒绝，因为不存在 EVM 读取路径。
5. 合约内的 `configuredChainId` 等于当前链 ID。
6. `registeredModuleCount == 7`；协调器地址有效且其运行时代码哈希与记录的
   `bootstrapCoordinatorCodeHash` 一致。
7. 对七个模块逐一：`moduleAddress(id)` 可解析、`verifyModule(id)` 返回真
   （代码在位、代码哈希匹配、模块绑定到*这个* Directory、*这个* 协调器、
   *这个* id）、实时代码哈希匹配，且在模块上直接读取 `suiteDirectory()`、
   `bootstrapCoordinator()`、`moduleId()` 全部一致。

已验证的绑定缓存 30 秒；钱包连接与验证相互独立，但**没有已验证的 Suite
就没有任何写操作**。任何一步失败，客户端 fail-closed——绝不静默降级或
回退到其他后端。

## RepositoryCore

核心模块拥有仓库身份与 ref。

**身份。** `repoId` 在创建时派生：

```solidity
repoId = keccak256(abi.encode("igit:suite:v3:repo", block.chainid, suiteDirectory, msg.sender, name));
```

（该字面前像在 v4 core 中仍为 `"igit:suite:v3:repo"`——此处按源码原样复述。）
辅助定位符 `keccak256(abi.encode(owner, name))` 支持改名/转移而不破坏历史
URL。

**链上校验。** 仓库名为 1–64 字节 `[a-zA-Z0-9._-]`；ref 名为 5–256 字节、
以 `refs/` 开头并排除 Git 危险字符；提交 SHA 恰为 40 或 64 位十六进制；v3
pack URI 必须以 `ipfs://` 开头（v3 core 不接受 HTTPS）；分页大小上限 64。

**关键函数。** `createRepository`、`forkRepository`（v3：复制至多 64 个
ref；v4：仅元数据）、`updateMetadata`、`updateRef`、`deleteRef`、
`setCollaborator`、所有权转移家族（`begin` / `cancel` / `accept` / `expire`，
带 **7 天延迟**与 **30 天接受窗口**）、`recoverOwnership`（仅 Recovery 模块
可调用），以及分页读取器（`listRepositoriesPage`、`listRefsPage`、
`listCollaboratorsPage`）。

角色为 `None` / `Maintainer` / `Reader`，每仓库协作者上限 256、ref 上限
1024。

## 两种 ref 形态

### Suite v3 —— `commitSha` + `packUris`

```solidity
struct GitRef {
    string commitSha;
    string[] packUris;   // 有序 ipfs://CID 列表，1..128 项
    uint64 updatedAt; address updatedBy; bool exists;
}
```

`updateRef(repoId, refName, commitSha, packUris, expectedSha, force)`：
非强制更新要求 `expectedSha` 等于已存储的提交 SHA（否则 `ShaMismatch`），并
把新 URI **合并**进既有列表；强制更新跳过比较并替换列表。`deleteRef` 整体
删除条目——没有 tombstone，也没有 revision 概念。

### Suite v4 —— manifest 承诺 + revision

```solidity
struct GitRef {
    bytes32 manifestDigest;   // canonical JCS manifest 字节的 SHA-256
    uint96 manifestSize;      // 1..65_536
    string bootstrapLocator;  // https://…，≤512 字符
    uint64 revision;          // 从 1 起单调，永不重置
    uint64 updatedAt; address updatedBy; bool exists;
}
```

`updateRef(repoId, refName, commitSha, manifestDigest, manifestSize,
bootstrapLocator, expectedRevision, expectedManifestDigest, force)` 对**每次**
写入强制比较并交换：创建期望 `(0, bytes32(0))`，更新期望当前
`(revision, digest)`，删除后重建期望 tombstone revision 加零摘要。不匹配
revert `CommitmentMismatch`。`commitSha` 被校验并写入事件，但**从不存储**——
提交 OID 位于 manifest 内部，由已承诺的摘要绑定。删除是 **tombstone**
（摘要清零、revision 保留），因此重放过期的创建会失败，删除/重建无法 ABA。

事件把完整 ref 名作为 data 携带（仅以 `refId = keccak(refName)` 建索引），
索引器因此可以还原完整名字而无需猜测。

### 两套件间的字节一致性

在 `contracts/evm-v2-successor/src` 中，除 `RepositoryCore` 外的八个合约与
v3 源码字节一致；`SuiteDirectory` 仅在 `suiteVersion = 4` 上不同。
`RepositoryCore` 是唯一被重写的合约——承诺状态、CAS、tombstone、可还原
ref 名的事件，以及被移除的 pack-URI 机制。

## 模块参考

### RecoveryModule

至多 **10 名守护人**，由所有者配置阈值；恢复提案经 **7 天延迟**成熟、
**30 天窗口**后过期。过期配置（配置后所有者已变更）revert
`GuardianConfigStale`。`executeRecovery` 要求由被提议的新所有者执行、达到
阈值、延迟已过。该模块是 `RepositoryCore.recoverOwnership` 接受的**唯一**
调用者。

### ModerationModule

状态 `Active` / `Frozen` / `Delisted`；带理由（≤128 字节）的报告、委员会
处理、所有者申诉与完整行动轨迹。委员会地址由模块管理员配置。该模块的
策略挂钩是整套件其余部分的执行点（见下一节）。

### EconomicModule

`sponsor(repoId, message)` 是 payable 的原生 INJ 调用：计入仓库赞助总额，
计算 `fee = value * platformFeeBps / 10_000` 给国库，按
`(distributable * bps) / 10_000` 分配每份收益分成，剩余支付给仓库所有者。
约束：至多 **20** 个分成接收者、总 bps ≤ 10 000、平台费上限 **500 bps
（5%）**、所有者不得作为分成接收者、消息 ≤256 字节。所有权转移会经
Core-only 挂钩**清空分成并取消任何进行中的恢复**。

### UsernameModule

名字为 3–32 字节 `[a-z0-9-]`、不以 `-` 开头或结尾、绝不以 `inj1` 开头。
`registerUsername` 把名字锁定给调用者；`releaseUsername` 归还；
`claimOriginalUsername` 是引导后面向 V1 原所有者的 **90 天**窗口；保留名单
（策略管理员）阻止对战略性名字的抢注。每地址一个用户名；`usernameOf` 做
反向查询。

### BadgeModule

仅所有者可 `awardBadge(repoId, recipient, reason)`，理由 1–256 字节；所有者
不能给自己发徽章。徽章是结构体记录——刻意**没有 ERC-721/1155 转让面**，
这正是其不可转让性的来源。按接收者与按仓库分页列举。

### ReleaseModule

发布权威登记不可变的 `(version, platform) → sha256` 记录（token 为 1–64
字节 `[a-zA-Z0-9._-]`）；重复登记既有键 revert
`ArtifactAlreadyRegistered`。`igit release verify <version> <platform>
<file>` 重算文件 SHA-256 并与链上比对。

## 审核挂钩是强制性的

审核不是建议。Core 与 Economic 在改变状态之前调用 Directory 绑定的
Moderation 模块，且该挂钩无法通过不配置模块来绕过（`_moderation()` 对零
地址 revert `SuiteNotActive`）：

- `updateRef` / `deleteRef` → `requireRefMutation` —— **Frozen** 时 revert
  `RepositoryFrozen`；
- `sponsor` → `requireEconomicAction` —— **Frozen** 时 revert；
- `forkRepository` → `requireFork` —— 要求 **Active**；
- `awardBadge` → `requireBadgeAward` —— 要求 **Active**。

注意不对称性：**Delisted** 仓库从列表隐藏但仍可变更 ref；**Frozen** 仓库
不能。两种状态都在列表与 Web 仓库页可见。

## 交易规则

- **只用 legacy type-0 交易。** 所有写操作——CLI keystore 与 Web 钱包一样
  ——都按 legacy 交易签名。EIP-1559/type-2 未实现，留待未来的带资金 type-2
  金丝雀验证。
- **最低 gas 价**在链 1439（及 1776）上为 `160000000 wei`，当 RPC 报价更低
  时两个客户端都会应用该下限。
- **带余量的 gas 估算**（CLI 加 10 000；Web 乘 1.4 再加 10 000）。
- **回执窗口约 2 分钟。** 若回执未确认，客户端报告交易哈希并**使缓存的
  nonce 失效**——绝不盲目以新 nonce 重播。在
  [testnet Blockscout](https://testnet.blockscout.injective.network/) 上查
  该哈希，再有意识地重试。
- **无 gas 赞助。** 链原生 feegrant 包装器不是不可变套件运行时的一部分；
  `sponsor` 支付的是仓库收益，不是 gas。

## 套件今天在哪里

| 套件 | 测试网 SuiteDirectory | 状态 |
|---|---|---|
| v4（BYOS 后继） | `0xf987396475d0a4c96b722e993a95d8720a6292ad` | 已部署并激活；尚未作为公开发布 profile |
| v3（IPFS） | `0xf8844F90887731FFd607E1f59e39a3918F6eAb35` | 已部署并激活；路径冻结 |

已发布网络 profile 在获批切换证据存在之前保持 `SuiteDirectory` **为空**；
配置地址永远是用户的显式本地选择，且测试地址绝不可被描述为正式地址。

## 状态边界

九个生产合约在固定的 `solc 0.8.24` 下编译并通过可移植 solc 门禁；后继套件
已部署并激活于 Injective 测试网，真实 Cloudflare R2 端到端 Git 流程为
**PASS**。Foundry 单元/不变量/gas 门禁、后继的 Blockscout 源码验证、安全
审计、发布证据与主网审批仍**未完成**——权威记录见
[project status](project-status.md)，任何派生材料都不得弱化这些标签。

## 下一步

- 存储承诺细节 → [第 08 章 · BYOS 存储](manual-byos-storage.md)
- 构建与测试整套栈 → [第 09 章 · 开发者指南](manual-developer-guide.md)
- 完整版本矩阵 → [套件版本兼容矩阵](suite-version-compatibility.md)
