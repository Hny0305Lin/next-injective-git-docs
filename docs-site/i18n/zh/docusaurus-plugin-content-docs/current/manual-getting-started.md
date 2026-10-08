# 01 · 快速开始

状态：手册章节。读者：用户。最后更新：2026-10-05。

本章带你从一台裸机走到一个已推送、已克隆、可浏览的仓库。内容覆盖安装、
配置、第一个链上仓库，以及证明你的环境正确的验证步骤。

本章适用于两个 EVM 代际（Suite v3 与 Suite v4）。归档代际有单独章节：
[第 06 章](manual-cosmwasm-v1-archive.md)。

## 你将要构建什么

```text
你的终端                           链                        你的存储
────────                           ──                        ────────
igit init demo-showcase  ───────► RepositoryCore.createRepository
igit push inj main       ───────► ref 更新（CAS）     ───────► S3 / R2 桶   （Suite v4）
                                                             或 IPFS pin     （Suite v3）
igit clone <owner>/<repo> ◄────── getRef + 已验证套件  ◄─── pack 下载
```

链上保存的是**控制平面**状态：仓库身份、元数据、ref、协作者、审核、经济
模块。你的桶（v4）或 IPFS（v3）保存**数据平面**：Git packfile。只有当字节
持久化之后 ref 才会更新，而读取端在把字节交给 Git 之前会先验证它们。

## 第 1 步 —— 检查工具链

先确认你现有的环境。不要跳过：缺失 helper 二进制是导致莫名其妙失败的最
常见原因。

```console
$ git --version
git version 2.43.0

$ go version
go version go1.22.5 windows/amd64

$ node -v
v24.11.1
```

要求：

| 工具 | 用途 | 最低版本 |
|---|---|---|
| Git | 一切 | 任意较新版本 |
| `igit` | 链上操作 | 与发布匹配 |
| `git-remote-igit` | clone/push/fetch | 与 `igit` 同一发布 |
| Go | 从源码构建 CLI | 1.22 |
| Node.js | 仅构建文档站 | 24 |

**不**需要 `injectived`。**不**需要 WSL2。

## 第 2 步 —— 安装 CLI

### 方式 A —— 发布二进制（推荐）

从项目发布资产中下载你平台对应的 `igit` 与 `git-remote-igit`，并把**两个**
都放到 `PATH`。二者必须来自同一发布：helper 与 CLI 之间使用带版本的协议。

```console
# Linux / macOS
$ install -m 0755 igit-linux-amd64                ~/.local/bin/igit
$ install -m 0755 git-remote-igit-linux-amd64     ~/.local/bin/git-remote-igit
$ export PATH="$HOME/.local/bin:$PATH"
```

```powershell
# Windows (PowerShell)
PS> New-Item -ItemType Directory -Force "$env:USERPROFILE\.igit\bin" | Out-Null
PS> Copy-Item igit-windows-amd64.exe            "$env:USERPROFILE\.igit\bin\igit.exe"
PS> Copy-Item git-remote-igit-windows-amd64.exe "$env:USERPROFILE\.igit\bin\git-remote-igit.exe"
PS> $env:PATH = "$env:USERPROFILE\.igit\bin;$env:PATH"
```

Git 通过 `git-remote-<scheme>` 命名约定发现 helper。如果它不在 `PATH` 上，
`igit clone` 会报一个关于未知 remote helper 的 Git 错误——见
[第 10 章](manual-troubleshooting.md)。

### 方式 B —— 从源码构建

```console
$ git clone https://github.com/Hny0305Lin/next-injective-git
$ cd next-injective-git/cli
$ go build -o igit             ./cmd/igit
$ go build -o git-remote-igit  ./cmd/git-remote-igit
```

把两个产物都放到 `PATH`。

### 确认安装

```console
$ igit version
igit v0.x.y
```

裸执行 `igit` 打印的是精简快速开始，而不是完整参考：

```console
$ igit
igit - Next Injective Git (Injective EVM + suite-dispatched storage)

Quick start:
  igit setup                          prepare the complete push environment
  igit key import <name>              import an encrypted signing key
  igit init <name>                    create an on-chain repository
  igit clone <owner>/<repo> [dir]     clone a repository
  igit push [remote] [refspec...]     push on-chain (-q quiet, -v every step)
  igit pull [remote] [refspec...]     pull from chain

Explore:
  igit repos [owner]                  list on-chain repositories
  igit refs <owner> <repo>            list refs of a repository
  igit suite verify                   verify the chain and suite binding
  igit doctor                         diagnose tools, config and services

Anything else (add, commit, status, log, ...) is forwarded to git.
Full command reference: igit help
```

`igit help` 打印完整命令参考——完整内容收录在
[第 02 章](manual-cli-reference.md)。

## 第 3 步 —— 把 CLI 指向一个网络

配置保存在单个 JSON 文件中，Windows 与 Linux 相同：

```text
~/.igit/config.json
```

可用 `IGIT_HOME` 环境变量覆盖其位置。

### 选择 profile

```console
$ igit config set network injective-testnet
network = injective-testnet
```

profile 提供链 ID、LCD 与 RPC endpoint、EVM RPC endpoint、区块浏览器，以及
SuiteDirectory 地址。

| Profile | Cosmos 链 | EVM 链 ID | EVM RPC |
|---|---|---|---|
| `injective-testnet` | `injective-888` | `1439` | `https://k8s.testnet.json-rpc.injective.network` |
| `injective-mainnet` | `injective-1` | `1776` | `https://sentry.evm-rpc.injective.network/` |

### 恰好选择一个 SuiteDirectory

这是唯一的信任根。普通客户端每个代际只指向一个地址，绝不混用后端。

**最新 EVM 代际（Suite v4）** 测试网：

```console
$ igit config set evm_suite_directory_address 0xf987396475d0a4c96b722e993a95d8720a6292ad
evm_suite_directory_address = 0xf987396475d0a4c96b722e993a95d8720a6292ad
```

**较早 EVM 代际（Suite v3）** 测试网：

```console
$ igit config set evm_suite_directory_address 0xf8844F90887731FFd607E1f59e39a3918F6eAb35
evm_suite_directory_address = 0xf8844F90887731FFd607E1f59e39a3918F6eAb35
```

Web 应用同时列出两个地址；CLI 只取一个。切换代际就是改这一个值——读取端
随后根据链上 `suiteVersion()` 自动选择。

> **已发布 profile 与空 Directory。** 随版本发布的网络 profile 在真实部署
> 与切换（cutover）证据获批之前刻意保持 `SuiteDirectory` 为空。设置地址是
> 你显式的本地选择。绝不把测试地址当作正式地址，也绝不把它提交进已发布
> profile。

### 验证绑定

绝不要跳过。这是成本最低的失败检查。

```console
$ igit suite verify
suite verification passed
```

机器可读输出：

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

`version: 4` 表示你在 BYOS 后继上。`version: 3` 表示冻结的 IPFS 路径。
其他任何值都会被拒绝——客户端只接受 3 和 4，否则 fail-closed。

## 第 4 步 —— 创建签名密钥

只读命令（`repos`、`refs`、`collab list`、`suite info`、`suite verify`、
`doctor`、`archive …`）从不需要密钥。任何写链操作都需要。

```console
$ igit key new dev
```

或无回显地导入既有私钥：

```console
$ igit key import dev
```

然后确认 CLI 将以哪个地址签名：

```console
$ igit key show
```

密钥以加密 keystore 形式保存在所配置的 keystore 目录中。给该地址充入少量
测试网 INJ——客户端强制 `160000000 wei` 的 gas 价格下限。

要与本手册通篇使用的账户一致：

| 字段 | 值 |
|---|---|
| Injective 地址 | `inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5` |
| EVM 地址 | `0x85EAC7BC081488AA77D1D82F9CB8E053DE1E4FA8` |

## 第 5 步 —— 准备推送环境

`igit setup` 准备推送所需的一切，然后以诊断报告证明它。

```console
$ igit setup
igit will install pinned push dependencies under ~/.igit/deps.
Existing working Kubo installations will be preserved; EVM suite setup does not install injectived.
Continue? [y/N] y
```

常用变体：

```console
$ igit setup push --yes                 # 非交互
$ igit setup push --no-kubo             # Suite v4：完全不需要 Kubo
$ igit setup push --create-key dev      # 同时创建签名密钥
$ igit setup push --force               # 重装固定依赖
$ igit setup status                     # 等价于 `igit doctor --push`
```

在 **Suite v4** 上用 `--no-kubo`。BYOS 对象存储路径不探测、也不需要 Kubo、
IPFS 网络或 iGit 网关服务。在 **Suite v3** 上推送必须使用 Kubo，因为 v3
的 pack 固定（pin）依赖它。

### 诊断报告

```console
$ igit doctor --push
igit doctor (push)
```

每项检查报告 `OK`、`WARN`、`FAIL` 或 `SKIP`，报告末尾对所有非 OK 项给出
`To fix:` 区块。检查项按序为：

| 检查项 | 证明什么 |
|---|---|
| `git` | Git 在 `PATH` 上 |
| `git-remote-igit` | remote helper 在 `PATH` 上 |
| `SuiteDirectory` | 已配置地址 |
| `chain backend` | 已选择 EVM v3/v4 不可变套件后端 |
| `LCD` | 恒为 `SKIP`——普通运行时只用 EVM |
| `read gateway` | 至少一个已配置读网关应答 `/healthz` |
| `key_name` | 已配置签名密钥名 |
| `signing key` | 加密 keystore 可解锁 |
| `key balance` | 签名地址持有 INJ（为零时警告） |
| `EVM RPC` | RPC 链 ID 与 profile 匹配 |
| `Kubo CLI` | 固定版 Kubo CLI 可解析 |
| `local Kubo API` | `POST <ipfs_api>/api/v0/version` 有应答 |
| `upload authorization` | 存在显式令牌，或授权 endpoint 可签发 |

如果报告以 `environment is incomplete (N failed checks)` 结束，CLI 以非零
退出。修复列出的项后重跑。

## 第 6 步 —— 你的第一个仓库

创建链上仓库：

```console
$ igit init demo-showcase "igit demo repository"
repository created on chain.

add it as a git remote:
  igit remote add inj igit://inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase
  igit push inj main
```

带普通名称的 `igit init` 在链上创建默认分支为 `main` 的仓库。带参数或
`.` 时则转交本地 `git init`：

```console
$ igit init -b main .        # 本地 git init，不产生链上交易
```

接着接线工作副本。`igit` 会把它不认识的子命令原样转发给 Git，因此整个
工作流可以留在一个工具里：

```console
$ mkdir demo-showcase && cd demo-showcase
$ igit init .                              # 本地 git init
$ igit remote add inj igit://inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase
$ igit add .
$ igit commit -m "first commit"
$ igit push inj main
```

进度控制：

```console
$ igit push inj main -q     # 静默 igit 进度行
$ igit push inj main -v     # 显示每一步
$ export IGIT_QUIET=1       # 环境变量等价形式
$ export IGIT_VERBOSE=1
```

`igit clone` 的 Git 参数必须放在仓库参数**之后**，因为第一个位置参数用于
选择仓库：

```console
$ igit clone inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase
$ igit clone inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase -q
```

## 第 7 步 —— 克隆回来并确认

```console
$ cd ..
$ igit clone inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase
$ cd demo-showcase
$ igit log --oneline -1
```

与链上交叉核对：

```console
$ igit repos inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5
demo-showcase                    default:main         igit demo repository

$ igit refs inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5 demo-showcase
<commit-sha>  refs/heads/main    packfiles:1
```

`packfiles:` 计数表示该 ref 指向多少个 pack 对象。Suite v3 上它们是
`ipfs://CID` URI；Suite v4 上 ref 携带的是 manifest 承诺，pack 位置由已
验证的 manifest 解析。

## 第 8 步 —— 用用户名缩短 URL

地址很长。注册一个用户名后，同一个仓库即可通过它访问：

```console
$ igit username register haohanyh
```

用户名注册会锁定押金。注册后 `igit clone <username>/<repo>` 经链上用户名
模块解析。

```console
$ igit username show haohanyh
$ igit username show inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5   # 反向查询
$ igit username release                                           # 释放
```

> 用户名**不是** SuiteDirectory。它改变的是你*命名*所有者的方式，不改变
> 你正在与哪个套件通信。

## 第 9 步 —— 在 Web 应用中打开

公共 Web 应用 <https://www.igit.xyz> 无需任何安装即可读取同一条链。

你的仓库，最新 EVM 代际（Suite v4）：

```text
https://www.igit.xyz/inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase?suite=4
```

同名仓库在较早 EVM 代际（Suite v3）：

```text
https://www.igit.xyz/inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase?suite=3
```

已归档的 CosmWasm v1 副本（只读）：

```text
https://www.igit.xyz/archive/cosmwasm-v1/inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase
```

[第 03 章](manual-web-guide.md)逐屏讲解。简言之：仓库页显示 HEAD、分支/
标签/packfile 计数、一个复制精确克隆命令的克隆框，以及 Code、Commits、
Refs、Sponsors 四个标签页。

## 第 10 步 —— 明确你刚刚证明了什么

完成本章后，你拥有了以下全部证据：

- [x] helper 二进制在 `PATH` 上，且 CLI 与 helper 版本一致。
- [x] 已选择网络 profile 并配置了一个 SuiteDirectory。
- [x] `igit suite verify` 通过：链 ID、`suiteVersion()`、active 状态、
      `configuredChainId`、模块地址与模块代码哈希全部一致。
- [x] 签名密钥存在、可解锁、且持有 gas。
- [x] 推送环境通过 `igit doctor --push`。
- [x] 仓库已在链上创建且写入了一个 ref。
- [x] 仓库克隆成功且 ref 计数一致。
- [x] 同一仓库在 Web 应用中正常渲染。

## 最小命令卡

放在手边；其余内容见
[第 02 章](manual-cli-reference.md)。

```console
# 检视
igit suite verify                          # 证明信任根
igit suite info --json                     # 机器可读绑定
igit doctor --push                         # 完整环境报告
igit repos [owner]                         # 列出仓库
igit refs <owner> <repo>                   # 列出 ref

# 准备
igit config set network injective-testnet
igit config set evm_suite_directory_address <0x…>
igit key new dev
igit setup push --no-kubo                  # Suite v4
igit setup push                            # Suite v3（需要 Kubo）

# 使用
igit init <name> "description"
igit remote add inj igit://<owner>/<name>
igit push inj main
igit clone <owner>/<name>
igit pull

# 管理
igit collab add <repo> <address> maintainer
igit fork <owner> <repo> [new-name]
igit transfer <repo> <new-owner>
igit mod <owner> <repo> <active|delisted|frozen> [reason-hash]
igit sponsor <owner> <repo> 0.5 "nice work"
```

## 下一步

- 完整命令面 → [第 02 章 · CLI 命令参考](manual-cli-reference.md)
- Web 应用 → [第 03 章 · Web 应用指南](manual-web-guide.md)
- 最新代际端到端 → [第 04 章 · Suite v4](manual-suite-v4.md)
- 较早代际端到端 → [第 05 章 · Suite v2 + v3](manual-suite-v2-v3.md)
- 出问题了 → [第 10 章 · 故障排查](manual-troubleshooting.md)
