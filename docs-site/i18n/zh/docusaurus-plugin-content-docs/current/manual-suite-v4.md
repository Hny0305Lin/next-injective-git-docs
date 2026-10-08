# 04 · Suite v4 实操 —— 最新 EVM 代际（BYOS）

状态：手册章节。读者：用户与开发者。最后更新：2026-10-05。

Suite v4 是当前代际。它是**存储中立的后继**：链上保存对仓库 pack 数据的
承诺，而字节本身存放在**由你拥有并管理**的云存储桶中。

本章通篇使用的实操示例：

| 字段 | 值 |
|---|---|
| 所有者（Injective 地址） | `inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5` |
| 所有者（EVM 地址） | `0x85EAC7BC081488AA77D1D82F9CB8E053DE1E4FA8` |
| 账户标签 | `igit-dev` |
| 仓库 | `demo-showcase` |
| SuiteDirectory（测试网） | `0xf987396475d0a4c96b722e993a95d8720a6292ad` |
| EVM 链 ID | `1439` |
| Web URL | `https://www.igit.xyz/inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase?suite=4` |

> **供应者边界。** Suite v4 生产存储**仅支持 Amazon S3 与 Cloudflare R2**。
> MinIO、自建对象存储、通用 S3 兼容写入 endpoint 以及其他一切云都不在
> 范围内。[BYOS 厂商路线图](roadmap-byos-providers.md)中的中国大陆厂商
> **仅为 roadmap 候选**——未支持、未接入——其 endpoint 不得出现在任何
> 配置中。

## v4 有什么不同

三个属性把 Suite v4 与冻结的 v3 路径区分开。每一个都会改变你的操作方式。

**1. ref 是一个承诺，不是 URL 列表。** Suite v3 的 ref 存储 `commitSha` 加
一个 `ipfs://CID` 字符串数组。Suite v4 的 ref 存储四个字段：

```solidity
struct GitRef {
    bytes32 manifestDigest;    // canonical manifest 字节的 SHA-256
    uint96  manifestSize;      // manifest 字节长度，上限 65 536
    string  bootstrapLocator;  // manifest 的获取位置，最多 512 字符
    uint64  revision;          // 用于比较并交换（CAS）的单调计数器
    // 另有 updatedAt、updatedBy、exists
}
```

链因此知道你的数据*是什么*（一个摘要）以及*从哪里开始找*（一个引导定位
符）。它不知道也不关心背后有哪些桶。

**2. 每次 ref 写入都是比较并交换。** `updateRef` 携带期望的当前状态，不
匹配即 revert。并发由链强制执行，而不是靠礼貌：

| 操作 | 期望 revision | 期望摘要 |
|---|---|---|
| 创建 | `0` | `bytes32(0)` |
| 更新既有 | 当前 revision | 当前 `manifestDigest` |
| 删除后重建 | tombstone 的 revision | `bytes32(0)` |

不匹配以 `CommitmentMismatch` revert。**强制推送绝不会豁免此检查**——在
v4 上，`force` 改变的是你可以覆盖哪个 ref，绝不改变 CAS 是否被满足。这是
与 v3 最重要的行为差异。

**3. 每次读取先验证再信任。** 读取端获取 manifest，把摘要与大小与链上承诺
核对，然后获取每个 pack 并在把任何字节交给 Git 对象解析器之前检查其 raw
SHA-256 与字节长度。验证发生在 Git 被允许修复或摄取字节**之前**，因为
`git index-pack --fix-thin` 的结果不再保证与上传的 raw pack 相同。

实际后果：自有桶可以安全读取，因为桶可以对内容撒谎，却无法对哈希撒谎。

## v4 特有的前置条件

| 项目 | 要求 |
|---|---|
| 桶 | Amazon S3 或 Cloudflare R2，商用区域 |
| 公开读取 | 匿名 HTTPS GET 且启用 CORS，以便浏览器读取 pack |
| 凭据 | 以**命名的环境变量**提供，绝不作为文件值 |
| Kubo | **不需要。** 无本地守护进程、无 IPFS 网络、无网关 |
| `injectived` | **不需要** |
| WSL2 | **不需要** |

R2 免费额度足以完成本章实操。

## 第 1 步 —— 确认你在 v4 套件上

绝不臆测。从链上读取版本。

```console
$ igit config set network injective-testnet
network = injective-testnet

$ igit config set evm_suite_directory_address 0xf987396475d0a4c96b722e993a95d8720a6292ad
evm_suite_directory_address = 0xf987396475d0a4c96b722e993a95d8720a6292ad

$ igit suite verify
suite verification passed
```

再确认版本是 4：

```console
$ igit suite info --json
{
  "directory": "0xf987396475d0a4c96b722e993a95d8720a6292ad",
  "version": 4,
  "chain_id": 1439,
  "state": 1,
  "snapshot_root": "0x…",
  "bootstrap_coordinator": "0x…",
  "block_tag": "0x…",
  "modules": [ … ]
}
```

你需要的是 `"version": 4` 加 `"state": 1` 这一对。这里的版本 3 意味着你
配置的是旧 Directory；任何其他版本都会被直接拒绝，因为客户端只接受 3 和
4，否则 fail-closed。

在 Web 应用中，同一事实渲染为仓库页上的徽章：带 **BYOS** 标记的
**EVM V4**，套件徽章为 "Suite v4 · BYOS"。

## 第 2 步 —— 创建存储桶

### Cloudflare R2

创建一个桶，然后安排两件事：

1. **匿名读访问。** pack 与 manifest 以无凭据的普通 HTTPS GET 获取，因此
   桶（或 `packs/` 与 `manifests/` 前缀）必须公开可读。
2. **CORS。** Web 应用从浏览器读取 pack，因此桶必须应答来自应用源站的
   预检请求。仅 CLI 的工作流不需要 CORS，但 Web 读取端需要。

从 R2 控制台记下账户 ID。它是 32 个小写十六进制字符，profile 中必须提供。

### Amazon S3

在商用区域创建桶，并为 pack 与 manifest 前缀开启公开读。按 AWS 报告的
原文记下区域名。

> **区域与账户规则会被强制校验。** `aws-s3` profile 必须携带商用允许清单
> 中的区域且账户 ID 必须留空；`cloudflare-r2` profile 必须使用区域
> `auto` 且必须提供 32 位十六进制账户 ID。违反任一规则的 profile 在任何
> 网络调用之前即被拒绝。

## 第 3 步 —— 编写存储引用文件

凭据**绝不是这个文件里的值**。文件*命名*持有它们的环境变量。

```json
{
  "version": 1,
  "profiles": {
    "r2-demo-writer": {
      "provider": "cloudflare-r2",
      "bucket": "igit-demo-showcase",
      "region": "auto",
      "accountId": "0123456789abcdef0123456789abcdef",
      "prefix": "igit",
      "credentialRef": {
        "kind": "env",
        "accessKeyEnv": "IGIT_R2_WRITER_ACCESS_KEY_ID",
        "secretKeyEnv": "IGIT_R2_WRITER_SECRET_ACCESS_KEY"
      }
    },
    "r2-demo-reader": {
      "provider": "cloudflare-r2",
      "bucket": "igit-demo-showcase",
      "region": "auto",
      "accountId": "0123456789abcdef0123456789abcdef",
      "prefix": "igit",
      "publicReadBase": "https://packs.example.com"
    }
  },
  "repositories": [
    {
      "chainId": "1439",
      "suiteDirectory": "0xf987396475d0a4c96b722e993a95d8720a6292ad",
      "repoId": "0x…",
      "writer": "r2-demo-writer",
      "reader": "r2-demo-reader"
    }
  ]
}
```

逐字段说明：

| 字段 | 含义 |
|---|---|
| profile 映射键 | profile 标识；`[A-Za-z][A-Za-z0-9_-]{0,63}` |
| `provider` | `aws-s3` 或 `cloudflare-r2`——不接受其他值 |
| `bucket` | 桶名，`[a-z0-9][a-z0-9-]{1,61}[a-z0-9]` |
| `region` | S3 用商用区域；R2 用 `auto` |
| `accountId` | 32 个小写十六进制字符，仅 R2；S3 必须留空 |
| `prefix` | 可选的键前缀 |
| `publicReadBase` | 可选的匿名读取公开基址 URL |
| `credentialRef` | 环境变量的**名字**——不是值 |

环境变量名同样会被校验：`[A-Z][A-Z0-9_]{0,127}`。

### writer/reader 分离

每个仓库绑定都命名一个 **writer** profile 和一个 **reader** profile。二者
必须是**不同的** profile，且规则严格：

- **writer** 必须携带 `credentialRef`（它负责上传）。
- **reader** 必须携带它自己的 `credentialRef` 或一个 `publicReadBase`
  （它负责下载）。
- writer 与 reader 必须是不同 profile。
- writer 与 reader **不得**共用 `accessKeyEnv` 或 `secretKeyEnv`。

最后一条规则正是为了防止读取路径的沦陷演变成写入路径的沦陷。让两套凭据
真正分离。

### 登记与校验

```console
$ igit storage add ./storage-config.json
storage profile registered (path only; credentials are referenced, never stored)

$ igit storage doctor ./storage-config.json
PASS: local storage configuration (2 profiles, 1 repository bindings). Credentials not resolved; cloud access, CORS and Git integration tested separately.
```

两点值得明说：

- `storage add` 在你的配置中**只保存绝对路径**。它不复制、不缓存、不内嵌
  凭据。
- `storage doctor` **不做**任何云访问，也**不解析**任何凭据。它只校验本地
  文件的形状。可达性、CORS 与 Git 集成是独立的测试。

### 提供凭据

在将要执行推送的 shell 中设置被命名的环境变量：

```console
$ export IGIT_R2_WRITER_ACCESS_KEY_ID=…
$ export IGIT_R2_WRITER_SECRET_ACCESS_KEY=…
```

```powershell
PS> $env:IGIT_R2_WRITER_ACCESS_KEY_ID = "…"
PS> $env:IGIT_R2_WRITER_SECRET_ACCESS_KEY = "…"
```

> **绝不提交凭据。** 不要把它们放进存储引用文件、配置文件、脚本或仓库。
> 该文件之所以只引用环境变量，正是为了让它可以被分享与提交，而秘密不能。
> CLI 会扫描被推送 ref 中的凭据形状内容并警告，但该警告是安全网，不是
> 许可。

## 第 4 步 —— 无 Kubo 准备推送环境

这是 v4 比 v3 简单得多的地方。

```console
$ igit setup push --no-kubo
```

`--no-kubo` 跳过 Kubo 安装与确认提示。对每个 v4 工作流它都是正确选择：
BYOS 路径不探测 Kubo、不连接 IPFS 网络、也不使用网关。

然后验证：

```console
$ igit doctor --push
igit doctor (push)
```

Kubo 相关检查报告 `SKIP`。必须为 `OK` 的项：

- `git` 与 `git-remote-igit` 在 `PATH` 上
- `SuiteDirectory` 已配置
- `chain backend` —— EVM v3/v4 不可变套件
- `EVM RPC` —— 链 ID 与 profile 匹配
- `key_name` 与 `signing key`
- `upload.endpoint` 与 `upload.authorization`（用于旧复制通道；v4 BYOS
  推送写入你的桶）
- `read gateway` —— 在 v4 上无害，但必须可解析

如果报告以 `environment is incomplete (N failed checks)` 结束，CLI 以非零
退出。修复后重跑。

## 第 5 步 —— 把仓库放到链上

```console
$ igit init demo-showcase "igit demo repository — BYOS on Suite v4"
repository created on chain.

add it as a git remote:
  igit remote add inj igit://inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase
  igit push inj main
```

然后接线工作副本并完成第一次推送：

```console
$ mkdir demo-showcase && cd demo-showcase
$ igit init .
$ igit remote add inj igit://inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase
$ igit add .
$ igit commit -m "first commit on Suite v4"
$ igit push inj main -v
```

第一次 BYOS 推送值得用 `-v`。你会明确看到各个阶段。

### 一次 v4 推送期间发生什么

1. **探测套件。** `git-remote-igit` 验证 Directory 并读取 `suiteVersion()`。
   它是 4，因此选择 BYOS 路径。helper 还要求所有者是一个地址——用户名必须
   先解析——并且已登记存储 profile。
2. **构建 pack。** Git 产出 pack；helper 依据远端已有内容决定要发送什么。
3. **上传 pack。** 每个 pack 以摘要派生的键写入你的桶：
   ```text
   packs/sha256/<digest>.pack
   ```
4. **回读验证。** 读回已上传对象并检查其 raw SHA-256 与字节长度。不匹配
   即推送失败。元数据与 ETag 永远不能替代。
5. **构建并上传 manifest。** 一份 canonical JSON manifest（RFC 8785 JCS）
   记录每个 pack 及其位置：
   ```text
   manifests/sha256/<digest>.json
   ```
   manifest 摘要对 canonical 字节计算；manifest 不对自己做哈希。
   `manifestSize` 上限 65 536 字节。
6. **以 CAS 更新 ref。** 链上调用携带期望 revision 与期望摘要。不匹配即以
   `CommitmentMismatch` revert，推送失败——**即使带 `--force`**。

顺序是刻意且不可协商的：**数据先持久化，ref 才指向它**。ref 绝不会引用
尚未写入并验证过的字节。

### 读取一次推送失败

| 症状 | 含义 | 处理 |
|---|---|---|
| `CommitmentMismatch` revert | 在你读取与写入之间有他人更新了 ref | fetch、重新应用、再次推送。不要 force。 |
| 回读摘要或大小不匹配 | 桶中对象不是上传的对象 | 检查桶生命周期规则、内容变换或改写对象的中间层 |
| 缺少存储 profile | helper 需要该 `chainId:suiteDirectory:repoId` 的绑定 | 在引用文件中加入仓库绑定并重跑 `igit storage add` |
| 要求地址所有者 | 你向用户名推送而 helper 无法为其绑定存储 | 把用户名解析为地址并使用 `igit://<inj1…>/<repo>` |
| 凭据解析失败 | 该 shell 中某个被命名的环境变量未设置 | 在同一 shell 中导出后重试 |

## 第 6 步 —— 在 Web 应用中浏览仓库

打开实操示例 URL：

```text
https://www.igit.xyz/inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase?suite=4
```

你应该看到的，以及它们的含义：

| 元素 | v4 上的预期 |
|---|---|
| 合约类型徽章 | 带 **BYOS** 标记的 **EVM V4** |
| 套件徽章 | "Suite v4 · BYOS" |
| 统计行 | HEAD SHA、分支数、标签数、packfile 数 |
| 克隆框 | `igit clone igit://inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase` |
| Sponsors 标签 | 存在（仅 EVM 仓库） |
| IPFS 浏览器 | 不适用——v4 的 pack 在你的桶中，不在 IPFS 上 |

`?suite=4` 参数选择的就是这个副本。去掉它，页面使用第一个配置的
SuiteDirectory；改成 `?suite=3`，你会得到同名仓库的 v3 副本（若存在）。
参见[第 03 章 · suite 查询参数](manual-web-guide.md#suite-查询参数)。

与较早代际对比：

```text
https://www.igit.xyz/inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase?suite=3
```

该页显示 **EVM V2 + V3** 与 "Suite v3 · IPFS"。同名、同所有者、不同代际
——这正是该参数存在的意义。

## 第 7 步 —— 克隆并验证

```console
$ igit clone inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase
```

克隆完全不需要凭据。它会：

1. 验证 Suite；
2. 解析所有者与仓库；
3. 读取 ref 并取得 manifest 承诺；
4. 按引导定位符获取 manifest 并与链上核对摘要与大小；
5. 从记录的位置获取每个 pack 并检查 raw SHA-256 与大小；
6. 把已验证字节交给 Git。

因为第 5 步先于 Git 摄取，损坏或被替换的对象在进入你的对象数据库之前
就会被拒绝。

与链上交叉核对：

```console
$ igit refs inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5 demo-showcase
<commit-sha>  refs/heads/main    packfiles:1
```

## 第 8 步 —— 增量 pack（manifest schema 2）

Schema 2 是 ADR 0005 交付的增量 pack 改进。值得理解，因为它解释了为什么
v4 推送通常很快。

- **Schema 1** 描述一个 ref 的完整 pack 集。
- **Schema 2** 允许 ref 由基线加增量满足，因此只增加少量提交的推送不会
  重新上传整个仓库。

三点须知：

1. **无合约变更、无版本变更。** 链不知道 `schemaVersion`；该字段位于
   manifest 中，完全由客户端解释。套件保持在 `suiteVersion == 4`。
2. **CAS 仍然适用。** 增量会改变 ref，而每次 ref 写入仍是对 revision 与
   摘要的比较并交换。
3. **回读验证仍按对象适用。** 增量不等于免检。

## 第 9 步 —— 运维

```console
# 读取当前状态
igit repos inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5
igit refs inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5 demo-showcase

# 直接读取链上承诺
# getRef(repoId, "refs/heads/main") 返回
#   (manifestDigest, manifestSize, bootstrapLocator, revision, updatedAt, updatedBy, exists)

# 不触碰云的诊断
igit storage doctor ./storage-config.json
igit storage show ./storage-config.json

# 完整写环境诊断
igit doctor --push
```

### 链证明了什么、不证明什么

这一区别对任何评估保障的人都重要。

链证明：

- 给定 revision 下承诺的是哪份 manifest；
- ref 在 CAS 下单调前进；
- 谁签名了更新。

链**不**证明：

- 桶仍然存在；
- 对象仍可公开读取；
- pack 仍可获取。

按设计，不存在 pack 可用性的链上证明，也没有受信任的存储回执签名者。
可用性在读取时通过获取并验证来建立，而不是通过信任声明。保持桶存活、
保持公开读开启、别让对象生命周期规则过期你的 pack。

## 第 10 步 —— 明确你刚刚证明了什么

- [x] 所配置 Directory 报告 `suiteVersion() == 4` 且处于 active。
- [x] 存储 profile 以一对不共享凭据的 writer/reader 通过本地校验。
- [x] 凭据从命名环境变量解析，且不出现在任何你会提交的文件中。
- [x] `igit doctor --push` 通过且 Kubo 检查为 SKIP。
- [x] pack 在 ref 移动之前完成上传、回读与摘要验证。
- [x] ref 在 revision CAS 下前进。
- [x] 全新克隆在 Git 摄取之前验证了 manifest 与每个 pack。
- [x] Web 应用以 **EVM V4 / BYOS** 徽章渲染 `?suite=4` 下的仓库。

## 运维清单

| 关注点 | 实践 |
|---|---|
| 凭据 | 只用环境变量。writer 密钥与 reader 密钥独立轮换。 |
| 桶生命周期 | 绝不让生命周期规则过期 `packs/` 或 `manifests/`。 |
| 公开读取 | 必须对浏览器与匿名克隆保持开启。 |
| CORS | 必须允许应用源站供 Web 读取端使用。 |
| 并发 | 竞争下预期出现 `CommitmentMismatch`。fetch 后重试；不要盲目 force。 |
| 成本 | 桶是你的——存储、流量与验证回读都由你承担。 |
| 备份 | 链保存承诺，不保存字节。给桶做备份。 |

## 状态边界

Suite v4 已**交付**：后继套件部署并激活于 Injective 测试网，CLI 与 Web 按
链上版本分派，真实 Cloudflare R2 端到端 Git 流程在无 Kubo、无 WSL2、无
`injectived` 的条件下通过。

以下各项仍**未完成**，不得表述为已完成：真实 AWS S3 canary（金丝雀验证）、
真实 force-push 与并发竞争、Blockscout 验证、Foundry 门禁（R04）、后继
发布证据、安全审计与主网治理审批。参见 [project status](project-status.md)。

## 下一步

- 较早 EVM 代际 → [第 05 章 · Suite v2 + v3](manual-suite-v2-v3.md)
- 存储 profile 深入 → [第 08 章 · BYOS 存储](manual-byos-storage.md)
- 合约模型 → [第 07 章 · 合约与协议](manual-protocol-contracts.md)
- 某处失败 → [第 10 章 · 故障排查](manual-troubleshooting.md)
