# 术语表 / Glossary

Next Injective Git 文档的 EN↔ZH 术语对照。
**规则：翻译任何内容前必须先查本表；表里没有的术语，先补表、再使用表中
译法。** 中英文档不得发明新译法（另见 `docs/AGENTS.md`）。

**Rule: check this table before translating anything. If a term is missing
here, add it here first, then use the table's wording everywhere.**

## 核心术语

| 中文 | English | 备注 |
|---|---|---|
| 套件（Suite） | Suite | 不可升级的 Injective EVM 合约套件；代码标识符与地址中保留 "Suite"。 |
| Suite v3（v3 套件） | Suite v3 | 旧路径：IPFS/Kubo，按设计冻结。 |
| Suite v4（v4 套件） | Suite v4 | 存储中立后继（BYOS），suiteVersion 4。生产配置仅支持 Amazon S3 与 Cloudflare R2。 |
| BYOS（自带存储） | BYOS (bring-your-own-storage) | 用户自备并管理云存储桶。 |
| CAS（比较并交换） | CAS | 引用更新的并发守卫。 |
| manifest 模式（manifest schema） | manifest schema | 版本化的 canonical JSON pack 清单；schema 1 已冻结，schema 2 = 增量 pack（ADR 0005）。 |
| canonical JSON（规范化 JSON） | canonical JSON | 以 RFC 8785 JCS 为基线（ADR 0004）。 |
| 切换（cutover） | cutover | 以证据为门禁的激活/过渡。不得译作"上线"。 |
| canary（金丝雀验证） | canary | 小规模真实环境验证（如真实 AWS S3 canary）。 |
| ADR（架构决策记录） | ADR | 原件在 `docs/adr/`，是不可变证据。 |
| 控制平面 | control plane | 链上仓库状态。 |
| 数据平面 | data plane | pack 传输与存储。 |
| pack / packfile（包文件） | pack / packfile | Git pack 对象，不译。 |
| ref（引用） | ref | Git 引用。 |
| revision CAS | revision CAS | Suite v4 引用并发版本号，保留不译。 |
| 引导定位符（bootstrap locator） | bootstrap locator | 链上保存的稳定 manifest 定位信息。 |
| fresh-empty-suite（空状态全新套件） | fresh-empty-suite | 零状态激活范围。 |
| 归档预览（archive preview） | archive preview | 只读 CosmWasm V1 查看器。 |
| 验证回读（readback） | verification readback | 上传后的完整回读校验。 |
| NOT PROVEN（未证实） | NOT PROVEN | 无证据时的状态用语，翻译不得弱化。 |
| BLOCKED / PASS / FAIL / HISTORICAL | BLOCKED / PASS / FAIL / HISTORICAL | 状态用语保留英文。 |

## 厂商术语

Provider ID 为建议值，实现以代码为准。**六家均为 roadmap 候选——未实现、
未接入**（见 [roadmap-byos-providers](roadmap-byos-providers.md)）。

| Provider ID（建议） | 中文名 | English name | 产品页 |
|---|---|---|---|
| tencent-cos | 腾讯云 COS | Tencent Cloud COS | https://cloud.tencent.com/product/cos |
| aliyun-oss | 阿里云 OSS | Alibaba Cloud OSS | https://www.aliyun.com/product/oss |
| huawei-obs | 华为云 OBS | Huawei Cloud OBS | https://www.huaweicloud.com/product/obs.html |
| volcengine-tos | 火山引擎 TOS | Volcengine TOS | https://www.volcengine.com/product/TOS |
| bitiful-s4 | 缤纷云 S4 | Bitiful S4 | http://bitiful.com/s4 |
| ctyun-zos | 天翼云 ZOS | China Telecom ZOS | https://www.ctyun.cn/products/zos |

## 表述边界

| 必须这样写 | 不得这样写 |
|---|---|
| 六家中国大陆厂商只能写 "roadmap 候选" | 任何一家写 "supported / 已支持 / 已接入" |
| "生产配置仅 Amazon S3 与 Cloudflare R2" | 把其他厂商表述为可用 |
| "审批前 SuiteDirectory 保持为空" | 把测试地址当正式地址 |
