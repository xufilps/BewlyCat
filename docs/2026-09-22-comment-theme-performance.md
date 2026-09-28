# 2026-09-22 评论区深色主题与布局性能修复

## 问题与修改

深色主题下，Bilibili 原生评论区的背景、正文和发表评论输入区分别由页面样式及多个 Shadow DOM 管理。原有适配覆盖了部分边框、用户名和标签，但正文与编辑器仍可能沿用站点的浅色配色，导致暗背景上的文字难读，输入区也显得过亮。

- `src/styles/adaptedStyles/common/comments.scss` 为评论区定义继承自 BewlyCat 主题的正文、背景和编辑器表面色，并补齐旧版评论正文与输入区的深色样式。动态卡片中的评论背景沿用卡片表面色。
- `src/inject/index.ts` 使用既有的评论 Web Component 样式注入机制，让主评论、子回复和发表评论编辑器使用同一组主题色；没有改动 Bilibili 评论数据或发表逻辑。
- `src/components/MomentCard/MomentCommentTree.vue` 在每次引导线布局计算时建立评论 ID 与父子关系索引，避免为每个节点反复扫描整组评论。

## 验证范围

在本地 `main` 工作目录执行了相关文件的 ESLint、`pnpm typecheck`、评论 SCSS 编译与 `git diff --check`，均通过。项目没有独立的单元测试套件；本次没有操作真实 Bilibili 页面，最终视觉效果和实际滚动性能仍需在真实浏览器中确认。

推送前的完整 `pnpm lint` 曾扫描到未跟踪的 `docs/superpowers/plans/` 代理计划，并将 Markdown 代码示例当作源码解析。`eslint.config.mjs` 现仅排除该计划目录；源码与其他文档仍经过原有 lint 流程。

## 本机自用与许可边界

仓库根目录 `LICENSE` 禁止将插件封装为独立客户端，也禁止以桌面或移动 App 等形式发布、分发或提供下载。本次 GitHub 提交只包含源代码和本文档；本机构建产物留在 Git 忽略目录，不加入提交、Release 或可公开下载的附件。Safari 的 Xcode containing app 若用于本机扩展注册，仅按本机自用流程处理，不作为独立客户端或分发安装包交付。

本地计划保存在被 Git 忽略的 `UI-FIX-PLAN.md`。Safari 既有签名工程位于另一工作树，当前 `main` 的源码改动不会自动进入该工程或已生成的扩展。

## 2026-09-22 Safari 本机交付记录

将已推送的 `main` 整合到本机 `feat/safari-extension` 工作树后，保留旧 `extension-safari/` 的本机备份与 SHA-256 清单，再执行 `pnpm build-safari`、`pnpm check:safari-build`、`pnpm lint` 和 `pnpm typecheck`，均通过。随后使用既有 Xcode 工程完成本机 Apple Development 签名构建，`codesign --verify --deep --strict` 通过；签入应用的 manifest、评论样式和注入脚本与本次构建产物哈希一致。

本机自用的 Safari 承载应用位于 `~/Applications/BewlyCat Safari.app`。它用于在 Safari 中注册浏览器扩展，不是独立客户端；没有生成 dmg、zip、Release 附件或公开下载地址。此次未打开真实 Bilibili 页面，也未验证 Safari 内的最终评论区视觉效果；应用启用状态和页面效果仍需在本机确认。
