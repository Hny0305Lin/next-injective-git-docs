# 10 · 故障排查与 FAQ

状态：手册章节。读者：用户与开发者。最后更新：2026-10-05。

下面每一条都按**症状 → 原因 → 修复**陈述。先跑两条诊断，大多数情况它们
自己就能解决：

```console
$ igit doctor            # 或：igit doctor --clone / --push / --json
$ igit suite verify      # 或：igit suite info --json
```

## 安装与 PATH

**`git clone igit://…` 报 "not a git command" / "unknown remote
helper"。**
`git-remote-igit` 不在 `PATH` 上。Git 按 `git-remote-<scheme>` 命名约定发现
remote helper。从同一发布安装两个二进制并重开 shell 使 `PATH` 生效。

**`igit` 能跑，但 push/clone 表现得像普通 Git。**
未知子命令按设计转发给 Git。确认子命令拼写无误（`clone`、`push`、
`pull`）；`igit help` 打印完整命令面。

**Windows 下 `~/.igit/` 报拒绝访问。**
keystore 与配置写在受保护 DACL 下（仅当前用户与 SYSTEM）。不要放宽权限；
以创建文件的同一用户运行，或用 `evm_keystore_dir` 迁移 keystore 并重新
加固。

## 套件验证

**`igit suite verify` 报链 ID 不匹配。**
所配置 RPC 属于与 `evm_chain_id` 不同的网络。原子地重置 profile——
`igit config set network injective-testnet`——而不是逐字段改；混合网络配置
正是 profile 选择要防止的。

**"SuiteDirectory has no code" / 版本早于首个 EVM 套件。**
所配置地址在该链上不是已部署的套件（网络错、拼写错或 v1 时代地址）。使用
文档记载的测试网地址——
`0xf987396475d0a4c96b722e993a95d8720a6292ad`（v4）或
`0xf8844F90887731FFd607E1f59e39a3918F6eAb35`（v3）——并记住 CLI 一次只
指向一个 Directory。

**对公共测试网 RPC 验证很慢。**
完整验证是一长串相互依赖的读取（对公共 RPC 约一分钟）。结果缓存 30 秒。
超时后第一次成功是正常的——先重试一次再深入排查。

**Web 显示 "EVM Suite is not configured" 或 "verification failed"。**
公共部署上的 Settings 表单按设计只读；内置 profile 提供地址。那里的验证
失败意味着所配置 Directory 不是该网络的有效活跃套件——（仅本地部署）在
Settings 里复查地址。

## 密钥与 gas

**"missing config: key_name"。**
先创建或导入密钥：`igit key new <name>` 或 `igit key import <name>`，或给
`igit setup push` 传 `--create-key <name>`。

**交易因余额不足 / gas 价过低被拒。**
给 `igit key show` 显示的签名地址充测试网 INJ
（[水龙头](https://testnet.faucet.injective.network/)）。所有写操作强制
最低 gas 价 `160000000 wei`；当 RPC 报价更低时客户端自动应用下限。

**一次写操作以 "receipt was not confirmed" 结束。**
交易已广播但回执未在约 2 分钟窗口内落地。CLI 保留交易哈希并丢弃缓存的
nonce。去 [testnet Blockscout](https://testnet.blockscout.injective.network/)
查该哈希；若已 revert 或未落地，直接重跑命令——不要手工折腾 nonce。

## Suite v3（IPFS）推送与读取

**`igit doctor --push` 报 `Kubo CLI` / `local Kubo API` 为 FAIL。**
v3 推送需要固定的本地 Kubo。重跑 `igit setup push`（或 `--force`）；API
必须仅回环（`http://127.0.0.1:5001`）。若你刻意在 Suite v4 上工作，运行
`igit setup push --no-kubo`，并预期这些检查为 SKIP。

**推送卡在请求上传授权或复制。**
v3 通道依赖已配置的上传服务 endpoint 与读/写网关。检查 `igit gateway
status`，并确认 `upload.endpoint` / `upload.authorization_endpoint` 出现在
`igit config list --internal` 中（默认值随网络 profile 提供）。

**克隆/fetch 某个 pack 时很慢或超时。**
helper 对 `hk`/`us` 网关做健康排序并回退 `ipfs.io`。用 `igit gateway
status` / `igit gateway select` 检查；只在公共回退上冷的 pack 可能需要等
热层取回后重试。

## Suite v4（BYOS）推送与读取

**"no storage profile bound to this repository
(chainId/directory/repoId); run igit storage add"。**
存储引用文件中没有该仓库的绑定。从
`RepositoryCore.resolveRepository(owner, name)` 读取仓库 `repoId`（例如
Blockscout 的 Read Contract 面板），加入一条 `repositories` 条目（`chainId`
用十进制**字符串**），并重跑 `igit storage add`。

**`igit storage doctor` 对你认为正确的文件报错。**
校验是刻意严格的：profiles 是**映射**（不是列表）、writer 与 reader 必须
是不同 profile、writer 需要 `credentialRef`、reader 需要 `credentialRef`
或 `publicReadBase`、reader 凭据不得复用 writer 的变量名、S3 需要商用区域
且不带 `accountId`、R2 需要 `region: "auto"` 与 32 位十六进制
`accountId`。对照[第 08 章](manual-byos-storage.md)中的 schema。

**推送报凭据解析错误。**
某个被命名的环境变量在**执行推送的 shell** 中未设置。在该 shell 中导出
`accessKeyEnv` 与 `secretKeyEnv`（以及声明了的 `sessionTokenEnv`）后重试。

**推送 revert `CommitmentMismatch`。**
在你读取与写入之间 ref 被他人移动。fetch、重新应用、再次推送。不要盲目
force——在 v4 上 force 绝不豁免 CAS。

**上传后回读摘要或大小不匹配。**
桶里存的对象不是上传的对象。检查桶生命周期规则、改写内容的代理或任何会
改写对象的中间层。客户端拒绝为无法验证的字节发布 ref。

**Web 能显示仓库但 v4 上文件/提交加载失败。**
manifest 或 pack 不能匿名访问，或 CORS 拦截了浏览器。确保 `publicReadBase`
（或桶公开读）应答普通 GET，且桶 CORS 允许应用源站。CLI reader 仍可通过
自己的 reader profile 工作。

**Web 报 "Invalid manifest JSON, schema, context, commitment or
limits"。**
浏览器 bundle 比 manifest schema 旧（schema 2 于 2026-10-05 落地）。强制
刷新以获取已部署前端；同一发布的 CLI 能读两种 schema。

## 克隆与 URL

**"invalid remote URL … expected igit://<owner>/<repo>"。**
owner 必须是 `inj1…` 地址或已注册用户名（3–32 字符、`[a-z0-9-]`、不以
`inj1` 开头）；Git 参数放在仓库参数**之后**（`igit clone owner/repo -q`），
因为第一个位置参数用于选择仓库。

**同一个 `<owner>/<repo>` 打开的仓库和预期不同。**
该名字存在于多个代际。Web 加 `?suite=4`（最新 EVM）或 `?suite=3`（较早
EVM），V1 用归档路径。CLI 把 `evm_suite_directory_address` 指向对应代际。

## Web 与钱包

**未检测到受支持的 EVM 钱包。**
安装受支持的 EVM 钱包之一（MetaMask、Rabby、OKX Wallet、Bitget、Trust、
Coinbase、Brave、Keplr 的 EVM provider、Compass）或使用 WalletConnect。
仅 Cosmos 的钱包无法签名 EVM 路径。

**连接成功但每个写操作都提示网络错误。**
会话必须在 Injective EVM 链 `1439` 上。应用会尝试自动切换或添加链；若
钱包拒绝（`4902` 路径失败），手工添加网络：RPC
`https://k8s.testnet.json-rpc.injective.network/`、链 ID `1439`、符号
`INJ`、浏览器 `https://testnet.blockscout.injective.network/`。

**WalletConnect 二维码无法完成 EVM 会话。**
配对钱包必须声明 `eip155:1439`。Keplr Mobile 目前不支持，因此该路径不将
其列为兼容。

**刚推送的仓库搜不到。**
浏览器从链事件与直接合约读取构建仓库索引；稍等或直接搜 `owner/name`。
合约读取永远是权威——索引只用于导航。

## CosmWasm v1 归档

**归档仓库显示 "Migration to EVM V2 or newer required"。**
符合预期。V1 归档只读；编辑与当前功能需要尚未实现的未来迁移。浏览它、把
历史克隆出来，然后在 EVM 代际上继续工作。

**归档页面间歇性加载失败。**
归档读取经 Cosmos LCD endpoint，带有限重试与社区回退；官方 sentry 会丢弃
一部分浏览器连接。重试，或用
`igit archive query --lcd … --contract inj1mg6x7ht3zyyszed9aq67q6kd0y5rtq7wf756jh
--height <N> '<query>'` 自行验证同一事实。

## FAQ

**igit 是 GitHub 的替代品吗？**
它是保留 Git 工作流的去中心化代码托管：通过 `igit://` remote helper 进行
普通的 `git push` / `git clone` / `git fetch`，外加链上的仓库功能（协作者、
转移、守护人、审核、赞助、分成、用户名、徽章、发布校验和）。它今天没有
issue/CI/PR 工作流。

**链上到底存什么？**
控制平面：仓库身份、元数据、ref（提交指针与存储承诺）、权限、审核、经济
模块。packfile **字节**在数据平面——IPFS（Suite v3）或你自有的 S3/R2 桶
（Suite v4）。

**该用哪个代际？**
Suite v4（[第 04 章](manual-suite-v4.md)）用于一切新工作——无 Kubo、无
IPFS 依赖、你自己的桶。Suite v3 用于维护既有 IPFS 仓库。V1 是只读历史。

**同名仓库可以存在于多个代际吗？**
可以——它们是 repoId 不同的不同仓库。这正是 Web 应用中 `?suite=` URL 参数
要消歧的东西。

**支持主网吗？**
尚未支持。代码里有主网 profile，但已发布 profile 在部署、迁移验证、安全
审计与切换证据获批之前保持 `SuiteDirectory` 为空。测试网是活跃环境。

**存储费用谁出？**
v4 上是你——桶是你的（存储、请求、流量与验证回读）。v3 上 pack 由项目的
IPFS 数据面承载。

**我的私有桶等于私有仓库吗？**
不。私有桶不能匿名读取，因此 Web 无法渲染；鉴权读取需要你自己的 CLI
reader profile。私有仓库与端到端加密是未来范围，不是当前功能。

**能用 AWS 或 Cloudflare R2 以外的 S3 兼容供应者吗？**
不能。生产仅支持 `aws-s3` 与 `cloudflare-r2`。路线图文档中的中国大陆厂商
是 roadmap 候选——未支持、未接入——不得出现在任何配置中。

**有 gas 赞助吗？**
没有。每笔写操作由其签名者支付（最低 gas 价 `160000000 wei`）。`sponsor`
命令是给维护者的仓库收益，不是交易费赞助。

**PASS / FAIL / BLOCKED / NOT PROVEN / HISTORICAL 是什么意思？**
项目受限的状态用语。`PASS`——有保留证据的验证通过。`FAIL`——尝试且失败。
`BLOCKED`——当前环境无法尝试。`NOT PROVEN`——尚未证明，无论看起来多有
把握。`HISTORICAL`——冻结的历史记录，不是当前验收。这些标签逐字使用、
绝不弱化；参见 [project status](project-status.md)。

## 下一步

- 完整命令面 → [第 02 章 · CLI 参考](manual-cli-reference.md)
- Web 界面 → [第 03 章 · Web 指南](manual-web-guide.md)
- 合约模型 → [第 07 章](manual-protocol-contracts.md)
- 手册主页 → [manual.md](manual.md)
