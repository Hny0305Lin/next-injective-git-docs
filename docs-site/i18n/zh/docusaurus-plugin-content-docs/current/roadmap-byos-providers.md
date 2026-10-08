# BYOS 厂商路线图 —— 中国大陆 S3 兼容端点

状态：**Roadmap（后续计划）。未实现。未验证。**
最近复核：2026-10-09（Asia/Shanghai）。

> [!IMPORTANT]
> 本页是 **Suite v4 BYOS 数据平面的后续计划（roadmap）**。当前已交付的
> Suite v4 生产配置**仅支持 Amazon S3 与 Cloudflare R2**
> （[ADR 0004](adr/mainnet-storage-neutral-successor-and-byos-scope.md)、
> [BYOS 实施规格](storage-byos.md)）。本页任何厂商都未在任何已发布的
> CLI/Web 构建中实现、接入或验证；在对应的实现与评审证据获批之前，
> 下述任何端点都不得出现在配置示例、CLI 参数或生产指引中。
>
> 这里的"S3 兼容"**专指 Suite v4 BYOS 数据平面**（对象存储 pack 传输），
> 与 Suite v3、IPFS/Kubo 或已冻结的旧 IPFS 路径无关。

## 厂商候选

下表为仓库所有者提供的候选厂商记录。**Provider ID 仅为建议值，实现以
代码为准**；本路线图落地时，实现可能采用不同的标识符。

| Provider ID（建议） | 厂商 | 产品页 |
|---|---|---|
| tencent-cos | 腾讯云 COS | https://cloud.tencent.com/product/cos |
| aliyun-oss | 阿里云 OSS | https://www.aliyun.com/product/oss |
| huawei-obs | 华为云 OBS | https://www.huaweicloud.com/product/obs.html |
| volcengine-tos | 火山引擎 TOS | https://www.volcengine.com/product/TOS |
| bitiful-s4 | 缤纷云 S4 | http://bitiful.com/s4 |
| ctyun-zos | 天翼云 ZOS | https://www.ctyun.cn/products/zos |

厂商名保留中文原文；产品页在新窗口打开。

## 本路线图的硬性规则

1. **不得声称支持。** 在实现落地并通过相关门禁（Go/TS 交叉向量、能力
   profile、按 [ADR 0002](adr/pluggable-pack-storage.md) 要求的干净环境
   Windows/Linux E2E）之前，对这些厂商的任何提及——无论中英——都必须保持
   roadmap 口径。页面不得出现 "supported / 已支持 / 已接入"。
2. **不得给出端点示例。** 文档、CLI 帮助与配置样例中不得出现这些厂商的
   endpoint 或桶 URL 示例。
3. **范围守卫。** 任何新增厂商都必须走与 S3/R2 相同的 BYOS 能力 profile
   评审（[BYOS 实施规格](storage-byos.md)）；除非另行决策，自建对象存储与
   任意 S3 兼容端点仍不属于 v4 生产配置范围。
4. **术语。** Suite v3 = IPFS/Kubo 旧路径；Suite v4 = BYOS 后继（生产仅
   Amazon S3 + Cloudflare R2）。撰写厂商相关内容前先查
   [术语表](glossary.md)。

## 未决问题（不具约束力）

- 各厂商的能力 profile（版本化、保留策略、CORS、回读行为）尚未起草；
  每家都需要单独测试的 profile。
- 中国大陆端点是否需要独立的默认公开读域名或镜像指引，尚未决定。
- 六家候选之间的优先级顺序尚未决定。
