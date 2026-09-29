# Safari 本地自用完整指南

本文说明如何在当前 Mac 上把 BewlyCat 作为 Safari WebExtension 构建、签名、启用、更新和恢复。它只服务于本机个人使用，不是上游官方 Safari 发行方案，也不提供可分发的 `.app`、`.dmg`、TestFlight 或 App Store 安装包。

实施结果、实际验证证据和本机影响另见 [Safari 本地自用实施记录](SAFARI-IMPLEMENTATION-REPORT.md)。Chrome、Edge 与 Firefox 的通用开发方式仍以原有 [贡献指南](CONTRIBUTING-cmn_CN.md) 为准。

## 1. 项目来源与许可证边界

BewlyCat 基于 [BewlyBewly](https://github.com/BewlyBewly/BewlyBewly) 开发，并保留了原项目历史、贡献者与鸣谢信息。仓库根目录的 [README](../README.md) 说明了项目来源、功能定位和上游维护策略；根目录的 [LICENSE](../LICENSE) 是基于 MIT 条款并附加客户端形态限制的自定义许可证，明确禁止把本项目或衍生代码封装、转换、集成为独立客户端，也禁止以桌面端、移动端 App 或类似形式发布和分发。完整授权文本是使用与再分发时必须遵守的依据，不能用本文替代。

本地 Safari 方案遵守以下工程边界：

- 保留 BewlyCat、BewlyBewly、原作者和历史贡献者的署名、版权与许可证文本，不移除或改写来源信息。
- README 明确说明上游不会打包 Safari，也不会承诺大量 Safari-only 适配；本文记录的是当前 fork 的本机自用流程，不代表 BewlyCat 或 BewlyBewly 上游提供 Safari 官方支持。
- Xcode 生成的 macOS containing app 只承担 Safari WebExtension 的系统承载和注册作用，不提供独立浏览、播放或客户端功能，不应被改造成 Bilibili 桌面客户端。
- 不发布、分发、传播或提供 containing app、`.app`、`.dmg`、安装器、移动端 App 或类似独立客户端形态的下载。
- 不把此流程描述为官方发行版，不使用原作者名义提供支持、承诺兼容性或进行商业分发。
- 如需公开再分发源代码或作进一步衍生，应重新阅读完整 LICENSE 并自行确认合规性；本文只是工程边界说明，不构成法律意见。

## 2. 支持范围

当前流程只验证以下组合：

- macOS 27.0
- Safari 27.0
- Xcode 27.0
- Node.js 22.23.2
- pnpm 11.17.0
- BewlyCat 1.7.10

以下内容不在本流程范围内：

- iPhone、iPad、visionOS 或其他 Apple 平台
- TestFlight、App Store Connect、商店审核、公证和 Developer ID 分发
- 正式发布证书、组织 Team、自动签名流水线和安装包下载
- Safari 旧版本兼容承诺
- 将扩展功能封装为独立桌面或移动客户端

## 3. 实现结构

Safari 版本继续使用项目原有 Vue 3、TypeScript、Vite、UnoCSS 与 WebExtension 代码，不复制业务实现。构建链分为两层：

1. `SAFARI=true` 生成标准 WebExtension 到 `extension-safari/`。
2. Apple 的 `safari-web-extension-packager` 生成仅供本机 Xcode 使用的 containing app 工程到 `extension-safari-macos/`。

本地容器使用 bundle identifier `com.xuan.BewlyCat-Safari`，Safari extension target 使用 `com.xuan.BewlyCat-Safari.Extension`。父子标识关系是 Xcode 嵌入式扩展签名校验的要求，不能随意改成互不相关的值。

相关命令如下：

| 命令 | 用途 | 是否保留 Xcode 签名设置 |
| --- | --- | --- |
| `pnpm build-safari` | 重建 `extension-safari/` | 是 |
| `pnpm check:safari-build` | 检查生成物与 manifest 契约 | 不修改文件 |
| `pnpm convert-safari` | 首次生成 Xcode 工程 | 不适合日常重复运行 |
| `pnpm prepare-safari` | 首次执行构建、检查和转换 | 仅首次准备使用 |
| `pnpm clear-safari` | 删除并重建前清理 WebExtension 生成物 | 是，不删除 `extension-safari-macos/` |

## 4. 对电脑产生的持久影响

完成本地安装后，电脑上会存在以下状态：

- 项目依赖安装在当前工作树的 `node_modules/` 中，系统可使用项目声明的 `pnpm@11.17.0`。
- `extension-safari/` 保存当前 Safari WebExtension 构建结果。
- `extension-safari-macos/` 保存 Xcode 工程、两个 target 的本机签名选择和对 `extension-safari/` 的资源引用。
- Xcode 使用用户自己的 Apple Account、Personal Team 和 Apple Development 证书完成本机签名；这些资料由 Xcode 与 macOS 钥匙串管理。
- Safari 中会出现并启用 BewlyCat 扩展，网站访问权限只授予实际需要的 Bilibili 相关站点。
- Xcode 的 External Agent Access 在本次实施中设为 `Never`；这不影响普通编译、签名和运行，需要时可在 Xcode 设置中手动调整。

仓库不会跟踪 Xcode 工程、构建生成物、Apple ID、Team ID、证书、Provisioning Profile、Cookie 或 Bilibili 登录数据。

## 5. 首次构建与安装

### 5.1 准备环境

确认 Xcode 已完成首次启动设置，然后在仓库根目录执行：

```bash
pnpm --version
pnpm install --frozen-lockfile
```

`pnpm --version` 应输出 `11.17.0`。依赖安装完成后，`package.json` 和 `pnpm-lock.yaml` 不应发生无意修改。

### 5.2 生成 Safari WebExtension 与 Xcode 工程

首次准备执行：

```bash
pnpm prepare-safari
```

该命令依次完成：

1. 构建 `extension-safari/`。
2. 运行 manifest 与关键文件检查。
3. 生成 `extension-safari-macos/` Xcode 工程。

转换器可能提示 Manifest 中的 `background.persistent` 和内容脚本 `world` 不受转换器直接支持。当前真实运行验证已覆盖首页注入、视频播放、登录态、设置与后台冷启动，因此不要仅为消除警告加入未经运行证据支持的兼容代码。

### 5.3 配置本机签名

1. 打开 `extension-safari-macos/` 中生成的 `.xcodeproj`。
2. 在 Xcode 的 macOS app target 中启用 `Automatically manage signing`，选择自己的 Personal Team。
3. 在 Safari extension target 中选择同一个 Personal Team，并保持自动签名。
4. 确认两个 target 的 bundle identifier 分别为父标识与 `.Extension` 子标识。
5. 选择 `BewlyCat Safari` scheme 和 `My Mac`，执行 Run。

Personal Team、证书名称和 Team ID 只应保留在本机生成工程和系统钥匙串中，不要复制到受 Git 跟踪的源码或文档。

### 5.4 在 Safari 启用扩展

1. 打开 Safari 的扩展设置，确认能够看到 BewlyCat。
2. 启用扩展，仅允许 Bilibili 相关站点访问。
3. 访问 `https://www.bilibili.com/`，按 Safari 提示授予实际需要的站点权限。
4. 不要选择“所有网站”，也不要为与 Bilibili 无关的域名授予权限。

Safari 权限只控制扩展能否在相应网站注入界面和调用必要 API，不会把 Apple Account、签名证书或 Xcode Team 信息发送给 Bilibili。

## 6. 日常更新

源码更新后只执行：

```bash
pnpm build-safari
pnpm check:safari-build
```

随后回到既有 Xcode 工程，确认两个 target 仍使用同一 Team，再运行 `BewlyCat Safari` scheme。Xcode 工程直接引用 `extension-safari/` 下的 `dist`、`assets` 和 `manifest.json`，因此不需要每次重新转换。

日常更新不要重复运行 `pnpm convert-safari`，也不要给转换器增加 `--force` 或 `--copy-resources`：重复生成可能覆盖本机签名工程，复制资源则可能让 Xcode 使用与当前源码构建脱节的副本。

## 7. 验证清单

每次涉及 manifest、后台脚本、内容脚本或构建工具的更新后，至少检查：

- `pnpm check:safari-build` 通过。
- Safari 首页只挂载一份 Bewly UI，原站不白屏。
- 搜索能够打开结果，视频能够播放并保留 Safari 原生媒体控制。
- 动态页和个人空间能够打开。
- 当前账号登录态、头像入口、个性化推荐及收藏/稍后再看相关入口与网页账号一致。
- 临时切换一个可恢复的设置，刷新后仍保持；测试结束后恢复原值并再次确认。
- 关闭所有 Bilibili 标签页并保留空闲窗口后，重新打开首页仍能恢复扩展、消息监听和设置同步。
- Chrome 与 Firefox manifest 不包含 `declarativeNetRequestWithHostAccess`，Safari manifest 不包含 Firefox 专用设置。

如发现 Cookie、WBI 请求、主世界注入或后台恢复失败，应先记录请求 URL、响应码、Safari 控制台信息与调用链；日志不得包含 Cookie 值。只有得到稳定复现证据后，才增加最小范围的 Safari 兼容代码。

## 8. 隐私与权限说明

Safari 构建沿用扩展原有的 Bilibili 功能，并声明：

- `storage`：保存扩展设置。
- `cookies`：维持与当前 Bilibili 网页账号一致的登录请求能力。
- `declarativeNetRequest` 与 `declarativeNetRequestWithHostAccess`：应用项目已有的 Bilibili 请求规则。
- Bilibili 与 hdslb host permissions：在目标站点注入界面、请求 API 和加载必要媒体资源。

本流程没有加入“所有网站”访问、摄像头、麦克风、定位、通讯录、日历或文件系统权限。真实验证只确认功能是否正常，不记录或提交 Cookie、账号昵称、用户 ID、观看记录、收藏内容及签名身份信息。

## 9. 常见问题

### Xcode 报嵌入式扩展标识不匹配

确认 app target 使用 `com.xuan.BewlyCat-Safari`，extension target 使用 `com.xuan.BewlyCat-Safari.Extension`。两个 target 还必须选择同一个 Team。

### Safari 中看不到扩展

先在 Xcode 选择 `BewlyCat Safari` scheme 和 `My Mac` 执行 Run，再检查 Safari 扩展设置。只运行 `pnpm build-safari` 不会注册 containing app。

### 更新后仍看到旧界面

依次运行 `pnpm build-safari`、`pnpm check:safari-build`，再回到原 Xcode 工程执行 Run，最后刷新 Bilibili 页面。不要重新生成另一个 Xcode 工程来绕过问题。

### `pnpm prepare-safari` 提示目标工程已存在

这是防止覆盖本机签名配置的保护结果。日常更新应使用 `build-safari` 与 `check:safari-build`；只有明确备份旧工程并准备重新选择 Team 时，才重建 Xcode 工程。

### Personal Team 签名失效

Personal Team 的签名有效期和配置文件由 Apple/Xcode 管理，可能需要定期重新签名。打开既有 Xcode 工程，确认账号与 Team 可用后再次 Run；不要把证书或 Provisioning Profile 提交到仓库。

## 10. 清理、停用与恢复

只重建 Safari WebExtension 生成物时执行：

```bash
pnpm clear-safari
pnpm build-safari
pnpm check:safari-build
```

这些命令不会删除 `extension-safari-macos/`。确需重建 Xcode 工程时，应先退出 Xcode 与 BewlyCat Safari containing app，确认目录位于仓库根目录且不含用户文件，再备份 `extension-safari-macos/`，重新运行 `pnpm prepare-safari` 并重新选择签名 Team。

如果暂时不使用扩展，可在 Safari 设置中停用它。删除 Apple Account、签名证书或钥匙串项目属于独立的系统账户操作，不是普通项目清理步骤，不应仅为清理仓库而执行。

源码回滚前先核对：

```bash
git log --oneline main..HEAD
```

对明确提交使用 `git revert <commit>` 创建可审计的反向提交，不使用 `git reset --hard`。本次实施已经在独立临时工作树中演练整组提交回滚，结果文件树能够恢复到实施前的 `main`。

## 11. Git 与公开协作边界

- `extension-safari/` 和 `extension-safari-macos/` 已由 `.gitignore` 排除，不应通过 PR 提交。
- 不提交 Apple ID、Team ID、证书、Provisioning Profile、Cookie、账号数据、Xcode DerivedData 或本地测试产物。
- Safari 相关 PR 应明确写明“本地自用”“非官方 Safari 发行”“不提供客户端安装包”。
- 不修改根 README 中关于项目来源、Safari 上游策略、历史贡献者和鸣谢的原有说明。
- 若未来需要发布任何二进制或面向第三方分发，应在行动前重新核对 LICENSE，而不是把本地自用流程直接当作发布授权。

## 12. 当前已知限制

- 没有验证 iOS/iPadOS，也没有商店分发能力。
- 没有主动退出当前 Bilibili 账号后重新登录；已验证现有登录态和后台恢复后的会话，登出/登录瞬间的边缘行为仍未覆盖。
- Safari 没有向此流程暴露可确定读取的后台回收时刻；现有证据覆盖关闭全部 Bilibili 标签页、空闲、无可见扩展进程及重新冷启动。
- `.release-it.json` 仍引用项目中不存在的 `test` 脚本，这是与 Safari 自用迁移无关的既有问题。

以上边界确保 Safari 支持保持为浏览器扩展的本机开发用途，不改变 BewlyCat 的原始定位，也不把 containing app 作为独立客户端发布或传播。
