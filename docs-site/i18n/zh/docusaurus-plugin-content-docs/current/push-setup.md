# Push 配置

当前已实现的 IPFS 路径需要 Git、`igit`、`git-remote-igit` 与原生 Kubo。
Windows、Linux、macOS 各自运行原生二进制。Windows 与 Linux 路径不安装
WSL2、`injectived`、链守护进程或旧版签名器。

敏感本地状态在 POSIX 上为仅所有者（文件 `0600`、目录 `0700`）。原生
Windows 使用受保护 DACL，仅当前用户与 `SYSTEM` 拥有完全访问权；POSIX
权限位不作为 Windows 验收证据。配置与 keystore 索引的写入先在该策略下
暂存，再原子发布。EVM key 文件直接创建于受保护的 keystore 目录内。既有
配置与 EVM keystore 文件在读取前重新加固保护；最终路径上的符号链接与
Windows 重解析点一律 fail-closed，keystore 目录之外或其下层的被索引 key
文件会被拒绝。受保护替换不会穿透既有的符号链接或硬链接目标写入。

```sh
igit setup push
igit key import dev
igit config set key_name dev
igit config set evm_suite_directory_address 0x...
igit suite verify
```

Kubo 的下载源与校验和固定在 `cli/internal/bootstrap/deps.json`。每个源
都有独立的连接、响应头、body 空闲与总超时，因此卡住的镜像会推进到下一
个固定 URL。Windows 工件清单按固定 IPFS 分发 CID 经 Pinata 与项目 HK/US
网关、再经上游分发与 GitHub 源获取；所有下载字节仍必须匹配固定 SHA-256。

API 必须仅监听回环地址。Clone 与 fetch 不需要 Kubo：remote helper 从已
验证的 Suite 读取 ref，并经 HTTPS 网关下载 pack。

Push 会添加临时本地 pack，取得 CID 绑定的持久化复制，然后提交
`updateRef`。垃圾回收只在链上回执成功后进行。交易结果不确定时返回交易
哈希并保留可重试数据。

Directory 地址必须来自获批的切换（cutover）证据。缺失、未激活、链不匹配、
版本不匹配、代码哈希不匹配或绑定错误的 Suite 都会在签名前失败。

历史固定高度查询只能通过 `igit archive` 使用；它们不是 push 配置，也不是
回退路径。

Kubo 是 Suite v3 的存储适配器，不是永久的产品前置条件。Suite v4（BYOS）
已交付：用户通过自己的 Amazon S3 或 Cloudflare R2 存储桶 push 与 fetch，
无需本地 Kubo 守护进程，见
[ADR 0002](adr/0002-pluggable-pack-storage.md) 与
[ADR 0004](adr/0004-mainnet-storage-neutral-successor-and-byos-scope.md)；
remote helper 依据链上套件版本选择路径。
