# 验收证据

范围说明（2026-10-05 更新）：下文描述的既有 schema/门禁面向**旧版 Suite v3
IPFS**，不是首个主网后继。[ADR 0004](adr/0004-mainnet-storage-neutral-successor-and-byos-scope.md)
确认首个主网范围是存储中立后继 + AWS S3 / R2 BYOS。Suite v4 现已实现、
部署并激活于 Injective 测试网，且真实 Cloudflare R2 端到端 Git 流程已通过
（见[交付记录](backlog.md)）；因此下方的后继证据扩展已部分满足。仍为
NOT PROVEN：真实 AWS S3 canary、剩余真实层残留项、扩展的 v4 感知发布门禁、
以及安全/审批门禁。本文档不升级门禁，也不授权任何部署或公开 profile 切换。

仓库测试只证明源码行为。它们不是部署、迁移、最终性、钱包或运维证据。

切换证据目录必须包含 `scripts/migration-cutover-readiness.sh` 要求的确切
文件，全部由 `cutover-evidence.sha256` 绑定。`cutover-approval.txt` 将一位
独立评审人绑定到确切的 40 位十六进制源提交与 UTC 评审时间。

`deployment.json` 必须由防覆盖（no-clobber）部署工具产出——或在实时广播
期间、或经其严格的只读历史恢复模式。历史恢复只有在全部 17 笔有序部署与
配置交易、精确输入字节、历史区块、回执、运行时模板与绑定都通过校验时才
被接受。单独的 `blockscout-verification.json` 证明全部九个已部署地址均经
验证。`suite-verification.json` 必须在激活后以固定区块读取产生。门禁检查
版本 3、激活状态、source/chain/snapshot、九个已部署合约的回执与代码哈希、
七个已终结的模块绑定，以及运行时哈希相等。`cutover-scope.json` 选择证据
分支。已接受的 `fresh-empty-suite` 分支要求零模块计数与零批次、匹配的空根、
激活日志、以及用户名托管非负债证据；不要求 V1 迁移工件。通用必备文件仍
覆盖 Solidity 测试、干净的 Linux/Windows Git E2E、Web 回执、安全评审与
最终性运行手册。

真实测试网部署、Blockscout、空状态激活与固定区块 Suite 证据现已存在于
本地证据目录。公开的 SuiteDirectory profile 在其余通用证据集评审通过之前
保持为空。与提交绑定的 P0 源码/CI 结果另行记录在
[P0 证据记录](p0-evidence.md)；它们不满足部署、钱包、最终性或切换验收。

当前证据 schema 仅覆盖 IPFS 承载的 v3 切换，不含 AWS S3 / R2 支持的证据。
保留该 schema 与历史证据；不得修改旧回执、ABI、套件版本或校验和来让它们
伪装成验证过后继。

## 必需的后继证据扩展（2026-10-05 部分交付）

已交付：冻结的 manifest schema 1 与 Go/TS 黄金向量；绑定到同一评审源集的
v4 合约/ABI/Go/Web 解码器；一个经绑定验证的已部署测试网后继；以及一个带
公开 GET/CORS 验证的真实 R2 端到端 Git 流程。后继发布前仍需：

- 冻结 manifest 编码/schema 与 Go/TypeScript 黄金向量；证明精确的
  manifest 摘要/大小、pack 原始 SHA-256/大小与上下文绑定。
- 将后继版本、合约源码/工件、ABI、Go/Web/索引器解码器、Directory/模块
  哈希与新证据 schema 绑定到一个提交。
- 将本地 mock/fixture 结果与真实 AWS、真实 R2 的回执和回读检查分开；展示
  条件式重复/冲突、限额、受支持的 multipart 行为、独立读者权限、公开 GET
  与 CORS。
- 在已部署后继上演示无 Kubo 的干净 Windows/Linux Git 工作流与公开 Web
  读取，包括新 ref、force、删除、fork/context、同提交 manifest 变更、CAS
  冲突与不确定回执/重组恢复。
- 记录 source→pack→manifest→交易→已验证读取的因果链，且不含任何凭据、
  签名 URL 或 token。包含 provider 费用/资源范围与 canary 及交易使用的显式
  授权。
- 全新的后继需要自己的 bootstrap/激活 scope。只有在单独选择导入时才需要
  既有 v3 导入回执；不推断 CosmWasm V1 迁移。
- 保留独立的安全、治理、最终性、审批与校验和门禁。当前 v3 门禁的 PASS
  不能批准后继发布。

各层退出条件详见 [S01–S07](backlog.md)、[BYOS 实施规格](storage-byos.md)
与[路线图](delivery-roadmap.md)。托管 broker、私有仓库、强制双副本与自动
清理不是首期证据要求。
