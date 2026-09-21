# Safari 本地自用说明

本文只描述 macOS Safari 27 的本地自用流程，不包含 iOS、TestFlight 或 App Store 发布。

## 前置环境

- macOS 27、Safari 27、Xcode 27
- Node.js 与 pnpm 11.17.0
- Xcode 中已登录可用于本机签名的 Apple ID

## 首次生成与安装

1. 运行 `pnpm install --frozen-lockfile`。
2. 运行 `pnpm prepare-safari`。
3. 打开 `extension-safari-macos/` 下生成的 `.xcodeproj`。
4. 为 macOS app 和 Safari extension 两个 target 选择同一 Team，并保持 Automatic Signing。
5. 运行 macOS app scheme，然后在 Safari 设置的扩展页面启用 BewlyCat Safari。
6. 仅向 Bilibili 与 hdslb 相关域授予网站访问权限。

## 日常更新

运行 `pnpm build-safari && pnpm check:safari-build`，随后回到既有 Xcode 工程重新运行 macOS app。不要再次执行 `pnpm convert-safari`，以免新工程与已有签名配置冲突。

## 验证

至少检查首页、搜索页、视频页、动态页、空间页、登录态、推荐请求、设置持久化，以及后台休眠后的再次打开。Safari Web Inspector 中不应存在持续的扩展错误。

## 清理与恢复

`pnpm clear-safari` 只清理 WebExtension 生成物；再次运行 `pnpm build-safari && pnpm check:safari-build` 即可恢复。`extension-safari-macos/` 保存本机 Xcode 签名设置，不应被普通清理命令覆盖；确需重建时，先退出 Xcode 和包含应用并备份该目录，再重新运行 `pnpm prepare-safari`。

## Git 边界

`extension-safari/` 和 `extension-safari-macos/` 都是本机生成目录，已被 `.gitignore` 排除。不得提交 Apple ID、Team ID、证书、Provisioning Profile、Cookie 或 Bilibili 登录数据。
