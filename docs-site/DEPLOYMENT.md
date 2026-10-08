# DEPLOYMENT.md — 文档站部署指引（Vercel + Cloudflare DNS）

> **本文档只提供操作步骤；所有账号注册、导入、域名配置均由用户本人在
> Vercel / Cloudflare 控制台完成。** AI/代理不得执行部署、不得申请账号、
> 不得接触任何部署凭证（Vercel token、Cloudflare API key 等）。
>
> **当前状态（2026-10-09）**：站点已由用户部署上线，
> **https://docs.igit.xyz** （Vercel 导入 `Hny0305Lin/next-injective-git-docs`，
> Root Directory=`docs-site`）。`docusaurus.config.js` 的 `url` 已同步为该
> 域名。本文余下步骤留作复核/重做/换域名时的操作记录。

## 0. 前置条件（用户本人确认）

- [ ] 文档站仓库 `Hny0305Lin/next-injective-git-docs` 已推送（含
      `docs-site/` 与 `docs/` 镜像）且 Actions `docs` workflow 为绿。
- [ ] 拥有 Vercel 账号（Free 计划即可）。
- [ ] 拥有域名，且 DNS 托管在 Cloudflare（或愿意把域名 NS 指到 Cloudflare）。
- [ ] 本地 `npm --prefix docs-site run build` 已经成功（CI 也会把关）。

## 1. Vercel 导入仓库（用户本人操作）

> **导入的是文档站仓库 `Hny0305Lin/next-injective-git-docs`**，不是主仓库。
> 内容改动流程：主仓库 `docs/` → `npm run sync:docs` 镜像到本仓库 →
> 推送本仓库 → Vercel 自动部署（见 MAINTENANCE-PROMPT.md）。

1. 登录 <https://vercel.com> → **Add New… → Project**。
2. 选择 `Hny0305Lin/next-injective-git-docs` → **Import**。
3. 关键配置（Vercel 会读取 `docs-site/package.json`，请逐项核对）：
   - **Root Directory**: `docs-site`
   - **Framework Preset**: `Docusaurus`（未自动识别时手动选择；
     Docusaurus 本质是 Vite/静态站点，选 Docusaurus 即可）
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm ci`
   - **Node.js Version**: 24（Settings → General → Node.js Version；
     `package.json` 已声明 `"engines": { "node": ">=24" }`）
4. （可选）Environment Variables：无需任何变量即可构建。
   `GITHUB_TOKEN` **不需要**：贡献者缓存已提交在仓库里，构建失败会自动
   回退缓存。如果你想在部署时刷新最新贡献者，可以添加名为
   `GITHUB_TOKEN` 的 Environment Variable（值为一个只读 GitHub PAT），
   并把 Build Command 改为：
   `npm run fetch:contributors && npm run build`
   ——但**没有必要**，维护任务会定期在本地跑 `npm run fetch:contributors`
   并随镜像一起推送。任何 token 都不要写进仓库。
5. **Production Branch**：`main`（Settings → Git → Production Branch，
   即本仓库默认分支）。推送该分支即生产部署；其他分支产生 Preview 部署。
6. 点 **Deploy**。首次构建约 2–4 分钟，产物为纯静态文件（`build/`，
   含英文站与 `build/zh/` 中文站）。

> 注意：主仓库 `Hny0305Lin/next-injective-git` 的 `web/`（产品前端）是
> 另一个 Vercel 项目；本项目是**独立的 docs 项目**，仓库与 Root Directory
> 均不同，互不影响。

## 2. Cloudflare DNS 解析（用户本人操作）

以下任选其一（推荐 A：子域名）：

### A. 子域名（例如 `docs.igit.xyz`）

1. Cloudflare 控制台 → 你的域名 → **DNS → Records → Add record**：
   - Type: `CNAME`
   - Name: `docs`（即 `docs.igit.xyz`）
   - Target: `cname.vercel-dns.com`
   - Proxy status: **DNS only（灰云）**——Vercel 自带 SSL 与 CDN，
     代理开启可能导致证书/重定向问题。
2. 记录 TTL 默认（Auto）即可。

### B. Apex 顶级域（`igit.xyz` 直接作为站点域名）

1. Cloudflare DNS 添加：
   - Type: `A`，Name: `@`，Target: `76.76.21.21`，Proxy: DNS only。
   - **以 Vercel 控制台 Domains 页给出的值为准**（Vercel 偶尔更新该 IP）。
2. 若 Cloudflare 拒绝裸域 A 记录（部分套餐行为），可改用 Cloudflare 的
   CNAME Flattening：Type `CNAME`、Name `@`、Target `cname.vercel-dns.com`。

## 3. Vercel 添加自定义域名（用户本人操作）

1. Vercel 项目 → **Settings → Domains → Add**，输入
   `docs.igit.xyz`（或裸域）。
2. Vercel 校验 DNS：显示 "Valid Configuration" 即成功；未生效时会给出
   它当前检测到的记录值，对照修正 Cloudflare。
3. SSL：Vercel 自动签发 Let's Encrypt 证书，无需手动操作。

## 4. DNS 生效验证（用户本人操作）

- `nslookup docs.igit.xyz`（或 `dig +short`）应返回
  Vercel 的 CNAME 解析结果。
- 浏览器打开 `https://docs.igit.xyz/`：
  - 首页应显示 iGit 徽标与 Contributors 墙；
  - 右上角语言切换 → 中文，URL 变为 `/zh/`；
  - `https://docs.igit.xyz/docs/adr` 显示 ADR 索引。
- 生效时间：通常 1–5 分钟，最长 24–48 小时。

## 5. 域名落地后的收尾（改完推送即可，Vercel 自动重新部署）

1. `docusaurus.config.js` 的 `url` 已于 2026-10-09 设为 `https://docs.igit.xyz`。
   换域名时：改 `url` → 本地 `npm run build` 验证 → 提交推送，Vercel 自动重部署。
2. `npm --prefix docs-site run build` 本地验证后提交推送。

## 6. 回滚

Vercel → Deployments → 任意历史部署 → **Promote to Production**。
无需接触 DNS。
