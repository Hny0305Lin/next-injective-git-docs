# 05 · Suite v2 + v3 实操 —— 较早 EVM 代际（IPFS）

状态：手册章节。读者：用户与开发者。最后更新：2026-10-05。

Suite v3 是 igit 首个已发布的 EVM 代际。其控制平面与 v4 一样是不可升级的
九合约套件，但其**数据平面**是 IPFS：每个 ref 存储一个提交 SHA 加一个有序
的 `ipfs://CID` pack URI 列表，pack 经 IPFS 网关读取。

该代际**按设计冻结**（[ADR 0002](adr/0002-pluggable-pack-storage.md)）：
不再获得新的存储特性，全部新开发都发生在 [Suite v4](manual-suite-v4.md) 上。
它仍然完全可读可写，既有的 v3 仓库也永远通过其原始路径可达。

> **为什么叫"v2 + v3"？** "EVM V2" 是*产品代际*名称——把控制平面从
> CosmWasm 迁到 Injective EVM 这件事。Suite v2 从未作为 EVM 套件**部署**；
> Suite v3 才是首个 EVM 发布。若真出现 v2 套件，其 ref 早于后继 ABI，会按
> v3 形态读取。这就是该代际的 Web 徽章显示 **EVM V2 + V3**、套件徽章显示
> **Suite v3 · IPFS** 的原因。

本章通篇使用的实操示例：

| 字段 | 值 |
|---|---|
| 所有者（Injective 地址） | `inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5` |
| 所有者（EVM 地址） | `0x85EAC7BC081488AA77D1D82F9CB8E053DE1E4FA8` |
| 账户标签 | `igit-dev` |
| 仓库 | `demo-showcase` |
| SuiteDirectory（测试网） | `0xf8844F90887731FFd607E1f59e39a3918F6eAb35` |
| EVM 链 ID | `1439` |
| Web URL | `https://www.igit.xyz/inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase?suite=3` |

## v3 有什么不同

**1. ref 是 URL 列表，不是承诺。** 链上 ref 形态为：

```solidity
struct GitRef {
    string commitSha;    // 40 或 64 位十六进制
    string[] packUris;   // 1..128 项，每项一个 ipfs://CID，最长 512 字节
    uint64 updatedAt;
    address updatedBy;
    bool exists;
}
```

链记录的是 pack *在哪里*（IPFS CID），而不是对其字节的密码学承诺。v3 的
pack **没有**链上 raw SHA-256 与大小：本地对下载重新计算哈希可以验证传输
完整性，却无法凭空造出缺失的链上承诺。旧读取端会明确声明这一验证边界。

**2. 推送需要本地 Kubo 守护进程；克隆不需要。** v3 推送经固定版本的本地
Kubo 固定（pin）pack（由 `igit setup push` 安装并校验和验证）。克隆、
fetch 与 pull 以普通 HTTPS 从只读网关读取 pack——无本地守护进程、无 IPFS
账户。

**3. 并发控制是 `expectedSha`，而 `force` 会跳过它。** 非强制的 `updateRef`
必须把已存储的 `commitSha` 作为 `expectedSha` 传入；不匹配即 revert
`ShaMismatch`。`force == true` 时跳过该比较。这是与 [Suite v4](manual-suite-v4.md)
的一个真实且有据可查的差异——v4 的 revision CAS 即使对强制推送也适用。
在 v3 上，非强制更新会**合并** pack URI（不存在则追加）；强制更新则替换
整个数组。

其余一切——仓库身份、协作者、所有权转移、守护人恢复、审核、赞助、分成、
用户名、徽章、发布校验和——都是同一个模块面，见
[第 07 章 · 链上合约与协议](manual-protocol-contracts.md)，由同一个
`SuiteDirectory` 分派。

## v3 特有的前置条件

| 项目 | 要求 |
|---|---|
| Kubo | **仅推送需要。** 由 `igit setup push` 自动安装（固定版本、SHA-256 校验）到 `~/.igit/deps` |
| 读网关 | 默认 `hk` / `us` 网关加公共 `ipfs.io` 回退；可配置 |
| 上传服务 | 受控的美国复制 endpoint；随网络 profile 自动配置 |
| `injectived` | **不需要** |
| WSL2 | **不需要** |

推送期间使用的 Kubo RPC API 仅限回环地址。克隆与 fetch 从不需要 Kubo：
helper 从已验证的 Suite 读取 ref，并经 HTTPS 网关下载 pack。

## 第 1 步 —— 确认你在 v3 套件上

```console
$ igit config set network injective-testnet
network = injective-testnet

$ igit config set evm_suite_directory_address 0xf8844F90887731FFd607E1f59e39a3918F6eAb35
evm_suite_directory_address = 0xf8844F90887731FFd607E1f59e39a3918F6eAb35

$ igit suite verify
suite verification passed

$ igit suite info --json
{
  "directory": "0xf8844f90887731ffd607e1f59e39a3918f6eab35",
  "version": 3,
  "chain_id": 1439,
  "state": 1,
  ...
}
```

你要的是 `"version": 3` 加 `"state": 1`。版本 4 则说明你配置的是后继
Directory。切换代际永远是这一个配置值——客户端随后依据链上
`suiteVersion()` 自动分派到 IPFS 路径或 BYOS 路径。

> CLI 一次只指向**一个** SuiteDirectory。Web 应用同时列出两个测试网地址并
> 用 `?suite=` 在其间选择；CLI 不是——改 `evm_suite_directory_address`。

## 第 2 步 —— 准备推送环境

```console
$ igit setup push
igit will install pinned push dependencies under ~/.igit/deps.
Existing working Kubo installations will be preserved; EVM suite setup does not install injectived.
Continue? [y/N] y
```

`igit setup push` 从 `cli/internal/bootstrap/deps.json` 中固定的镜像清单下载
固定的 Kubo 二进制与校验和；每个下载字节都必须匹配固定 SHA-256。非交互
运行用 `--yes`，重装用 `--force`。

然后运行诊断：

```console
$ igit doctor --push
igit doctor (push)
```

与 v4 不同，v3 上 Kubo 检查必须为 `OK`：

| 检查项 | 证明什么 |
|---|---|
| `Kubo CLI` | 固定的 Kubo 二进制可解析 |
| `local Kubo API` | `POST <ipfs_api>/api/v0/version` 在回环地址应答 |
| `upload authorization` | 存在显式令牌，或授权 endpoint 可签发 |
| `read gateway` | 至少一个已配置读网关应答 `/healthz` |

随时可检查网关健康与选择顺序：

```console
$ igit gateway status
hk       ok      https://igit-hk.haohanyh.ovh    213ms
us       ok      https://igit-us.haohanyh.ovh    402ms

$ igit gateway select
1  hk https://igit-hk.haohanyh.ovh
2  us https://igit-us.haohanyh.ovh
```

默认读路径是按延迟健康排序的项目 `hk` / `us` 网关，公共回退为
`https://ipfs.io`。helper 启动时还会（尽力而为）直连 HK swarm peer，使该
节点已持有的 pack 无需缓慢的 DHT 发现即可获取。以上行为都可通过
`~/.igit/config.json` 中的 `gateways`、`public_gateway_fallbacks` 与
`peers` 配置。

## 第 3 步 —— 创建仓库并推送

```console
$ igit init demo-showcase "Injective EVM demo repository for igit.xyz"
repository created on chain.

add it as a git remote:
  igit remote add inj igit://inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase
  igit push inj main

$ cd demo-showcase
$ igit init .
$ igit remote add inj igit://inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase
$ igit add .
$ igit commit -m "first commit on Suite v3"
$ igit push inj main -v
```

### 一次 v3 推送期间发生什么

1. **探测套件。** `git-remote-igit` 验证 Directory 并读取 `suiteVersion()`。
   它是 3，因此选择旧 IPFS 路径。
2. **经回环 Kubo API 构建临时本地 pack** 并计算其 CID。
3. **从已配置的授权 endpoint 获取绑定 CID 的上传授权。**
4. **向受控的美国复制服务请求持久复制**，该服务在美国全量 Kubo 节点上固定
   pack；pack 随后进入既有的归档管线（美国 pin、带 SHA-256 校验的 CAR
   归档、HK 热层同步）。
5. **提交 `updateRef`**，携带提交 SHA 与 pack URI。
6. **仅在链上回执成功之后**清理本地临时 pack。若交易结果不确定，CLI 报告
   交易哈希并保留可重试数据，而不是丢弃。

顺序与 v4 是同一条规则——数据先于 ref——只是通过持久复制而非经验证的桶
上传来实现。

## 第 4 步 —— 经网关克隆与 fetch

```console
$ igit clone inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase
$ cd demo-showcase
$ igit pull
```

克隆与 fetch 不需要 Kubo 也不需要凭据。helper 验证 Suite、列出 ref，并从
最快的健康网关下载每个 pack。与链上交叉核对：

```console
$ igit refs inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5 demo-showcase
<commit-sha>  refs/heads/main    packfiles:1
```

`packfiles:` 计数是该 ref 背后的 `ipfs://` pack URI 数量。你也可以直接抓取
pack 检查数据面：

```console
$ curl -fsSL https://igit-hk.haohanyh.ovh/healthz
$ curl -fsSL "https://igit-hk.haohanyh.ovh/ipfs/<cid>" -o pack.tmp
```

## 第 5 步 —— 运维

整个模块面在 v3 上的工作方式完全一致。日常命令：

```console
# 协作者（仅所有者）
igit collab add demo-showcase inj1<address> maintainer
igit collab list inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5 demo-showcase

# 带 7 天延迟的所有权转移
igit transfer demo-showcase inj1<new-owner>
igit transfer show inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5 demo-showcase
igit transfer accept inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5 demo-showcase

# 守护人恢复（至多 10 名守护人，阈值 + 7 天延迟）
igit guardians set demo-showcase 2 inj1<g1> inj1<g2>
igit guardians show inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5 demo-showcase

# 赞助与收益分成
igit sponsor inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5 demo-showcase 0.5 "nice work"
igit splits set demo-showcase inj1<addr>:5000
igit splits show inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5 demo-showcase

# 用户名、徽章、发布
igit username register <name>
igit badge award demo-showcase inj1<contributor> "core contributor"
igit release register v1.0.0 windows-amd64=<64-hex-sha256>
```

审核状态（`active` / `delisted` / `frozen`）在两个代际都在链上强制执行：
**frozen** 仓库拒绝 ref 写入与经济操作，而 **delisted** 仓库从列表隐藏但
仍可变更 ref。参见
[第 07 章 · 审核挂钩](manual-protocol-contracts.md#审核挂钩是强制性的)。

## 第 6 步 —— 在 Web 应用中浏览仓库

打开实操示例 URL：

```text
https://www.igit.xyz/inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase?suite=3
```

你应该看到的，以及它们的含义：

| 元素 | v3 上的预期 |
|---|---|
| 合约类型徽章 | **EVM V2 + V3** |
| 套件徽章 | "Suite v3 · IPFS" |
| 描述 | `Injective EVM demo repository for igit.xyz` |
| 统计行 | HEAD SHA、分支数、标签数、packfile 数（示例 ref 携带一个 IPFS pack） |
| 克隆框 | `igit clone igit://inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase` |
| 标签页 | Code、Commits、Refs、Sponsors |
| IPFS 浏览器 | 适用——`/ipfs` 页可检查该仓库背后的网关数据面 |

示例仓库自己的 `README.md` 复述了该代际的部署事实——Injective EVM 测试网
链 ID `1439`、SuiteDirectory `0xf8844F90887731FFd607E1f59e39a3918F6eAb35`，
源码验证与运行时绑定可在
[testnet Blockscout](https://testnet.blockscout.injective.network/) 查看。
其 `suite.json` 记录已部署的演示 Directory，其历史由普通 Git 提交在空的
合成套件快照上创建——是新的演示数据，与旧 CosmWasm 注册表无关。

`?suite=3` 参数选择的就是这个副本。用
[`?suite=4`](manual-suite-v4.md#第-6-步--在-web-应用中浏览仓库)对比同名仓库
的最新代际：该页显示 **EVM V4 / BYOS** 徽章，其 pack 位于用户自有桶而非
IPFS。

## 第 7 步 —— 明确你刚刚证明了什么

- [x] 所配置 Directory 报告 `suiteVersion() == 3` 且处于 active。
- [x] `igit doctor --push` 在 Kubo 检查**通过**的条件下通过。
- [x] 一次推送产生了持久、已复制的 IPFS pack，然后 ref 才移动。
- [x] `igit refs` 报告提交与 pack 数量。
- [x] 一次仅用网关的克隆在无本地 Kubo 的情况下成功。
- [x] Web 应用以 **EVM V2 + V3 / Suite v3 · IPFS** 徽章渲染 `?suite=3` 下
      的仓库。

## 迁移，各一段话

- **CosmWasm v1 → EVM（2026-08）** 是一次 *空状态全新套件切换*：部署了带
  空快照的新套件，没有导入任何仓库数据，V1 成为只读归档。见
  [第 06 章](manual-cosmwasm-v1-archive.md)。
- **Suite v3 → Suite v4（2026-10）** 沿用同一模式：部署全新的后继套件，
  新仓库生活其上，v3 仓库继续经 IPFS 路径可读。v3 历史迁入 v4 是单独的、
  有条件的任务（S07），必须显式获批；本章既不要求也不执行它。

## 状态边界

v3 背后的 IPFS 数据面——HK/US 网关、美国全量 Kubo pin 集、受控复制服务与
CAR 归档管线——已部署并验证（2026-08）。v3 合约路径按设计冻结，不再获得
新的存储特性。后继发布证据、安全审计与主网治理审批在全项目范围仍**未
完成**；参见 [project status](project-status.md)。不要把测试网 Directory
地址说成正式地址：已发布网络 profile 在获批切换证据存在之前保持
`SuiteDirectory` 为空。

## 下一步

- 最新代际 → [第 04 章 · Suite v4](manual-suite-v4.md)
- v4 存储 profile → [第 08 章 · BYOS 存储](manual-byos-storage.md)
- 两个代际背后的合约模型 → [第 07 章](manual-protocol-contracts.md)
- 归档代际 → [第 06 章 · CosmWasm v1](manual-cosmwasm-v1-archive.md)
- 某处失败 → [第 10 章 · 故障排查](manual-troubleshooting.md)
