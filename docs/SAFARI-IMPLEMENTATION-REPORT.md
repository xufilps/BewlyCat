# BewlyCat Safari 本地自用实施记录

实施日期：2026-09-21。目标是在不发布到 App Store、不影响 Chrome 与 Firefox 构建的前提下，把 BewlyCat 转换为可由本机 Xcode 签名并在 Safari 27 中自用的 WebExtension。

## 已完成的项目改动

- 增加 `build-safari`、`check:safari-build`、`convert-safari`、`prepare-safari` 与 `clear-safari` 命令，分别负责构建、校验、转换、首次准备和清理 Safari WebExtension 生成物。
- 增加 `scripts/check-safari-build.mjs`，检查 Safari 输出文件、Manifest V3 后台脚本、Bilibili host 权限、Safari 专用权限及跨平台隔离。
- Safari 构建单独加入 `declarativeNetRequestWithHostAccess`；Chrome 与 Firefox 的 manifest 不包含该权限。
- 本地容器 bundle identifier 使用 `com.xuan.BewlyCat-Safari`，Safari extension target 使用其 `.Extension` 子标识，满足 Xcode 的嵌入式扩展前缀校验。
- 增加 `docs/SAFARI-LOCAL.md`，记录首次生成、签名启用、日常更新、验证、清理恢复与 Git 边界。
- `extension-safari/` 与 `extension-safari-macos/` 保持为本机生成目录，不纳入 Git；个人 Team ID、Apple ID、证书、Provisioning Profile、Cookie 和 Bilibili 登录数据均未写入受跟踪文件。

## 对本机产生的影响

- 安装并使用了 `pnpm@11.17.0`；项目依赖按锁文件安装在本地工作区。
- Xcode 已登录用户自己的 Apple Account，并为两个 target 配置同一 Personal Team、Automatic Signing 与 Apple Development 本机签名。证书和签名资料由 macOS 钥匙串及 Xcode 管理，不在仓库中。
- 生成了 `extension-safari/` 和 `extension-safari-macos/`；后者保存本机 Xcode 工程与签名选择，普通 `clear-safari` 不会删除它。
- Safari 中已启用 BewlyCat 1.7.10，并只为 Bilibili 站点及运行所需 API 授予网站访问权限；没有授予所有网站权限。
- Xcode 的 External Agent Access 已设为 `Never`。这不影响正常编译和运行，只阻止 Xcode 的外部智能代理访问功能；需要时可在 Xcode 设置中手动改回。
- 首次 bundle identifier 失败的未签名工程备份位于 `/tmp/BewlyCat-extension-safari-macos-failed-id-20260921T2004`，其中没有 Personal Team 配置；系统清理临时目录或重启后可能自动移除。

## 已完成的真实环境验证

验证环境为 macOS 27.0、Safari 27.0、Xcode 27.0，使用真实生成的 Xcode 工程和真实 Bilibili 页面，没有使用模拟页面。

- Xcode 的 `BewlyCat Safari` scheme 完成 Apple Development 签名构建，macOS 容器成功启动，Safari 扩展列表能够识别并启用扩展。
- Bewly 首页能够替换原站首页且只挂载一次；Dock、深色界面、个性化推荐和已登录头像入口正常。
- 搜索页、视频页、动态页与个人空间均可打开；视频实际播放且 Safari 原生媒体控制未被破坏。
- 设置写入、刷新持久化和恢复原值均通过；测试期间临时开启的“横向滚动”已恢复为原来的关闭状态。
- 关闭全部 Bilibili 测试标签页并保留 30 秒空闲窗口后，系统中没有可见的 BewlyCat 扩展进程；重新打开 Bilibili 能冷启动 Bewly 首页，登录态、推荐数据、设置消息与刷新持久化仍正常。
- Chrome、Firefox 与 Safari 生成物分别构建；Safari 专用权限没有泄漏到 Chrome 或 Firefox。

## 已知限制与证据边界

- `safari-web-extension-packager` 会提示 Manifest 中的 `background.persistent` 和内容脚本 `world` 字段不受转换器支持。真实首页注入、视频、登录态、设置与冷启动验证均通过，因此没有加入未经证实的兼容 hack。
- Safari 没有提供可由本流程确定读取的“非持久后台已在某一时刻回收”信号。本次证据覆盖了关闭所有相关标签页、空闲、无可见扩展进程和重新冷启动，但不声称精确观测到了 Safari 内部回收时刻。
- 为避免破坏用户当前账号会话，没有主动退出 Bilibili 再重新登录。已验证当前登录态、个性化数据及后台恢复后的会话；仅发生在登出/重新登录瞬间的边缘行为未覆盖。
- 未处理 iPhone/iPad、TestFlight、App Store Connect、公证、正式发布证书、商店审核材料、GitHub 发布流水线和安装包分发。
- `.release-it.json` 仍引用项目中不存在的 `test` 脚本，这是与本次 Safari 自用迁移无关的既有问题。

## 日后更新

在仓库中运行：

```bash
pnpm build-safari
pnpm check:safari-build
```

随后打开既有 `extension-safari-macos/` Xcode 工程，确认两个 target 仍使用同一 Team，再运行 `BewlyCat Safari` scheme。日常更新不要重复运行 `pnpm convert-safari`，以免生成新工程并丢失既有签名选择。

## 回滚与恢复

源码回滚前先运行 `git log --oneline main..HEAD` 核对本分支提交，再按需要对明确提交执行 `git revert <commit>`；不要使用 `git reset --hard`。Safari WebExtension 生成物可用以下命令安全重建：

```bash
pnpm clear-safari
pnpm build-safari
pnpm check:safari-build
```

上述命令不会删除 `extension-safari-macos/`。确需重建 Xcode 工程时，先退出 Xcode 与 BewlyCat Safari 包含应用，备份并核对该目录只含生成工程，再重新运行 `pnpm prepare-safari`，为两个 target 重新选择同一 Team。若不再使用，可在 Safari 设置中停用扩展；删除证书或 Apple Account 属于独立的系统账户操作，不应作为普通项目清理步骤执行。
