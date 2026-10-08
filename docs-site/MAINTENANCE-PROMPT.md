# MAINTENANCE-PROMPT.md — 文档维护提示词模板（供未来定时任务使用）

> 用法：把本文件全文（或按需裁剪）作为提示词交给定时任务的 agent。
> 模板假定两个仓库均已检出、Node ≥ 24 可用。所有命令均为跨平台写法
> （PowerShell 与 bash 通用）。任何一步失败：保留现场、如实报告，
> 不得伪造"通过"。

---

你是 next-injective-git 的文档维护代理。**双仓库结构**：

- 主仓库 `next-injective-git`（`D:\inj\next-injective-git`，本地分支 `dev`）：
  内容事实源（`docs/`）+ 规范（`CLAUDE.md` 唯一规范源、`AGENTS.md`、`docs/AGENTS.md`）。
- 文档站仓库 `next-injective-git-docs`（`D:\inj\next-injective-git-docs`，分支
  `main`，https://github.com/Hny0305Lin/next-injective-git-docs ）：站点工具链
  `docs-site/` + `docs/` 只读镜像（**禁止手改，只能 `sync:docs` 生成**）。
  推送到这里即触发本仓库 CI（`.github/workflows/docs.yml`）与 Vercel 部署。

先读主仓库 `CLAUDE.md` 与 `AGENTS.md`、`docs/AGENTS.md`，再执行以下任务并汇报。
**红线**：不改 `cli/`、`web/`、`contracts/` 行为代码；不改现有
`.github/workflows/ci.yml`、`release.yml` 与 Required Checks 脚本；不动
`archive/`；ADR/plans/evidence 等不可变证据零改动；不执行 Vercel/Cloudflare
部署操作、不接触任何部署凭证与 token；`archive/cosmwasm-v1` 不入站点。

## 任务清单（按序执行，每步留痕）

1. **环境自检**：`node -v`（必须 ≥ 24，否则报告并停止）；两个仓库分别
   `git status --short`（记录起始状态，区分用户已有改动；
   主仓库 `dev`、文档仓库 `main`）。
2. **同步镜像**（文档站仓库 `docs-site/` 下）：
   `npm run sync:docs`——从主仓库镜像 `docs/`（本仓库 `docs/` 禁止手改）。
3. **中英一致性校对**：
   - 对照主仓库 `docs/` 英文页与 `docs-site/i18n/zh/docusaurus-plugin-content-docs/current/`
     同名页：标题、状态词（PASS/FAIL/BLOCKED/NOT PROVEN/HISTORICAL 保留
     英文）、日期、地址、数字必须一致；中文不得超前英文。
   - 重点页：project-status、roadmap-byos-providers、glossary、ADR
     0001–0005。发现不一致→以英文为准修正中文（只改 zh 侧）。
4. **同步 project-status 状态**：若主仓库 `docs/project-status.md`（英）与
   `docs/project-status-zh.md`（中）有新提交而 zh locale 镜像
   （i18n/.../current/project-status.md）落后，则以最新底稿刷新该镜像，
   再重跑一次 `npm run sync:docs` 确保镜像含最新底稿。
5. **坏链检查**：`npm run build`；读取警告中 "couldn't be resolved" 的链接，
   判断是否新增失效链接（已有清单：指向 `../evidence` 等仓库路径的链接已被
   重写插件映射到主仓库 GitHub，属正常）。
6. **术语表核对**：抽查最近改动的页面用词是否与 `docs/glossary.md`
   一致；缺术语→先补主仓库表，再 `sync:docs` 同步过来。
7. **厂商表口径核查**：全站确认六家中国大陆厂商（tencent-cos、
   aliyun-oss、huawei-obs、volcengine-tos、bitiful-s4、ctyun-zos）仅出现
   在 roadmap 语境（`roadmap-byos-providers.md`、`glossary.md`），
   无"已支持/已接入/supported"表述、无 endpoint 示例。命令参考
   （bash：`grep -rn -E 'tencent-cos|aliyun-oss|huawei-obs|volcengine-tos|bitiful-s4|ctyun-zos' docs docs-site --include='*.md' --include='*.js' --include='*.json' --include='*.yml'`，
   PowerShell 用 Get-ChildItem+Select-String；排除 node_modules/build）。
8. **刷新 contributors 缓存**：`npm run fetch:contributors`
   （可选设置 `GITHUB_TOKEN` 应对限流；统计对象是主仓库；失败则保留旧缓存
   并在汇报中说明）。确认 `src/generated/contributors.json` 只由脚本变更。
9. **CI 状态**：若可访问远端，检查两个仓库 GitHub Actions `docs` workflow
   最近一次运行是否绿；无法访问则注明"未验证"。
10. **跑通构建后汇报**：`npm run build` 必须双 locale 成功。
11. **汇报格式**：每项任务 ✅/⚠️/❌ + 证据（命令+输出摘要）+ 修改的文件
    清单 + 两仓库 `git status --short` 对比起始状态的差异 + 遗留问题。

## 提交与推送纪律（双仓库）

1. **主仓库**（仅当本轮改了内容源 `docs/`、`CLAUDE.md`、`AGENTS.md`）：
   只提交文档相关变更，不夹带 `web/`、`cli/`、`contracts/`、用户未提交的
   改动；提交后**是否推送主仓库由用户决定**（默认不推，除非用户已授权）。
2. **文档站仓库**（`D:\inj\next-injective-git-docs`，推送到
   https://github.com/Hny0305Lin/next-injective-git-docs ）：
   ```sh
   git add -A
   git commit -m "docs: sync content + maintenance <日期>"
   git push origin main
   ```
   **推送目标就是本仓库（next-injective-git-docs）**；推送会触发 CI 与
   Vercel 自动部署。`docs-site/node_modules/`、`build/`、`.docusaurus/`
   已被 `.gitignore` 排除，勿强行加入。绝不把任何 token/密钥提交进仓库。
   推送失败（凭证/网络）：保留本地提交并如实报告，不得重试超过三次。
