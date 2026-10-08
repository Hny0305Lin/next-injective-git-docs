# docs-site — Next Injective Git 双语文档站

Docusaurus 3（Node ≥ 24）。内容事实源是仓库的 `../docs`，本目录只放站点
工具链。英文为唯一事实源，中文经 Docusaurus i18n 提供（`/zh/`）。

```sh
npm install                # 安装依赖
npm run build              # 构建 en + zh 静态站点到 build/
npm run start              # 本地开发服务器
npm run fetch:contributors # 刷新贡献者缓存（src/generated/contributors.json）
npm run gen:zh-stubs       # 为未翻译页面生成 zh 占位（不覆盖已有译文）
npm run write-translations # 生成 zh 翻译骨架（新增 sidebar 项后运行并补译）
```

规则与流程见根目录 `CLAUDE.md`（唯一规范源）、`AGENTS.md`、
`docs/AGENTS.md`。部署指引（用户本人操作）：[DEPLOYMENT.md](./DEPLOYMENT.md)。
定时维护模板：[MAINTENANCE-PROMPT.md](./MAINTENANCE-PROMPT.md)。
CI 门禁：`.github/workflows/docs.yml`。
