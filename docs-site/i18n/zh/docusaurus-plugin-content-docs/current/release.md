# 发布与切换

带标签的发布只发布 Linux、macOS、Windows 的 `igit` 与
`git-remote-igit`，外加 `checksums.txt`。不构建、不发布已归档的 V1 代码。

发布 workflow 要求：Go vet/测试、race 测试、Web API/类型/构建测试、固定
`solc 0.8.24` 编译、Foundry 套件测试、已校验 ABI 与工件一致性、不可变
profile 守卫、以及确定性资产校验和。公开 CLI/Web 的 profile 守卫有意要求
`SuiteDirectory` 保持为空，直到一次单独评审的切换同时更新两个 profile。

## 部署证据

`igit-deploy-suite` 只消费来自干净已评审提交的已检入工件。实时部署在广播
的同时写证据。已部署的套件可用只读历史恢复模式，该模式接受显式有序交易
日志，并独立重验全部九个创建输入、八个配置 calldata 载荷、发送者、nonce、
历史区块、回执、运行时/模板哈希、不可变值与固定区块 Directory 绑定。两种
模式都写入防覆盖（no-clobber）的 `deployment.json`。

部署成功与 Blockscout 验证是两回事。部署后 Directory 处于 `Bootstrapping`
状态；它不导入、不激活。测试网可临时为全部治理角色使用一把轮换的加密 EOA，
且必须记录 `production_ready: false`。生产需要独立的治理设计。

## 切换门禁

只对不可变的真实证据运行：

```sh
bash scripts/migration-cutover-readiness.sh EVIDENCE_DIR EXPECTED_COMMIT
```

必备证据始终包括：显式的 `cutover-scope.json`、部署与
`blockscout-verification.json`、Solidity 测试、`suite-verification.json`、
Linux/Windows Git E2E、MetaMask Web 回执、安全评审、最终性运行手册，以及
显式的提交绑定审批。`fresh-empty-suite` 范围额外要求零状态激活日志与用户名
托管非负债证明。单独获批的 `cosmwasm-v1-migration` 范围则要求管理员演练、
哈希绑定的迁移计划/calldata、签名日志、回执与固定区块导入状态。

门禁校验每个文件哈希并拒绝链接/路径逃逸。它还对 `deployment.json` 与
`suite-verification.json` 做语义校验：确切的源提交与编译器、九次成功部署、
运行时模板/代码哈希、套件版本 3、激活状态、七个已终结模块、匹配的
Directory 代码哈希、以及模块到 Directory 的绑定。全新套件模式还要求零
预期/导入计数与匹配的空滚动根。

fixture 输出与源码就绪永远不能证明一次部署。除非该门禁与人工哈希绑定审批
通过，默认 profile 不得改变。

## 存储范围

上述既有门禁只覆盖旧版 v3 IPFS 切换。它不声称支持 AWS S3 / Cloudflare R2，
也不得用作"首个主网仅 IPFS"的上线门禁。2026-09-13，用户确认首个主网目标
是存储中立后继 + 用户自有 AWS/R2 存储桶；见
[ADR 0004](adr/0004-mainnet-storage-neutral-successor-and-byos-scope.md)。

首期范围为公开仓库、canonical JSON manifest、用户独立配置的读者与用户自付
的云费用。不要求 MinIO 或其他自建/S3 兼容 provider、托管 broker、私有仓库
加密或强制双副本。AWS/R2 的 Git 操作必须脱离 Kubo 与 iGit IPFS 服务可用。

后继（Suite v4）发布仍为 **NOT PROVEN**。v4 合约、ABI/客户端、测试网部署
与真实 R2 端到端 Git 流程均已交付，但发布后继公开 profile 仍需：真实 AWS
S3 canary 与剩余真实层残留项、两家 provider 在发布提交上的真实完整性与
公开读验收、原生 Windows/Linux 无 Kubo Git E2E、最终性、独立安全评审，
以及带显式审批的扩展 v4 感知发布门禁。不得弱化 v3 检查或重写历史证据。
既有 v3 历史的导入取决于单独立项；全新后继不需要虚构的迁移回执或 V1 导入。
见[后继证据要求](acceptance-evidence.md)、[BYOS 实施规格](storage-byos.md)
与[路线图](delivery-roadmap.md)。本次文档更新不授予任何交易、云写入或公开
profile 切换授权。

## 资产

发布二进制注入版本号并由 `scripts/verify-release-assets.sh` 校验。校验和
清单必须按确定性顺序恰好包含十个受支持的 CLI/helper 二进制。

S01–S06 交付记录在 [backlog](backlog.md)（后继套件已部署于 Injective 测试
网；真实 R2 端到端 PASS）。它本身不改变 v3 门禁、公开 profile 或发布范围。
下一阶段发布门禁工作是 v4 感知的证据扩展加剩余真实层残留项（真实 AWS
canary、Blockscout 验证、发布审批）。
