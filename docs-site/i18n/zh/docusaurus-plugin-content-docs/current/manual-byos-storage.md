# 08 · BYOS 存储与凭据

状态：手册章节。读者：开发者与运维。最后更新：2026-10-05。

Suite v4 把**控制平面**（仓库身份、ref、权限——在链上）与**数据平面**
（Git packfile——在**你自有**的桶中）分离。本章记录存储配置文件、把字节
绑定到链上的 manifest 协议、凭据规则，以及故障与恢复契约。规范依据：
[BYOS 实施规格](storage-byos.md)、[ADR 0004](adr/0004-mainnet-storage-neutral-successor-and-byos-scope.md)、
[ADR 0005](adr/0005-incremental-packs-via-manifest-schema-2.md)。

> **供应者边界。** 生产存储**仅支持 Amazon S3（`aws-s3`）与 Cloudflare R2
> （`cloudflare-r2`）**。MinIO、自建对象存储、通用 S3 兼容写入 endpoint
> 以及其他一切云都不在范围内。[BYOS 厂商路线图](roadmap-byos-providers.md)
> 中的六家中国大陆厂商**仅为 roadmap 候选**——未支持、未接入——其
> endpoint 不得出现在任何配置示例、CLI 参数或生产指引中。

## 一图看懂模型

```text
git push ──► pack 字节 ──► 你的桶（packs/sha256/<digest>.pack）
                 │
                 └─ 验证回读（SHA-256 + size）
                 ▼
            manifest（canonical JSON，RFC 8785 JCS）
                 │  ──► 你的桶（manifests/sha256/<digest>.json）
                 ▼
            链上 ref 承诺（digest、size、locator、revision）
```

数据在 ref 指向它之前先持久化并验证。合约无法获取云端字节："数据先于
ref"是客户端发布策略；可用性在读取时通过获取并验证来建立，而不是通过
信任声明。

## 存储引用文件

`igit storage add <file>` 登记一个 JSON 文件。该文件持有**对凭据的引用，
绝不是值**，并以严格 JSON 解析器解析（拒绝重复键、上限 64 KiB）：

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

### profile 字段

| 字段 | 规则 |
|---|---|
| profile 映射键 | `[A-Za-z][A-Za-z0-9_-]{0,63}`；每文件 1–32 个 profile |
| `provider` | `aws-s3` 或 `cloudflare-r2`——其他一律拒绝 |
| `bucket` | `[a-z0-9][a-z0-9-]{1,61}[a-z0-9]`，且不允许 S3 别名后缀 |
| `region` | `aws-s3`：接受的商用区域之一（如 `us-east-1`）；`cloudflare-r2`：必须为 `auto` |
| `accountId` | 仅 R2：32 个小写十六进制字符；S3 必须**留空** |
| `prefix` | 受限键前缀；拒绝路径穿越与非规范大小写 |
| `publicReadBase` | 可选的匿名读取稳定公开 HTTPS 基址；校验 URL |
| `credentialRef` | 环境变量的名字——绝不是值 |

写入 endpoint 是**派生**的、绝不需要手填：R2 解析为
`https://<accountId>.r2.cloudflarestorage.com`，S3 解析为
`https://s3.<region>.amazonaws.com`。任意 S3 兼容 base URL、`localhost`、
IP 字面量与未知供应者在任何网络调用之前即被拒绝，生产配置中也不存在
`allow-any-endpoint` 后门。

### 凭据引用

`credentialRef` 支持 `kind: "env"`，携带显式环境变量**名**：`accessKeyEnv`、
`secretKeyEnv` 与可选的 `sessionTokenEnv`。名字必须匹配
`[A-Z][A-Z0-9_]{0,127}` 且两两不同。不存在共享文件、IMDS、容器或实例
元数据凭据发现：若推送 shell 中某个被命名的变量未设置，解析会响亮地失败。

### 仓库绑定

每个绑定按**不可变上下文**——`chainId` + `suiteDirectory` + `repoId`——
选择 writer/reader 对，因此改名或所有权转移绝不会静默选错桶，存储选择也
绝不会改变网络 profile 或 Directory。

校验在本地、任何云访问之前强制执行：

- `version` 必须为 `1`；每文件至多 128 个绑定。
- writer 与 reader 必须是**不同的** profile。
- writer 必须携带 `credentialRef`。
- reader 必须携带 `credentialRef` **或** `publicReadBase`。
- 若 reader 携带 `credentialRef`，则不得与 writer 共用 `accessKeyEnv` 或
  `secretKeyEnv`。

**`repoId` 从哪里来？** 它是 `RepositoryCore.resolveRepository(owner, name)`
返回的链上仓库 id——可用任意 EVM 客户端读取（例如
[testnet Blockscout](https://testnet.blockscout.injective.network/) 中
RepositoryCore 地址的 *Read Contract* 面板）。若绑定缺失，v4 推送在上传
之前停止并提示：`no storage profile bound to this repository
(chainId/directory/repoId); run igit storage add`。

### 登记与校验

```console
$ igit storage add ./storage-config.json
storage profile registered (path only; credentials are referenced, never stored)

$ igit storage doctor ./storage-config.json
PASS: local storage configuration (2 profiles, 1 repository bindings). ...

$ igit storage show ./storage-config.json
```

`add` 只把文件绝对路径存入 `~/.igit/config.json`（`storage_config`）。
`doctor` 与 `show` 只读取显式文件——不解析凭据、不访问云、不改桶策略或
CORS。云可达性、CORS 与 Git 集成是刻意分离的独立测试。

## manifest 协议

### canonical JSON

manifest 字节是 **RFC 8785 JCS** canonical JSON：UTF-8 无 BOM、键按 JCS
排序、数组保持协议顺序；重复键 / 非法 Unicode / `NaN` / 尾随数据 / 未知
字段一律拒绝。可能超出 JavaScript 安全整数范围的值（`chainId`、字节
`size`）用十进制字符串；小计数器用有界整数。Go 默认序列化与手写的"排序
stringify"*不*自动等于 JCS——项目固定经审计的库，并在共享向量
（`protocol/packmanifest/vectors.json`，由真实实现生成）上做 Go 与
TypeScript 的逐字节交叉校验。

### Schema 1（已冻结）

```text
PackManifest {
  schema: "igit.pack-manifest", schemaVersion: 1,
  chainId, suiteDirectory, repoId, refName,
  commit: { algorithm: "sha1", oid },
  packs: [ PackEntry, … ]
}
PackEntry { sequence, sha256, size, format: "git-pack", packVersion: 2,
            thin: false, dependsOn: [], locations: [ PackLocation, … ] }
ManifestCommitment { sha256, size, bootstrapLocator }   // 位于被哈希 body 之外
```

所有字段必填。`manifestDigest = SHA256(UTF8(JCS(body)))`——摘要绝不哈希
自己，manifest 自己的键/URL 也留在 body 之外。对象键由摘要派生：

```text
<prefix>/packs/sha256/<64-lowercase-hex>.pack
<prefix>/manifests/sha256/<64-lowercase-hex>.json
```

`PackLocation` 为 `{provider, url, reader}`，三字段齐备且 `url` / `reader`
恰有一个非空：公开位置携带稳定 HTTPS URL（`provider` ∈ `aws-s3`、
`cloudflare-r2`、`ipfs`）；鉴权位置只携带本地 reader 标签（≤64 字符）。
manifest 不存私有桶名、不存任何秘密。IPFS CID 是寻址信息——绝不能替代
raw SHA-256。

### Schema 2 —— 增量 pack（ADR 0005）

fast-forward 推送只追加一个包含该 ref 自身链上缺失对象的 pack；每个条目
声明 `dependsOn`，只引用同一 manifest 中更早的条目，并被校验为仅向后、
无环、有界。绝不用 git thin pack，绝不在摘要验证之前 `--fix-thin`。空增量
复用既有 pack 集并绑定新提交、`revision + 1`。任何破坏链条的情况——非
fast-forward 更新、上一 manifest 缺失/损坏/验证失败、超出 16-pack 或总量
预算——回退为一份全新的自包含完整历史 pack。**强制推送绝不豁免 revision
CAS。** 链不知道 `schemaVersion`；schema 2 未改任何合约、未改任何
`suiteVersion`。

### 限额

| 限额 | 值 |
|---|---|
| manifest 字节 / JSON 深度 | 64 KiB / 16（链上 `MANIFEST_MAX_SIZE = 65_536` 与之对应） |
| 每 manifest pack 数 / 每 pack 位置数 | 16 / 4 |
| pack 字节 / manifest 声明总量 | 512 MiB / 2 GiB（Web schema-2 预算：每 pack 32 MiB、总量 256 MiB） |
| 单次 PUT | 两家供应者均 ≤ 16 MiB |
| multipart | 仅 AWS；8 MiB 分片，≤ 512 MiB。R2 超限对象在任何请求或源文件 IO 之前被拒绝——**无 multipart 回退** |
| 重试 | 每次单发 PUT/GET/UploadPart 至多 3 次，100/200ms 退避；取消立即停止 |

## 验证回读规则

首个发布的写入策略是无条件的：条件创建之后，对象被**完整读回（流式
GET）**并验证 raw SHA-256 与字节长度——pack 与 manifest 一视同仁，包括已
存在于目标键的对象。元数据 SHA-256 与 ETag 可辅助诊断，但绝不被当作证明；
HEAD 绝不替代 GET。验证发生在 Git 修复或摄取字节**之前**，公开路径还会
额外验证匿名读取。条件创建碰撞（412）只有在回读完全匹配时才作为幂等复用；
不匹配视为损坏，绝不覆盖。

## 公开读取与 CORS

- 标准公开路径是稳定 URL（`publicReadBase` 或桶的公开域名）上的**匿名
  HTTPS GET**——无 cookie、无授权头、无签名 query 参数。
- **Web 读取端从浏览器获取 pack**，因此桶必须应答来自应用源站的 CORS
  预检。仅 CLI 的工作流不需要 CORS；Web 读取端需要。`GET` 成功不代表
  CORS 成功——诊断会分开报告二者。
- `r2.dev` 域名是开发便利，不是生产 SLA；请使用配置好的公开域名。
- 若公开 URL 不能匿名访问，Web 会说明需要配置公开读取或独立 CLI reader
  ——绝不索要 writer secret；首个发布也不提供 Web 侧长期秘密、托管 GET
  代理或自动凭据分发。

## 凭据与权限规则

- 云写入凭据以**命名的环境变量**在推送 shell 中提供；绝不进入存储文件、
  `~/.igit/config.json`、链状态、manifest、Git remote、日志或浏览器存储。
- 维护者需要**两份独立授权**：链上 ref 权限，与指定桶/前缀上的云 PUT/GET。
  协作者只需要自己的 GET（及必要 HEAD）——绝不复用上传者的长期密钥。
- 默认授权不应包含 `DeleteObject`、桶策略变更或桶列举；multipart 权限单独
  授权。不要假设 R2 token 的作用域粒度等同于 AWS IAM 前缀限制——按供应者
  实际能力以桶/前缀隔离。
- writer 密钥与 reader 密钥独立轮换。CLI 会扫描被推送 ref 中的凭据形状
  内容并警告；把警告当安全网，不当许可。

## 故障与恢复契约

| 故障 | 必须行为 |
|---|---|
| 条件创建返回 412 | 回读该键；完全匹配 ⇒ 幂等复用；不匹配 ⇒ 冲突/损坏，绝不覆盖 |
| 409 / 429 / 5xx / 超时 | 有界退避与重试预算；AWS `CompleteMultipartUpload` 409 按官方语义重建会话，而非盲目重试 |
| 认证失败 / reader 未配置 | 给出可执行的配置提示；绝不降级为公开写入，绝不索要 writer secret |
| 错误摘要/大小、截断、尾随字节 | 拒绝该位置；尝试同 pack 的其他已声明位置；全部失败则不摄取、不移动 ref |
| pack 已上传、manifest 失败 | ref 不变；对象保留，下次尝试验证后复用 |
| 上传成功、ref CAS 冲突或 revert | 对象保留；重新读取 ref；重新打包/重发是显式选择——**不自动 force** |
| 已广播、回执未知或 reorg | 保留 tx hash/nonce/期望 ref；查询回执与规范链状态；绝不以新 nonce 重播；绝不标记成功或 GC |
| 云端对象被带外删除或覆盖 | 报告不可用/损坏；哈希无法复活缺失字节——这不会让链上已承诺的其他内容合法化 |
| ref 删除 / 强推 / 改名 / fork | 只改变获授权的链状态；绝不自动删除共享内容；每 ref 独立性是硬性门槛 |

## 运维清单

| 关注点 | 实践 |
|---|---|
| 桶生命周期 | 绝不让 `packs/` 或 `manifests/` 过期；没有自动清理器，也不允许启用任何清理器 |
| 公开读取 | 必须对浏览器与匿名克隆保持开启 |
| CORS | 必须允许应用源站 |
| 备份 | 链保存承诺，不保存字节——给桶做备份 |
| 成本 | 桶是你的：存储、请求、流量与验证回读都由你承担 |
| 篡改 | 带外覆盖可被检测（摘要不匹配）但协议无法阻止；桶管理纪律是运维责任 |

## 状态边界

已交付且 **PASS**：Injective 测试网上的后继套件、CLI/Web 版本分派、
canonical-JSON 交叉向量，以及真实 Cloudflare R2 端到端 Git 流程（push /
clone / fetch / ls-remote / tag / ref 删除 / tombstone 重建）加匿名公开
GET + CORS 验证，另有一次真实测试网 + R2 的增量（schema 2）推送。
**NOT PROVEN**：真实 AWS S3 canary（金丝雀验证）、真实 force-push 过期与
并发竞争、R2 带外篡改检测、后继的 Blockscout 源码验证、Foundry 门禁。
不得弱化这些标签；参见 [project status](project-status.md)。

## 下一步

- v4 实操 → [第 04 章 · Suite v4](manual-suite-v4.md)
- 承诺的合约面 → [第 07 章](manual-protocol-contracts.md)
- CLI 参考中的存储命令 → [第 02 章](manual-cli-reference.md)
- 某处失败 → [第 10 章 · 故障排查](manual-troubleshooting.md)
