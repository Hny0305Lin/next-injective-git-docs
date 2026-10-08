# 02 · CLI 命令参考

状态：手册章节。读者：用户与运维。最后更新：2026-10-05。

本章是 `igit` 的完整命令面。语法引用自 CLI 自身的 usage 文本。若某命令
拥有短 usage 未列出的子命令，此处亦一并记录。

## 如何阅读本章

- **语法** 使用 `igit <字面量> [可选] <必选>...` 记法。
- **密钥** —— `—` 表示该命令只读、从不加载签名器。`key` 表示它会签名并
  广播交易。
- **权限** —— 链上授权的对象，与技术上*谁能够*广播无关。合约执行授权；
  CLI 只呈现最终的 revert。

两条约定贯穿全章：

1. **此处未列出的子命令一律转发给 Git。** `igit add`、`igit commit`、
   `igit status`、`igit log`、`igit branch`、`igit remote`……都运行真正的
   Git。此处列出的命令会遮蔽同名 Git 命令——Git 自己的 `config` 请用
   `git config`。
2. **只读命令仅做合约侧校验。** `igit repos`、`igit refs`、
   `igit collab list`、`igit suite info`、`igit suite verify`、
   `igit transfer show`、`igit guardians show`、`igit badge list`、
   `igit splits show`、`igit username show`、`igit release verify`、
   `igit doctor` 以及全部 `igit archive` 子命令都无需密钥。

## 仓库生命周期

| 命令 | 语法 | 密钥 | 权限 |
|---|---|---|---|
| 在链上创建 | `igit init <name> [description]` | key | 任何人（成为所有者） |
| 本地 git init | `igit init [-b <branch>] [.]` | — | 仅本地 |
| 镜像 GitHub 仓库 | `igit import <github-url> [name]` | key | 任何人 |
| 克隆 | `igit clone <owner>/<repo> [dir]` | — | 任何人 |
| 推送 | `igit push [remote] [refspec...]` | key | 所有者 / maintainer |
| 拉取 | `igit pull [remote] [refspec...]` | — | 任何人 |
| 打印克隆 URL | `igit clone-url <name>` | — | 任何人 |
| 列出仓库 | `igit repos [--all] [owner]` | — | 任何人 |
| 列出 ref | `igit refs <owner> <repo>` | — | 任何人 |
| 编辑元数据 | `igit repo edit <repo> description <text...>` | key | 所有者 |
| 编辑默认分支 | `igit repo edit <repo> branch <name>` | key | 所有者 |
| Fork | `igit fork <owner> <repo> [new-name]` | key | 任何人 |

### `igit init <name> [description]`

在链上创建默认分支为 `main` 的仓库，并打印 remote 配置：

```console
$ igit init demo-showcase "igit demo repository"
repository created on chain.

add it as a git remote:
  igit remote add inj igit://inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase
  igit push inj main
```

不带参数、以 `-` 开头或使用 `.` 时转交本地 Git：

```console
$ igit init -b main .        # 本地 git init
```

### `igit import <github-url> [name]`

裸克隆一个 GitHub 仓库，用源自带的默认分支在链上创建仓库，然后推送所有
分支与（尽力而为的）标签。

接受的来源写法：`github.com/user/repo`、`https://github.com/user/repo`、
`https://github.com/user/repo.git`、`git@github.com:user/repo`、`user/repo`。

```console
$ igit import github.com/Hny0305Lin/next-injective-git
cloning https://github.com/Hny0305Lin/next-injective-git.git ...
creating on-chain repo "next-injective-git" (default branch "dev") ...
pushing all branches to igit://inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/next-injective-git ...
pushing tags ...

imported! your mirror is live:
  igit clone igit://inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/next-injective-git
```

默认分支通过 `git symbolic-ref --short HEAD` 从来源读取，失败时回退到
`main`。

### `igit clone <owner>/<repo> [dir]`

封装 `git clone`。裸的 `owner/repo` 会被展开为 `igit://owner/repo`。

```console
$ igit clone inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase
$ igit clone igit://inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase
$ igit clone inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase demo-local
```

Git 参数必须放在仓库参数**之后**，因为第一个位置参数用于选择仓库：

```console
$ igit clone owner/repo -q          # 正确
$ igit clone -q owner/repo          # 报错，并提示原因
```

### `igit push` / `igit pull`

当前仓库内对 `git push` / `git pull` 的薄封装。

```console
$ igit push inj main
$ igit push inj --all
$ igit push inj --tags
$ igit push inj +main               # 强制
$ igit pull
```

静默或展开 igit 自身的进度行：

```console
$ igit push -q          # 或：export IGIT_QUIET=1
$ igit push -v          # 或：export IGIT_VERBOSE=1
```

### `igit repos [--all] [owner]`

列出活跃仓库。不带 owner 时使用你签名密钥的地址。`--all` 附带非活跃仓库
并标注。

```console
$ igit repos inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5
demo-showcase                    default:main         igit demo repository

$ igit repos --all inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5
demo-showcase                    default:main         igit demo repository
old-experiment                   default:main         retired  [delisted]
```

### `igit refs <owner> <repo>`

```console
$ igit refs inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5 demo-showcase
<commit-sha>  refs/heads/main    packfiles:1
```

空仓库打印 `no refs (empty repository)`。

### `igit repo edit`

```console
$ igit repo edit demo-showcase description "igit demo repository, second take"
repo demo-showcase updated

$ igit repo edit demo-showcase branch trunk
repo demo-showcase updated
```

字段为 `description`（拼接其余全部词）与 `branch`（恰好一个词）。仅所有者。

### `igit clone-url <name>`

```console
$ igit clone-url demo-showcase
igit://inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase
```

### `igit fork <owner> <repo> [new-name]`

```console
$ igit fork alice awesome-lib my-awesome-lib
forked alice/awesome-lib
clone your fork: git clone igit://inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/my-awesome-lib
```

fork 谱系记录在链上，并在仓库页渲染为 `forked from <owner>/<repo>`。

## 协作与所有权

| 命令 | 语法 | 密钥 | 权限 |
|---|---|---|---|
| 添加协作者 | `igit collab add <repo> <address> [maintainer\|reader]` | key | 所有者 |
| 移除协作者 | `igit collab remove <repo> <address>` | key | 所有者 |
| 列出协作者 | `igit collab list <owner> <repo>` | — | 任何人 |
| 发起转移 | `igit transfer <repo> <new-owner>` | key | 所有者 |
| 接受 | `igit transfer accept <owner> <repo>` | key | 被提议的新所有者 |
| 拒绝 | `igit transfer reject <owner> <repo>` | key | 被提议的新所有者 |
| 清理过期 | `igit transfer expire <owner> <repo>` | key | 任何人 |
| 取消 | `igit transfer cancel <repo>` | key | 当前所有者 |
| 查看待处理 | `igit transfer show <owner> <repo>` | — | 任何人 |

### 协作者角色

```console
$ igit collab add demo-showcase inj1kwq44vsld7zk2l9d8vvgn7dkjh4jgvlffhqp3d maintainer
collaborator inj1kwq44vsld7zk2l9d8vvgn7dkjh4jgvlffhqp3d added to demo-showcase as maintainer

$ igit collab add demo-showcase inj1ylxm0a96uxsfk5j7xza7jyycs6zvz9k4r9vkuc reader

$ igit collab list inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5 demo-showcase
maintainer   inj1kwq44vsld7zk2l9d8vvgn7dkjh4jgvlffhqp3d
reader       inj1ylxm0a96uxsfk5j7xza7jyycs6zvz9k4r9vkuc

$ igit collab remove demo-showcase inj1ylxm0a96uxsfk5j7xza7jyycs6zvz9k4r9vkuc
collaborator inj1ylxm0a96uxsfk5j7xza7jyycs6zvz9k4r9vkuc removed from demo-showcase
```

省略时角色默认为 `maintainer`。只接受 `maintainer` 与 `reader`；其他值在
构建交易前即被拒绝。

### 所有权转移 — 7 天规则

所有权绝不一步完成。所有者发起，**新所有者**须在成熟窗口之后接受。

```console
$ igit transfer demo-showcase inj1p6dn32ss5cxnfgcw8n4mu08x9vc2tskhnj7y3j
ownership transfer for demo-showcase started; inj1p6dn32ss5cxnfgcw8n4mu08x9vc2tskhnj7y3j must accept after 7 days

$ igit transfer show inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5 demo-showcase
pending ownership transfer for inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase: inj1p6dn32ss5cxnfgcw8n4mu08x9vc2tskhnj7y3j (proposed at 1770000000, execute after 1770604800, expires at 1771209600)
```

新所有者地址必须是合法的 `inj1…` bech32 地址；其他写法会被 CLI 以
`new owner %q must be an inj1... bech32 address` 拒绝。

```console
$ igit transfer accept inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5 demo-showcase   # 以新所有者身份
$ igit transfer reject inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5 demo-showcase   # 以新所有者身份
$ igit transfer cancel demo-showcase                                             # 以当前所有者身份
$ igit transfer expire inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5 demo-showcase   # 过期之后
```

`igit transfer pending` 是 `igit transfer show` 的可用别名。

## 守护人恢复

恢复是 Core 合约接受的**唯一**所有权恢复能力。它是独立的、由守护人把关
的路径——不是管理员覆盖。

| 命令 | 语法 | 密钥 | 权限 |
|---|---|---|---|
| 配置 | `igit guardians set <repo> <threshold> <address>...` | key | 所有者 |
| 发起 | `igit guardians propose <owner> <repo> <new-owner>` | key | 守护人 |
| 审批 | `igit guardians approve <owner> <repo>` | key | 守护人 |
| 所有者否决 | `igit guardians cancel <repo>` | key | 所有者 |
| 接受 | `igit guardians accept <owner> <repo>` | key | 被提议的新所有者 |
| 查看 | `igit guardians show <owner> <repo>` | — | 任何人 |

```console
$ igit guardians set demo-showcase 2 inj1kwq44vsld7zk2l9d8vvgn7dkjh4jgvlffhqp3d inj1p6dn32ss5cxnfgcw8n4mu08x9vc2tskhnj7y3j
guardians configured for demo-showcase (threshold 2)

$ igit guardians propose inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5 demo-showcase inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5
guardian recovery proposed; wait 7 days and collect approvals
```

`show` 报告配置及进行中的操作：

```console
$ igit guardians show inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5 demo-showcase
threshold 2
guardians: inj1kwq44vsld7zk2l9d8vvgn7dkjh4jgvlffhqp3d, inj1p6dn32ss5cxnfgcw8n4mu08x9vc2tskhnj7y3j
recovery: inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5 (2/2 approvals; execute after 1770604800)
```

CLI 在广播前强制的约束：阈值须解析为非零 8 位整数，且每个守护人地址必须
以 `inj1` 开头。

## 审核

| 命令 | 语法 | 密钥 | 权限 |
|---|---|---|---|
| 设置状态 | `igit mod <owner> <repo> <active\|delisted\|frozen> [reason-hash]` | key | 委员会 / 管理员 |
| 提交报告 | `igit mod report <owner> <repo> <reason-hash>` | key | 任何人 |
| 查看报告 | `igit mod report-show <report-id>` | — | 任何人 |
| 申诉 | `igit mod appeal <report-id> <reason-hash>` | key | 仓库所有者 |
| 处理报告 | `igit mod resolve <report-id> <active\|delisted\|frozen> <reason-hash>` | key | 委员会 |
| 处理申诉 | `igit mod appeal-resolve <report-id> <active\|delisted\|frozen> <reason-hash>` | key | 委员会 |

```console
$ igit mod inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5 demo-showcase delisted 0xabc…
inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase moderation status set to delisted
```

理由以**哈希**而非自由文本传递，链上因此不保存文字。
`igit mod report-show` 打印完整记录：

```console
$ igit mod report-show 7
#7 inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase status=delisted reporter=inj1kwq…
reason=0xabc…
resolution=delisted
resolution-reason=0xdef…
created-at=1770000000 updated-at=1770003600
```

审核挂钩对 Core 的 ref 变更与 Economic 的赞助变更是强制性的。`frozen` 或
`delisted` 的仓库仍然可读——审核改变的是可见性与写入资格，不改变已发布
pack 字节的不可变性。

## 经济模块

| 命令 | 语法 | 密钥 | 权限 |
|---|---|---|---|
| 赞助 | `igit sponsor <owner> <repo> <inj-amount> [message...]` | key | 任何人 |
| 设置分成 | `igit splits set <repo> [addr:bps]...` | key | 所有者 |
| 查看分成 | `igit splits show <owner> <repo>` | — | 任何人 |

```console
$ igit sponsor inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5 demo-showcase 0.5 "great tooling"
sponsored inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase with 0.5 INJ — thank you!
```

金额为十进制 INJ，最多 18 位小数，且必须为正。CLI 在构建交易前把它换算为
基本单位（`inj`）。

收益分成使用基点（10000 bps = 100%）：

```console
$ igit splits set demo-showcase inj1kwq44vsld7zk2l9d8vvgn7dkjh4jgvlffhqp3d:2500 inj1p6dn32ss5cxnfgcw8n4mu08x9vc2tskhnj7y3j:1500
revenue splits of demo-showcase updated (2 recipients)

$ igit splits show inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5 demo-showcase
 25.0%  inj1kwq44vsld7zk2l9d8vvgn7dkjh4jgvlffhqp3d
 15.0%  inj1p6dn32ss5cxnfgcw8n4mu08x9vc2tskhnj7y3j
 60.0%  (owner remainder)
```

所有者获得扣除平台费后的剩余部分。新的赞助**只接受原生 INJ**；迁移来的
历史总额仍可查询。

## 用户名、徽章与发布

### 用户名

```console
$ igit username register haohanyh      # 注册，锁定押金
$ igit username claim haohanyh         # 重领迁移来的 V1 用户名
$ igit username release                # 释放
$ igit username show haohanyh          # 解析名字
$ igit username show inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5   # 反向查询
```

### 徽章

徽章是与仓库及接收者绑定的不可转让奖杯。

```console
$ igit badge award demo-showcase inj1kwq44vsld7zk2l9d8vvgn7dkjh4jgvlffhqp3d "first external pull request"
badge awarded to inj1kwq44vsld7zk2l9d8vvgn7dkjh4jgvlffhqp3d for "first external pull request"

$ igit badge list inj1kwq44vsld7zk2l9d8vvgn7dkjh4jgvlffhqp3d
#12   inj1sh4v00…/demo-showcase: "first external pull request"
```

`award` 需要已配置的 `key_name`；接收者可以写地址或用户名。

### 发布

发布校验和一经登记即不可变。

```console
$ igit release register v0.9.0 windows-amd64=<sha256> linux-amd64=<sha256>

$ igit release verify v0.9.0 windows-amd64 ./igit-windows-amd64.exe
```

登记要求每个摘要恰为 64 位十六进制字符，拒绝重复平台，并统一转小写。
验证是只读的，任何差异都会以
`checksum mismatch for <platform>: got <a>, want <b>` 失败。

## 套件检视

| 命令 | 语法 | 密钥 |
|---|---|---|
| 绑定 | `igit suite info [--json]` | — |
| 验证 | `igit suite verify [--json]` | — |

```console
$ igit suite verify
suite verification passed
```

两者都接受 `--json` 输出机器可读结果。该命令使用五分钟上下文，因为完整
验证是一串相互依赖的 RPC 调用。

`igit upgrade` 已随不可升级 EVM 套件**移除**。现在它会以稳定的错误码失败，
并提示改用 `igit suite verify`。按设计不存在升级路径：无代理、无 diamond、
无 `delegatecall`。

## 密钥

| 命令 | 语法 | 密钥 |
|---|---|---|
| 显示地址 | `igit key show` | — |
| 创建 | `igit key new <name>` | — |
| 导入 | `igit key import <name>` | — |

```console
$ igit key show
$ igit key new dev
$ igit key import dev        # 无终端回显
```

`key new` 与 `key import` 都会持久化所配置的 `key_name`。

## 网关

| 命令 | 语法 | 密钥 |
|---|---|---|
| 探测健康 | `igit gateway status` | — |
| 输出顺序 | `igit gateway select` | — |

```console
$ igit gateway status
hk       ok    https://igit-hk.haohanyh.ovh          42ms
us       ok    https://igit-us.haohanyh.ovh          180ms

$ igit gateway select
1  hk       https://igit-hk.haohanyh.ovh
2  us       https://igit-us.haohanyh.ovh
```

两者都使用 6 秒预算。网关以 `/healthz` 探测并按延迟排序。这些命令主要
服务于 **Suite v3 / IPFS** 读路径；Suite v4 的 BYOS 路径不使用网关。

## 存储（BYOS）

| 命令 | 语法 | 密钥 |
|---|---|---|
| 登记 | `igit storage add <file>` | — |
| 校验 | `igit storage doctor <file>` | — |
| 查看 | `igit storage show <file>` | — |

`storage` 在加载任何链或 IPFS 配置之前分派，因此即使其余配置不完整也能
工作。

```console
$ igit storage add ./storage-config.json
storage profile registered (path only; credentials are referenced, never stored)

$ igit storage doctor ./storage-config.json
PASS: local storage configuration (2 profiles, 1 repository bindings). Credentials not resolved; cloud access, CORS and Git integration tested separately.
```

两点值得明说：

- `storage add` 在配置中**只保存绝对路径**。它不复制、不缓存、不内嵌凭据。
- `storage doctor` **不**访问云。它只校验本地文件的形状。云可达性、CORS
  与 Git 集成是另外的测试。

凭据绝不是文件里的值。它们是被命名的环境变量，在使用时解析。完整的
profile 格式与凭据规则见[第 08 章](manual-byos-storage.md)。

## 诊断与初始化

| 命令 | 语法 | 密钥 |
|---|---|---|
| 诊断 | `igit doctor [--clone\|--push] [--json]` | — |
| 准备 | `igit setup [options]` | — |
| 准备（别名） | `igit setup push [options]` | — |
| 状态 | `igit setup status [--json]` | — |

不带参数的 `igit setup` 等价于 `igit setup push`。`igit setup status` 即
转发相同参数的 `igit doctor --push`。

### `igit setup push` 选项

```text
usage: igit setup push [--yes] [--no-kubo] [--force] [--create-key NAME] [--wsl DISTRO]
```

| 选项 | 效果 |
|---|---|
| `--yes`, `-y` | 跳过确认提示 |
| `--no-kubo` | 不安装 Kubo（Suite v4；同时跳过提示） |
| `--force` | 即使已存在也重装固定依赖 |
| `--create-key NAME` | 无密钥时创建签名密钥 |
| `--wsl DISTRO` | 仅 Windows：把 setup 转发进某个 WSL 发行版 |

按步骤，`igit setup push` 会：

1. 应用所选网络 profile。
2. 校验 EVM 部署 profile（缺失 SuiteDirectory 在此、任何安装之前失败）。
3. 与你确认——除非已给 `--yes` 或 `--no-kubo`。
4. 若传入 `--create-key` 且无密钥则创建签名密钥。
5. 在 `~/.igit/deps` 下安装固定依赖——除非 `--no-kubo`。既有的可用 Kubo
   安装会被保留。
6. 保存配置。
7. 运行推送模式诊断并打印报告。
8. 仅当必需检查通过才成功，然后打印下一步。

确认文本明确说明范围：

```text
igit will install pinned push dependencies under ~/.igit/deps.
Existing working Kubo installations will be preserved; EVM suite setup does not install injectived.
Continue? [y/N]
```

在 Windows 上配合 `--wsl DISTRO` 时，CLI 先在该发行版内寻找 `version`
输出完全匹配的 `igit`。若无匹配，则把发布的 Linux CLI 安装进发行版内的
`~/.local/bin`（校验 `checksums.txt`），并把该目录追加进 `~/.profile` 的
`PATH`。

## 配置

| 命令 | 语法 | 密钥 |
|---|---|---|
| 公开状态 | `igit config list` | — |
| 运维细节 | `igit config list --internal` | — |
| 设置 | `igit config set <key> <value>` | — |
| 清除 | `igit config unset <key>` | — |

```console
$ igit config list
{
  "network": "injective-testnet",
  "key_name": "dev",
  "local_ipfs": "configured",
  "upload_service": "configured"
}
```

公开视图刻意隐藏后端细节。`--internal` 打印配置文件路径与完整存储 JSON，
其中 `upload.authorization` 被脱敏：

```console
$ igit config list --internal
# /home/user/.igit/config.json
{
  "network": "injective-testnet",
  "evm_suite_directory_address": "0x…",
  "upload": { "authorization": "<redacted>", … },
  …
}
```

### 配置键

| 键 | 控制 |
|---|---|
| `network` | 选择 profile；原子地替换以下 profile 所属字段 |
| `evm_suite_directory_address` | **唯一信任根。** 一个 `0x` + 40 位十六进制地址 |
| `evm_rpc` | EVM JSON-RPC endpoint |
| `evm_chain_id` | 期望的 EVM 链 ID |
| `evm_explorer` | 区块浏览器基址 |
| `evm_keystore_dir` | 加密 keystore 位置 |
| `storage_config` | BYOS 存储引用文件路径（Suite v4） |
| `key_name` | 使用哪个加密密钥签名 |
| `ipfs_api` | 本地 Kubo API，默认 `http://127.0.0.1:5001`（Suite v3） |
| `ipfs_bin` | Kubo 二进制名或路径（Suite v3） |
| `ipfs_gateway` | 首选读网关 |
| `upload.endpoint` | 复制/上传服务 endpoint |
| `upload.authorization_endpoint` | 请求短期上传令牌的位置 |
| `upload.authorization` | 显式令牌（输出时脱敏） |
| `upload.us_peer` | 美国 Kubo swarm peer multiaddr |
| `upload.hk_peer` | 香港 Kubo swarm peer multiaddr |

`igit config unset <key>` 清除覆盖并回落到内置默认。

校验严格且尽早失败。缺失或格式错误的 SuiteDirectory 产生稳定的错误码，
而不是稍后一个费解的 RPC 失败：

```console
$ igit repos
igit: missing config: evm_suite_directory_address (run `igit config set evm_suite_directory_address 0x…`)
```

只读命令仅校验合约选择。写命令额外要求 `key_name`：

```console
igit: missing config: key_name (run `igit config set <key> <value>`)
```

## 归档（CosmWasm v1）

归档工具被刻意隔离：在配置加载**之前**分派、从不加载签名器、从不广播 V1
交易。

```text
igit archive query --lcd URL --contract inj1... --height N '<smart-query-json>'
igit archive inventory --tx-search FILE --block-evidence FILE --chain-id ID --contract inj1... --height N --output FILE
igit archive verify --snapshot FILE --inventory FILE --tx-search FILE --block-evidence FILE
```

```console
$ igit archive query --lcd https://testnet.sentry.lcd.injective.network \
    --contract inj1mg6x7ht3zyyszed9aq67q6kd0y5rtq7wf756jh --height 139852506 \
    '{"repo_info":{"owner":"inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5","repo":"demo-showcase"}}'
```

`inventory` 与 `verify` 写证据文件。证据从不被覆盖：对既有文件的第二次
运行以 `archive evidence <path> already exists and is never overwritten`
失败，文件以 `0600` 权限写入。

完整实操：[第 06 章](manual-cosmwasm-v1-archive.md)。

## 退出码、输出与语言

- 成功退出 `0`。
- 任何错误以 `igit: <message>` 打到 stderr 并退出 `1`。
- remote helper 以 `git-remote-igit: <message>` 打到 stderr 并退出 `1`。
- 必需检查失败时 `igit doctor` 以非零退出。

错误码是独立于消息文本的稳定标识，脚本可以匹配它们而不必解析文字。

### 语言

用户可见消息是双语的。CLI 只对 `zh-CN`、`zh-HK`、`zh-MO` 与 `zh-TW`
选择中文，取 `LC_ALL`、`LC_MESSAGES`、`LANG`、`LANGUAGE` 中第一个非空
值。裸 `zh` 与所有其他语言环境都渲染**英文**。Windows 上未设置语言环境
变量时，参考系统默认语言环境。

```console
$ LANG=zh_CN.UTF-8 igit repos
$ LANG=en_US.UTF-8 igit repos
```

进度输出独立控制：

| 变量 | 效果 |
|---|---|
| `IGIT_QUIET=1` | 静默 igit 进度行 |
| `IGIT_VERBOSE=1` | 打印每一步 |

接受 `1`、`true`、`yes`、`on`，不区分大小写。这些环境变量是*钉死*的：
随后的 Git `option verbosity` 无法覆盖它们，这正是 `-q`/`-v` 在脚本中
行为可预测的原因。

## 环境变量

| 变量 | 效果 |
|---|---|
| `IGIT_HOME` | 覆盖配置目录（默认 `~/.igit`） |
| `IGIT_QUIET` | 静默进度行 |
| `IGIT_VERBOSE` | 详细进度 |
| `IGIT_EVM_KEY_PASSWORD` | 以非交互方式提供 keystore 口令 |
| `LC_ALL`, `LC_MESSAGES`, `LANG`, `LANGUAGE` | 语言选择 |
| `GIT_DIR` | Git 目录，helper 遵守 |
| `IPFS_PATH` | Kubo 仓库位置（setup 与 v3 推送） |

不要在共享或有日志的环境里把 keystore 口令放进 `IGIT_EVM_KEY_PASSWORD`。
它为自动化而存在，不是为图方便。

## URL 形式

| 形式 | 含义 |
|---|---|
| `igit://<owner>/<repo>` | 规范 remote URL |
| `igit::<owner>/<repo>` | 接受的别名 |
| `<owner>/<repo>` | `igit clone` 接受；展开为 `igit://` |
| `igit://<owner>/<repo>.git` | 结尾 `.git` 会被剥离 |

`<owner>` 必须是 `inj1…` bech32 地址或已注册用户名（3–32 个字符，小写
字母、数字与连字符；不以连字符开头或结尾；绝不以 `inj1` 开头）。其他
写法都会失败：

```text
invalid remote URL "…" (expected igit://<owner>/<repo>)
invalid owner "…": expected an inj1... address or a registered username
```

## 从 CLI 看版本分派

你不需要选择存储路径。你所配置的版本替你选择。

```console
$ igit suite info --json | grep '"version"'
  "version": 4,
```

- `version: 4` → BYOS 路径。`igit push` 把 pack 上传到你的桶、执行验证
  回读、发布 canonical JSON manifest，然后以 revision CAS 更新 ref。无
  Kubo、无 IPFS 网络。
- `version: 3` → 冻结的 IPFS 路径。`igit push` 把 pack 上传到本地 Kubo、
  确认 pin、登记复制，然后以 `packUris` 更新 ref。必须有 Kubo。
- 其他版本 → 拒绝。客户端支持 3 和 4，否则 fail-closed。

同一条规则约束克隆：`git-remote-igit` 探测套件一次，然后把每个 `list`、
`fetch`、`push` 路由到对应实现。

## 下一步

- Web 应用 → [第 03 章](manual-web-guide.md)
- Suite v4 实操 → [第 04 章](manual-suite-v4.md)
- Suite v2 + v3 实操 → [第 05 章](manual-suite-v2-v3.md)
- 存储 profile → [第 08 章](manual-byos-storage.md)
