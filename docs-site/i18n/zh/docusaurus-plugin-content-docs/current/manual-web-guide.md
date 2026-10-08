# 03 · Web 应用指南

状态：手册章节。读者：用户。最后更新：2026-10-05。

位于 <https://www.igit.xyz> 的 igit Web 应用是一个**直连链的客户端**。它没有
自己的后端：直接从你的浏览器读取与 CLI 相同的 Injective EVM 合约和相同的
存储。由此有三件事值得在点击任何按钮之前先内化。

1. **你能看到的都能验证。** 钱包地址、ref、pack 摘要、交易哈希都可在链上
   检查。
2. **SuiteDirectory 是信任根。** 如果所配置的 Directory 验证不通过，应用会
   明说并拒绝展示仓库数据。它不回退。
3. **公开就是公开。** 仓库数据经匿名 HTTPS 提供。"Mine" 只过滤当前视图；
   它从不向其他任何人隐藏任何东西。

本章覆盖每个界面。按版本划分的实操见
[第 04 章（Suite v4）](manual-suite-v4.md) 与
[第 05 章（Suite v2 + v3）](manual-suite-v2-v3.md)。

## suite 查询参数

在讲界面之前，一段 URL 语法能解释你将看到的大多数现象。

同一个仓库名可以同时存在于多个代际。Web 应用按配置的 SuiteDirectory 列表
逐个解析名字，因此同一个 URL 确实可能指向两个不同的仓库。`?suite=` 参数
就是用来表达你要哪一个：

```text
https://www.igit.xyz/<owner>/<repo>?suite=4     # Suite v4（BYOS）副本
https://www.igit.xyz/<owner>/<repo>?suite=3     # Suite v3（IPFS）副本
https://www.igit.xyz/<owner>/<repo>             # 第一个配置的 SuiteDirectory
```

机制上，该参数成为解析器遍历配置目录时的版本偏好：它持续查找，直到某个
目录把*这个*名字解析为链上 `suite_version` 与请求匹配的仓库。页面随后的
每一次读和写都运行在该仓库自己的 `SuiteDirectory` 上，而不是碰巧排在前
面的那个。

接受的值是 `3` 与 `4`。其他值被忽略，页面回落到默认解析顺序。该参数由
所有者页的仓库链接自动生成，因此正常浏览时你几乎不需要手输。

具体到本手册的实操示例：

| 代际 | URL |
|---|---|
| Suite v4（最新 EVM，BYOS） | `https://www.igit.xyz/inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase?suite=4` |
| Suite v3（较早 EVM，IPFS） | `https://www.igit.xyz/inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase?suite=3` |
| CosmWasm v1（归档） | `https://www.igit.xyz/archive/cosmwasm-v1/inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase` |

注意归档**不是**一个 `?suite=` 值。它是独立的路由前缀，因为它是一个独立
的信任根——见[第 06 章](manual-cosmwasm-v1-archive.md)。

## 路由地图

| 路由 | 渲染内容 | 需要已验证的 Suite？ |
|---|---|---|
| `/` | 仪表盘 —— 你的仓库与近期合约活动 | 是 |
| `/search?q=…` | 跨仓库与所有者的搜索结果 | 是 |
| `/settings` | 网络 profile、SuiteDirectory、测试网钱包表 | 否 |
| `/monitor` | 公共监控 —— 网络脉搏、网关、V1 边界 | 否 |
| `/mapmonitor` | 地图监控 —— 可达基础设施的世界巡游 | 否 |
| `/explorer` | 区块浏览器 —— 链上活动与交易详情 | 是 |
| `/ipfs` | IPFS 浏览器 —— 检查 CID、审计仓库 packfile | 是 |
| `/archive/cosmwasm-v1` | CosmWasm v1 归档入口 —— 打开归档仓库 | 否 |
| `/archive/cosmwasm-v1/:owner` | 归档所有者的仓库列表 | 否 |
| `/archive/cosmwasm-v1/:owner/:repo/*` | 归档仓库查看器（只读） | 否 |
| `/:owner` | 所有者页 —— 仓库与徽章 | 是 |
| `/:owner/:repo/*` | 仓库页 —— 代码、提交、ref、赞助 | 是 |

**不**需要已验证 Suite 的路由——归档、监控与地图监控——刻意保持可用，
这样即使 Directory 配置有误，你也总能检视基础设施与历史。

在其他所有路由上，若 Suite 未通过验证，应用会显示横幅而不是仓库数据：

| 状态 | 标题 | 说明 |
|---|---|---|
| 检查中 | Verifying EVM Suite | "Checking the Directory, modules, bindings, and code hashes." |
| 未配置 | EVM Suite is not configured | "Wallet connection and INJ balance remain available, but repository data needs a verified SuiteDirectory." |
| 失败 | EVM Suite verification failed | "The saved Directory is not a valid active Suite for this network. Review the address in Settings." |

除检查中之外，横幅都带有指向 Settings 的 **Configure** 链接。Suite 验证
缓存 30 秒；一个小 toast 会先报告 "Refreshing cache"，再报告
"Cache updated"。

## 连接钱包

点击右上角 **Connect wallet**。模态框标题为 "Connect a wallet"，列出它
通过 EIP-6963 发现的全部 EVM 钱包，并为不自报的钱包保留旧式注入回退。

受支持的钱包包括 MetaMask、Rabby、OKX Wallet、Bitget Wallet、Trust
Wallet、Coinbase Wallet、Gate Wallet、Brave Wallet、Keplr（EVM）与
Compass（Leap EVM）。钱包存在时该行显示 **Connect**，不存在时显示
**Install**。

如果什么都没检测到：

> No supported EVM wallet was detected in this browser. Open iGit in Chrome or
> Brave where your wallet extension is installed and enabled.

### WalletConnect

**Scan with WalletConnect** 打开面向移动钱包的二维码面板。WalletConnect
固定使用 Injective EVM 测试网——链 `1439`——面板也如此说明：

> Use a WalletConnect wallet that supports Injective EVM testnet (chain 1439).

UI 中声明并值得复述的一个限制：Keplr Mobile 目前未在 EVM WalletConnect 中
列出链 1439，因此该二维码无法在 Keplr 配对。WalletConnect 还要求部署配置
了项目 ID；若没有，按钮会说明它不可用。

### “已连接”与“可写”是两回事

已连接的钱包并不自动可写。应用单独维护 **writable** 状态，只有当钱包的
活动链等于所配置的 EVM 链 ID 时才为真。

- 已连接但不可写：读取可用，所有写控件禁用，UI 解释原因——"Switch to
  Injective EVM testnet to write."
- 账户菜单在你的地址旁显示同样的提示。
- 在错误链上尝试写入会以 "Switch the wallet to Injective EVM testnet
  before writing." 失败。

这就是为什么仓库页能向你展示一切，而它的 Edit 与 Sponsor 控件却纹丝
不动。

## 仪表盘

`/` 是落地页。

- 未登录时，标题为 **Dashboard**，文案是 "Browse repositories, inspect
  on-chain activity, and resolve IPFS objects."。仓库面板邀请你
  "Connect your workspace" 或改为浏览公共活动。
- 登录后，标题变为 **Your repositories**，列出已连接地址拥有的仓库，并带
  客户端过滤（"Find a repository…"）。

一条概览栏总结工作区：**Repositories** 计数、**Network** 状态（配置了
Suite 时显示 "Injective"，否则显示 "Setup needed"），以及 **Objects**
栏——显示 "IPFS"，即旧 pack 通道，为与 v3 仓库保持连贯而展示。

右栏显示 **Recent activity**——最新确认的合约动作，滚动时懒加载。每行带
动作徽章、缩写的发送者与相对时间戳；revert 的交易带 `failed` 标记。Suite
验证通过之前，面板显示：

> Activity is unavailable until the EVM Suite passes verification.

空状态与活动面板都会继续链接到浏览器页。

### 你可能遇到的空状态

| 情形 | 页面文案 |
|---|---|
| 未连接钱包 | "Connect your workspace" —— "Connect a wallet to see your repositories, or inspect public activity on the chain." |
| 已连接钱包、无 Suite | "Repository data is not configured" —— "Connect remains available, but repository reads require a verified EVM Suite." |
| 已连接、Suite 已验证、无仓库 | "No repositories yet" —— "Create the first repository from your terminal."，附 `igit init my-repo "hello chain"` |

最后一个空状态是从浏览器到真实仓库最快的路径：复制命令、运行、刷新。

## 仓库页

`/:owner/:repo/*` 是你停留最久的页面。它在特定 ref 上渲染仓库，而 ref 是
URL 的一部分。

### 页头

- 所有者，链接到所有者页。较长的 `inj1…` 地址显示时缩写；完整地址始终
  可在所有者页查看。
- 加粗的仓库名。
- **合约类型徽章**。出现哪一个一眼即可看出代际：
  - **EVM V4** 带 **BYOS** 标记 —— packfile 经已验证 manifest 从 BYOS
    存储桶解析。
  - **EVM V2 + V3** —— Injective EVM V2/V3 套件合约。
  - **CosmWasm V1** —— 只读归档合约。
- **套件版本徽章** —— "Suite v3 · IPFS" 或 "Suite v4 · BYOS" —— 从
  `SuiteDirectory.suiteVersion()` 读取。悬停说明："SuiteDirectory
  protocol version: v4. Fully supported." 应用尚未学习的版本渲染为
  "Suite vN (untested)" 并带警告标题，因为它会经 best-effort 回退读取。
- 仓库不是 `active` 时的**审核徽章**（`delisted` 或 `frozen`）。活跃仓库
  不显示徽章。
- 描述（若已设置）。
- fork 谱系 "forked from owner/repo"，链接到来源。

对实操示例而言，Suite v4 URL 显示 **EVM V4 / BYOS** 徽章与
"Suite v4 · BYOS"；`?suite=3` URL 显示 **EVM V2 + V3** 与
"Suite v3 · IPFS"。

### 统计行

页头横贯四个数字：

| 数字 | 含义 |
|---|---|
| `<sha>` HEAD | ref 提交 SHA 的前 8 个字符；ref 无提交时为 `—` |
| `<n>` branches | `refs/heads/*` 条目数 |
| `<n>` tags | `refs/tags/*` 条目数 |
| `<n>` packfiles | 该 ref 指向的 pack 对象数 |

Suite v3 上 packfile 计数是链上 `packUris` 数组长度；Suite v4 上 ref 携带
manifest 承诺，pack 位置来自已验证的 manifest。

### 克隆框

协议选择器在两条精确字符串之间切换：

```text
igit://      igit clone igit://inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase
https://     https://www.igit.xyz/inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5/demo-showcase
```

`https://` 形式是用于分享与浏览的 Web URL；`igit://` 形式才是 Git remote。
复制按钮把所选命令放入剪贴板并以 toast 确认。

### 标签页

| 标签 | 路由后缀 | 展示 |
|---|---|---|
| **Code** | （基础） | 所选 ref 上的文件树，或文件的 blob 视图 |
| **Commits** | `/commits/<ref>` | 该 ref 的提交历史 |
| **Refs** | `/refs` | 分支与标签，及其提交、pack 计数与更新时间 |
| **Sponsors** | `/sponsors` | 累计赞助、收益分成、协作者、徽章 |

**Sponsors** 标签只出现在 EVM 仓库。归档的 CosmWasm v1 仓库在其位置
显示：

> Sponsorship is unavailable for archived CosmWasm V1 repositories.

#### Code

树视图列出文件与文件夹及其最后提交与更新时间，文件夹在前。`..` 行回到
上级目录。若目录含 `README.md`，会在列表下方内联渲染。顶部的分支/标签
选择器切换 ref；标签带 `⌂` 前缀标记。

Code 标签上的空仓库直白地说：

> empty repository — push something first.

打开文件进入 blob 视图。Markdown 渲染为格式化文档；其余按纯文本渲染。
二进制内容会被检测并报告而非打印："binary file (N bytes) — not
rendered"。

#### Commits

历史列表显示消息、作者与日期。作者列尽可能给出链上 ref 更新者。应用从
pack 数据重建历史时显示 "reconstructing history…"；空 ref 显示
"no commits yet."

点击提交打开提交视图：缩写对象 ID、作者、日期与父提交，随后是逐文件
diff。二进制或超大文件被标注而非 diff；空提交显示 "no changes (empty
commit)."。

#### Refs

两个区块 **Branches (n)** 与 **Tags (n)**，各含提交、pack 计数与更新时间
列。分支与标签名都链接到该 ref 的树。

#### Sponsors

该标签聚合仓库的经济面：

- **Lifetime sponsorship** —— 累计收到金额与赞助墙。尚无人赞助时给出
  精确命令：`igit sponsor <owner> <repo> 0.1`。
- **Revenue split** —— 当前分配，显式给出所有者剩余部分，并为所有者提供
  编辑器。每个接收者获得 0.01% 到 100% 之间的比例，至多 20 个接收者，
  总计不得超过 100%。
- **Collaborators** —— 链上记录的账户与角色。
- **Badges awarded** —— 仓库的奖杯墙；当前所有者还获得一个附理由的
  授予新徽章表单。

此标签上的写操作需要可写钱包，分成编辑器与徽章授予还需要仓库所有权。
赞助对任何在正确链上的钱包开放。

### 编辑仓库元数据

所有者在克隆框旁看到一个铅笔控件。它打开 **Repository settings** 对话框，
含两个字段：

- **Description** —— 自由文本，至多 1024 个字符。
- **Default branch** —— 至多 64 个字符。

保存会广播元数据更新并以 "Repository updated" 确认。编辑器可按 Escape
或点击背景关闭，但在保存进行中拒绝关闭。

### 所有权转移

所有者看到 **Ownership transfer** 面板。所有权绝不一步完成：

1. 当前所有者输入目标地址（`inj1…` 或 `0x…`）并点击 **Start transfer**。
2. 面板随后显示被提议的所有者与两个从链上读取的期限：何时可接受、何时
   过期。精确文案是 "Accept after <timestamp>; expires <timestamp>."
3. 依你的角色，面板提供 **Cancel**（当前所有者）、**Reject** 与
   **Accept**（被提议的新所有者），或 **Clear expired transfer**（期限
   过后）。

成熟与过期窗口是链上值。界面渲染读到的时间戳，不施加自己的规则。CLI
打印同样的数字——见
[第 02 章 · 所有权转移](manual-cli-reference.md#所有权转移--7-天规则)。

### 找不到仓库时

两种情形产生两种不同的消息。

- **该 Suite 上不存在此定位符。** 页面报告失败并提供一个发现链接：
  **Open this locator in the CosmWasm V1 Archive**。这是对“地址早于 EVM
  代际”这一常见情形的便利，且从不自动发生——由你选择是否跟随。
- **仓库已改名或转移。** 页面显示 "This repository has moved."，并链接到
  当前位置。

## 所有者页

`/:owner` 接受 `inj1…` 地址或已注册用户名。显示所有者的仓库与徽章。

- 仓库链接到 `/<owner>/<name>?suite=<version>`——正常浏览中的 `?suite=`
  参数正来源于此：v4 仓库链接到 `?suite=4`，v3 仓库链接到 `?suite=3`。
- 徽章列出每枚徽章的来源仓库、授予时间与记录的理由。
- 过滤器在客户端收窄仓库列表。

空状态："no repositories on chain."、"no matching repositories." 与
"no badges awarded yet."

## 搜索

两个入口：页头搜索框与 `/search?q=…` 路由。

- **键盘。** 在文本框之外任意位置按 `/` 聚焦搜索框。
- **即时结果。** 输入两个及以上字符即搜索本地构建的仓库索引，最多显示
  七条，排序为：精确匹配、前缀、子串、所有者地址匹配。Delisted 仓库被
  排除。索引仍在构建时，下拉显示 "Building repository index from
  chain…"。
- **最近查询。** 最近五次搜索保存在本地，显示在 "Recent" 下，并有
  **Clear** 控件。
- **完整结果。** 回车打开 `/search?q=…`，显示匹配的仓库并按所有者分组，
  每行标注其来自链事件还是所有者列举。

搜索索引是**导航辅助，不是事实源**：选择结果会在打开前从合约重新解析
该仓库。索引随你浏览所有者、连接钱包或公共浏览器源可达而增长。若无
结果：

> No repositories found for "<query>".
> The index grows as you browse owners, connect a wallet, or when the explorer
> source is reachable.

### 搜索中的归档结果

搜索归档的所有者或仓库时还会提供 **View other V1 Archive results**，它
直接查询 CosmWasm v1 合约并链入归档路由。若查询不能解析到归档所有者，
页面会明说而不是静默失败。

## 区块浏览器

`/explorer` 列出所配置 SuiteDirectory 的链上活动。页头准确说明正在观察
什么：

```text
Activity across SuiteDirectory 0x9873964750… · EVM chain 1439
```

一张配置卡报告平台费、套件版本、国库地址与管理员地址。查询字段接受交易
哈希并渲染完整交易：哈希、成功或 revert 码、区块高度、gas 消耗、签名
模式、公钥（若有）、解码后的消息，以及失败时的原始日志。

两个范围控制列表：

- **All** —— 窗口内观察到的全部合约交易。
- **Mine** —— 过滤为已连接地址。

隐私说明明确且值得全文引用：

> On-chain data is public. "Mine" only filters this view to your address; it
> does not hide anything from others.

空状态："no activity from your address yet." 与 "no contract
transactions found."。尚未索引的哈希报告 "tx not found (or not indexed
yet)."。

## 公共监控

`/monitor` 只读且无需钱包。它是协议的运维脉搏。

- **网络脉搏**，含实时连接指示与手动 **Refresh**。
- 每个面的**来源卡**：EVM V2/V3 套件（已验证 Directory 信任根、最新区块、
  Blockscout 链接）、**EVM V4**（后继套件、BYOS 存储桶——pack 存储标注为
  "S3 / Cloudflare R2"），以及作为独立历史只读面的 CosmWasm v1 归档。
- 香港与美国 IPFS 网关的**网关卡**。
- 旧副本与当前归档路径的**存储供应者卡**，并附诚实的免责声明：

  > Provider roles are inventory metadata, not live S3 health checks.
  > Provider badges describe the configured role; private capacity and
  > operational telemetry stay server-side.

- **三个标签视图。** *Activity* 显示活动脉搏、来源说明（"Counts are
  bounded observations, never all-time totals."）、近期动作，以及由三次
  浏览器直连检查取中位延迟得出的网关探测。*Storage* 显示各面的 pack 与
  仓库计数。*V1 boundary* 声明归档的状态与边界：

  > Legacy CosmWasm V1 is read-only.
  > The archive remains available at a session snapshot. Migration to EVM V2 is
  > required and is not available from this page.

  并附打开归档查看器与在浏览器查看合约的链接。

指标卡报告有界区块窗口内的近期活动、最新观察区块、观察窗口大小与最后
刷新时间。监控每 90 秒自动刷新。

若未配置 Suite，监控仍会加载并准确告诉你缺什么——"Add a verified EVM
V2/V3 SuiteDirectory in Settings" 或 "Add a verified EVM V4
SuiteDirectory in Settings"——而不是显示一排零。

## 地图监控

`/mapmonitor` 是客户端可达基础设施的可视化巡游：IPFS 网关、S3 存储
endpoint 与 BYOS 桶边缘，绘制在世界地图上，每 45 秒轮换焦点。

- 页头："Reachable infrastructure" —— "Storage buckets, IPFS nodes, and
  gateways the igit client can reach, on a rotating world tour."
- 悬停暂停轮换；点击停靠点将其固定。
- 深链 `?stop=<id>` 聚焦特定 endpoint。
- 存储面板列出每个 endpoint 及其观察到的 pack 与仓库计数，外加归档行，
  并标注新鲜度（"Live" 或 "Cached"）。
- 弹窗列出在某 endpoint 观察到的仓库，并继续链接到所有者页。

未配置地图 key 时回退到开发图源，并明说而不是渲染空白画布。

## IPFS 浏览器

`/ipfs` 是旧 IPFS 代际的数据面检查器。

- 它声明活动网关："Packfiles are stored on IPFS and referenced on-chain.
  Gateway: `<configured gateway>`"。
- **Inspect a CID** 接受 `ipfs://bafy…` 或裸 CID，报告可达性、大小、是否
  为 Git packfile、pack 版本与对象数，并附在网关打开的链接。
- **Audit a repo's packfiles** 接受 `owner/repo` 并检查仓库引用的每个
  CID，产出 pin 健康视图："N/M CIDs reachable via this gateway"，附逐 CID
  状态。

当某 CID 未被服务时，消息不会假装相反：

> no reachable node is serving this CID — it may need pinning.

你拥有的仓库显示在顶部作为快捷填充。

此界面仅属于 IPFS 代际。Suite v4 仓库把 pack 存在你自己的桶而非 IPFS，
因此其可用性是关于你桶的问题，而不是关于网关的问题。

## 设置

`/settings` 配置网络 profile 并记录本地测试账户。

### 网络 profile

- **Profile** —— 可选的网络 profile。endpoint、链 ID 与合约地址全部来自
  所选 profile。
- 所选 profile 的 **EVM chain** 与 **RPC** 会显示出来，便于你回读客户端
  将使用的确切值。

Injective 测试网的值为 EVM 链 `1439` 与 RPC
`https://k8s.testnet.json-rpc.injective.network/`。

### SuiteDirectory 地址

此字段持有唯一信任根，其行为取决于应用运行在哪里。

**在公共部署上**——任何非 localhost——该字段**只读**。它由发布 profile
钉死，页面解释：

> This public deployment pins the Directory from its released profile, so the
> address is copy-only here. Run igit-web locally to verify and save your own
> override.

**本地运行**时字段可编辑，接受一个或多个逗号分隔地址：

> Enter one or more comma-separated SuiteDirectory addresses. The first address
> is the primary read target; repos from all listed suites are merged in
> listings. A local override is saved only after every listed Suite verifies.

多地址语义很重要，在此明说：

- **第一个**地址是直接解析使用的主读取目标。
- 列表中**所有**套件的仓库在列表中**合并**显示。
- 因为同名仓库可存在于两个套件，列表把它们保留为不同条目——每个套件
  版本一条——这正是 `?suite=` 存在的原因。
- 覆盖只保存在你的浏览器中，且 **Verify and save** 拒绝持久化未通过验证
  的 Directory。

发布的测试网 profile 按以下顺序列出两个地址：

```text
0xf987396475d0a4c96b722e993a95d8720a6292ad   # Suite v4（BYOS 后继）
0xf8844F90887731FFd607E1f59e39a3918F6eAb35   # Suite v3（IPFS）
```

**Restore defaults** 重新应用发布 profile。

### 测试网钱包

页面还列出当前 profile 的已知开发账户。列出它们是为了让本手册中的示例
命令可复现：

| 名称 | Injective | EVM |
|---|---|---|
| MetaMask Wallet | `inj1w5v3vhwpk7v8csaqxv5pzzfzvgaqn8qfuh5p5d` | `0x7519165DC1B7987C43A03328110922623A099C09` |
| Test Wallet 2 | `inj1ylxm0a96uxsfk5j7xza7jyycs6zvz9k4r9vkuc` | `0x27CDB7F4BAE1A09B525E30BBE910988684C116D5` |
| igit-dev | `inj1sh4v00qgzjy25a73mqheew8q200punaglrzec5` | `0x85EAC7BC081488AA77D1D82F9CB8E053DE1E4FA8` |
| dev | `inj1p6dn32ss5cxnfgcw8n4mu08x9vc2tskhnj7y3j` | `0x0E9B38AA10A60D34A30E3CEBBE3CE62B30A5C2D7` |
| collab-bob | `inj1kwq44vsld7zk2l9d8vvgn7dkjh4jgvlffhqp3d` | `0xB3815AB21F6F85657CAD3B1889F9B695EB2433E9` |

Injective 列链接到各账户的所有者页。**Open Blockscout** 链接指向该
profile 的区块浏览器。

这些是**测试网开发账户**。列出是为可复现，不是推荐，也不是生产身份。

## 只读面与写面

Web 应用中的每次写操作都是由你的钱包签名的 EVM 交易。界面中没有其他
任何东西会改变状态。

| 动作 | 位置 | 谁可以做 | 需要可写钱包 |
|---|---|---|---|
| 授予贡献徽章 | Sponsors 标签 | 仓库所有者 | 是 |
| 更新收益分成 | Sponsors 标签 | 仓库所有者 | 是 |
| 赞助仓库 | Sponsors 标签 | 任何人 | 是 |
| 编辑描述 / 默认分支 | 仓库页头（铅笔） | 仓库所有者 | 是 |
| 发起 / 取消所有权转移 | 所有权转移面板 | 当前所有者 | 是 |
| 接受 / 拒绝所有权转移 | 所有权转移面板 | 被提议的新所有者 | 是 |
| 清理过期转移 | 所有权转移面板 | 任何人 | 是 |
| 其余一切 | 所有位置 | — | 否 —— 纯读取 |

不在此表内的一切——浏览代码、读取提交与 ref、搜索、监控、IPFS 浏览器、
归档、设置页——都是纯读取，完全无需钱包。

## 浏览器实际上在做什么

理解读取路径能解释大多数“意外”行为：

1. **验证 Suite。** 客户端检查链 ID、`suiteVersion()`、active 状态、
   `configuredChainId`、每个模块地址与每个模块代码哈希。结果缓存 30 秒。
2. **解析所有者。** `inj1…` 地址直接使用；其余经用户名模块解析。
3. **解析仓库。** 遍历所配置的目录，尊重 `?suite=` 偏好，并报告规范的
   所有者/名字——改名仓库正是由此产生 "This repository has moved."
   提示。
4. **读取 ref。** Suite v3 的 ref 携带 `commitSha` 与 `packUris`；Suite
   v4 携带 manifest 承诺。
5. **加载 pack。** v3 经 IPFS 网关下载 pack 对象。v4 下载 canonical JSON
   manifest 并验证，然后从记录的位置取每个 pack，并在把字节交给 Git
   对象读取器**之前**验证 raw SHA-256 与大小。
6. **解析 Git 对象。** 树、blob、提交与 diff 在浏览器中从已验证的 pack
   数据重建。

第 5 步值得记住：Suite v4 在信任字节之前先检查摘要，这正是自有桶可以
安全读取的原因。

## 下一步

- 最新 EVM 代际端到端 →
  [第 04 章 · Suite v4](manual-suite-v4.md)
- 较早 EVM 代际端到端 →
  [第 05 章 · Suite v2 + v3](manual-suite-v2-v3.md)
- 归档 →
  [第 06 章 · CosmWasm v1 归档](manual-cosmwasm-v1-archive.md)
- 某处看起来不对 →
  [第 10 章 · 故障排查](manual-troubleshooting.md)
