# next-injective-git-docs — 双语文档站仓库

[Hny0305Lin/next-injective-git-docs](https://github.com/Hny0305Lin/next-injective-git-docs)
托管 Next Injective Git 的 Docusaurus 3 双语（en/zh）文档站。

## 结构

```
docs-site/   站点工具链（Docusaurus，Node ≥ 24；本仓库的构建根）
docs/        主仓库 docs/ 的只读镜像（同步产物，禁止手改）
```

**内容事实源在主仓库** [Hny0305Lin/next-injective-git](https://github.com/Hny0305Lin/next-injective-git)
（`docs/` + `CLAUDE.md` 规范）。本仓库只承载站点与镜像；改动文档请去主仓库，
然后在这里 `npm --prefix docs-site run sync:docs` 同步、构建、推送。

## 常用命令（在 docs-site/ 下）

```sh
npm install                # 安装依赖
npm run sync:docs          # 从主仓库镜像 docs/（禁止手改本仓库 docs/）
npm run build              # 构建 en + zh（输出 build/、build/zh/）
npm run start              # 本地开发服务器
npm run fetch:contributors # 刷新贡献者缓存（统计自主仓库 next-injective-git）
npm run gen:zh-stubs       # 为未翻译页面生成 zh 占位（不覆盖已有译文）
```

规则详见主仓库 `CLAUDE.md`（唯一规范源）与 `AGENTS.md`、`docs/AGENTS.md`。
维护任务模板：[docs-site/MAINTENANCE-PROMPT.md](docs-site/MAINTENANCE-PROMPT.md)。
部署指引（用户本人操作）：[docs-site/DEPLOYMENT.md](docs-site/DEPLOYMENT.md)。
CI 门禁：`.github/workflows/docs.yml`。
