# ADR 0004：主网存储中立后继与 AWS S3 / R2 BYOS

> 译文说明：本页是 [英文原件](/docs/adr/mainnet-storage-neutral-successor-and-byos-scope)
> 的信息性中文翻译；`docs/adr/` 中的英文原件是唯一事实源（不可变证据）。

- 产品决策由用户确认：2026-09-13（Asia/Shanghai）。
- 状态更新（2026-10-05）：**已作为 Suite v4（BYOS）交付**——后继套件已
  部署并激活于 Injective 测试网，CLI/Web 按链上版本分派，真实 Cloudflare
  R2 端到端 Git 流程与 Web 读取 PASS，且 BYOS 按决策仅限 AWS S3 /
  Cloudflare R2。仍为 NOT PROVEN：真实 AWS S3 canary、剩余真实层残留、
  后继发布门禁、安全评审与主网审批（[交付记录](../backlog.md)）。
- 扩展 [ADR 0002](0002-pluggable-pack-storage.md)；取代路线图中较早的
  "托管优先"与"有条件主网存储"提案。
- 不把 [ADR 0003](0003-fresh-evm-suite-and-v1-archive-preview.md) 变成
  强制 CosmWasm V1 迁移，也不授权任何部署。

## 背景

用户必须能使用自己的云存储桶、管理自己的数据，而不依赖 IPFS 网络或
iGit 运营的 IPFS 服务。当前不可变套件版本 3 只接受 `ipfs://` pack URI。
添加云凭据或更换网关无法给已部署的协议增加对象存储。实现基线仍是
[2026-09-13 审计](../reconciliation-baseline-2026-09-12.md)；本 ADR 记录
产品决策，不新增测试或部署证据。

## 已确认的首发范围

| 决策 | 要求的范围 | 明确不在本发布内 |
|---|---|---|
| 主网协议 | 直接以存储中立后继为目标；AWS S3 / R2 BYOS 是上线必要条件 | 先上线仅 IPFS 的 v3 主网再立即迁移 |
| Provider | Amazon S3 与 Cloudflare R2，各自独立能力 profile | MinIO、OSS、COS、其他云、任意 S3 兼容端点、自建对象存储服务 |
| 所有权 | 用户自备并管理 AWS/R2 存储桶（BYOS） | 以新的 iGit 托管桶或上传/GET broker 为前置 |
| 仓库可见性 | 公开仓库 | 私有仓库保证、端到端加密与密钥分发 |
| 费用 | 存储桶所有者自付存储、请求与带宽费用（含验证回读） | 免费存储或平台补贴复制的承诺 |
| 副本 | 首发一个已验证位置即可；模型可描述副本 | 强制 IPFS 副本、强制 AWS+R2 双写、强制双副本 |
| 认证读取 | 用户自有的独立读取者配置；不共享写入凭据 | 托管短时 GET broker 或私有 Web 凭据库 |
| Manifest 编码 | canonical JSON；以 RFC 8785 JCS 为实现基线 | 把 CBOR 或普通 JSON 序列化当作 canonical |

“用户自有 AWS/R2 存储桶”属于首期目标；“用户自建对象存储服务”不属于
首期目标。provider 限制针对存储服务/API，不是禁止用户为已接受的云桶配置
公开读域名。测试可以注入本地 HTTP fake；它不得在生产配置中启用自建
provider。

## 读取公开仓库

标准公开路径要求 manifest 与 pack 可稳定匿名 HTTPS 访问，包括浏览器
CORS。写权限保持私有。若桶要求认证读取，用户通过自己的安全凭据机制配置
独立的最小权限 CLI 读取身份。缺少读取配置必须产生可操作的访问错误，而
不是触发 iGit broker 或索要写入者机密。

私有桶不会让 Git 仓库变成私有：链上元数据是公开的，已有读者可能保留
副本，且首发没有加密/密钥分发协议。认证的仅 CLI 路径不得宣传为匿名公开
Web 验收。Web 不接收任何云机密，报告读取配置限制而不是绕过它。

## 完整性、可变性与权威

- 用户可以编辑 Git 工作区并发布新提交、选择桶策略、轮换凭据、管理云
  资源。
- 已发布对象使用由摘要派生的键。变更内容需要新的 pack 字节、新 manifest
  与一次授权的链上 ref 更新；客户端绝不在既有摘要键上覆写不同字节。
  重新打包或改变位置可以更换 manifest，同时保持提交不变。
- 带外覆写或删除对桶管理员是可能的。客户端检测篡改或缺失；哈希与链上
  ref 都不保证长期可用性或可恢复。
- 链上承诺 manifest；manifest 绑定精确的原始 pack SHA-256、大小、顺序/
  依赖与位置。位置或 S3 ETag 不是内容权威。发布 ref 前验证 pack 与
  manifest；下载字节在 Git 消费前验证。
- 合约无法抓取云/IPFS 字节。"数据先于 ref"是客户端发布策略，不是链上
  持久化证明。BYOS 不引入受信任的 iGit 存储回执签名者。
- 凭据、会话令牌与预签名 URL 绝不进入链上状态、manifest、Git remote、
  日志、浏览器存储或普通 iGit JSON 配置。本地的非机密凭据*引用*是允许
  的。

## 协议与兼容性边界

1. 保留显式旧版 v3 IPFS 行为；绝不把 HTTPS 伪装成 `ipfs://`，也绝不把
   后继载荷发给现有 Directory。
2. 保持不可变 Directory 信任根与既有模块职责，除非另行论证的设计改变
   它们。后继的版本、ABI、事件、Go/Web 解码器、索引器与证据门禁必须
   一起评审。本 ADR 不指定已部署版本。
3. 优先链上持有 manifest 摘要/大小加一个有边界的稳定引导定位符。冷启动
   客户端必须能从当前合约状态解析 manifest，不依赖事件索引器或循环的
   profile 查找。
4. 把有序 pack 集合与同一 pack 的备用位置分开。后继新写入从自包含、非
   thin 的 pack 开始；仅在显式且可独立获取的依赖闭包下再做优化。
5. 在 Go/TypeScript 交叉实现测试后冻结确切的 manifest schema、canonical
   字节、大小上限与 ABI。编码决策已定；线上细节不是重开 CBOR 选型的
   理由。
6. 建议为初始验证新建后继测试套件。导入既有 v3 测试网历史是独立的立项
   决策，不是开发适配器的前提。V1 仍是隔离的只读归档预览。

## 交付后果

从本地协议向量、经验证的 `packstore` 边界与 provider 合约测试开始。缺少
Forge、Kubo、云账号或交易授权不妨碍这些步骤；它确实限制对应的真实检查；
把它们报告为 BLOCKED 或 NOT PROVEN，而不是伪造证据。保留 R01–R08 基线
结论。

参见 [BYOS 实施规格](../storage-byos.md)、[架构](../architecture.md)、
[路线图](../delivery-roadmap.md)、[S01–S07 待办](../backlog.md) 与
[下一窗口实施任务书](../prompts/next-storage-implementation.md)。
本次文档更新不授权任何云创建/上传/删除、签名、交易、公开 profile 变更、
提交或推送。
