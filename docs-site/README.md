# docs-site — Next Injective Git 双语文档站（站点工具链）

Docusaurus 3（Node ≥ 24）。本目录挂载同仓库的 `../docs`（主仓库
`next-injective-git` 的 `docs/` **只读镜像**，由 `npm run sync:docs` 生成，
禁止手改）。英文为唯一事实源，中文经 Docusaurus i18n 提供（`/zh/`）。

```sh
npm install                # 安装依赖
npm run build              # 构建 en + zh 静态站点到 build/
npm run start              # 本地开发服务器
npm run sync:docs          # 从主仓库镜像 docs/（禁止手改本仓库 docs/）
npm run fetch:contributors # 刷新贡献者缓存（src/generated/contributors.json）
npm run gen:zh-stubs       # 为未翻译页面生成 zh 占位（不覆盖已有译文）
npm run write-translations # 生成 zh 翻译骨架（新增 sidebar 项后运行并补译）
```

规则与流程见主仓库 `CLAUDE.md`（唯一规范源）、`AGENTS.md`、`docs/AGENTS.md`。
部署指引（用户本人操作）：[DEPLOYMENT.md](./DEPLOYMENT.md)。
定时维护模板：[MAINTENANCE-PROMPT.md](./MAINTENANCE-PROMPT.md)。
CI 门禁：本仓库 `.github/workflows/docs.yml`。
