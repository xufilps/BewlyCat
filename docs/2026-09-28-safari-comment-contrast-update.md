# Safari 评论区夜间模式修复更新说明（2026-09-28）

## 本次修复

用户在 Safari 视频页发现，夜间模式的评论文字、用户名、时间和操作项接近黑色，难以阅读；发表评论区域仍为浅色。经用户授权检查真实页面，问题出在 `bili-comments` 宿主的原生背景和文字变量仍被解析为浅色主题，错误值继承到多层 Shadow DOM。

本次在 BewlyCat 深色模式下，将评论专用主题 token 映射到该宿主的 `--bg1`、`--text1`、`--text2` 和 `--text3`。修改只涉及评论配色，不触碰评论内容、账号或发表流程。此前未命中实际节点的内部样式尝试已撤回。

## 验证与本机更新

- 在同一真实 Safari 视频页先临时测试相同 CSS，再安装本机新版本并刷新页面；刷新后临时测试样式已消失，评论正文、用户名、回复、时间、操作项和输入框均清晰可读，发表评论区域与夜间背景一致。
- `comments.scss` 的 Sass 编译、差异检查、`pnpm build-safari`、`pnpm check:safari-build`、Xcode 构建和 App 签名校验均通过；提交和推送钩子还运行了项目的 ESLint 与类型检查。
- 本机自用版本位于 `~/Applications/BewlyCat Safari.app`。安装前版本和扩展保存在 Safari 工作树 `.cache/safari-backups/2026-09-28-before-comment-contrast-v2/`，SHA-256 清单已校验。临时开启的 Safari 网页开发者功能已恢复关闭。

## 许可与交付范围

仓库根目录 `LICENSE` 在 MIT 条款外限制将插件封装为独立客户端，并禁止以桌面或移动 App 等形式发布、分发、传播或提供下载。此 Safari 分支在 GitHub 只保存修复源码和文档；已签名的 Safari 承载应用仅留在本机用于注册浏览器扩展，不制作或上传 dmg、zip、Release 附件，也不提供公开下载链接。
