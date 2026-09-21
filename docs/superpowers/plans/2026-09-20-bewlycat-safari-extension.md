# BewlyCat Safari 自用扩展 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前 BewlyCat `main` 分支稳定地构建、转换、签名并安装为仅供当前 Mac 自用的 Safari Web Extension，同时保留 Chrome 与 Firefox 构建行为。

**Architecture:** 沿用仓库已有的 `SAFARI=true` 条件构建，让 Vite、tsup、manifest 生成器输出标准 WebExtension 到 `extension-safari/`，再由 Xcode 自带的 Safari Web Extension Packager 生成忽略于 Git 的 macOS 容器工程。Safari 差异只放在构建配置、manifest 条件分支和确有运行证据的兼容层中，不复制业务实现，也不做 App Store 发布链路。

**Tech Stack:** Vue 3、TypeScript 5.9、Vite 7、tsup 8、WebExtension Manifest V3、pnpm 11.17.0、Safari 27、Xcode 27、Safari Web Extension Packager。

## Global Constraints

- 目标平台只包含当前 Mac 上的 macOS Safari 27，不在本阶段支持 iOS、iPadOS、App Store、TestFlight 或 Safari 旧版本。
- 保留 Chrome/Edge 与 Firefox 的现有构建、manifest 和运行行为；所有 Safari 差异使用显式条件分支。
- 不提交 `extension/`、`extension-firefox/`、`extension-safari/`、`extension-safari-macos/`、签名资料、构建产物或个人 Team ID。
- 不把 Apple ID、证书、Provisioning Profile、Cookie、Bilibili 登录数据写入仓库、日志或计划文件。
- 不添加仅为“预防可能问题”而存在的 Safari hack；每个运行时兼容改动必须对应转换器警告、Safari 控制台错误或人工复现证据。
- 当前仓库没有单元测试脚本；验证以 lint、typecheck、Knip、三平台构建、manifest 断言、Xcode 构建和真实 Safari 冒烟测试组成。
- 每个实现任务形成独立可验证的 Git 检查点；不提交或推送前先确认用户授权，且不跳过现有 hooks。

---

## 现状审计（2026-09-20）

### 仓库与版本

- 仓库：`/Users/xuan/Developer/repos/BewlyCat`，当前提交 `e838e1b6`，分支 `main` 与 `origin/main` 一致，工作区在写本计划前无未提交修改。
- `origin` 指向用户 fork：`https://github.com/xufilps/BewlyCat.git`；当前未配置上游 `keleus/BewlyCat` remote，本任务不需要新增 remote。
- 项目版本为 `1.7.10`，锁文件格式为 pnpm lockfile v9，`package.json` 固定 `packageManager: pnpm@11.17.0`。
- 当前 shell 为 Node `v25.2.1`、npm `11.6.2`；`pnpm` 与 `corepack` 均不可用，`node_modules/` 不存在，因此尚未执行依赖安装或构建。
- 当前机器为 macOS 27.0、Safari 27.0、Xcode 27.0；`safari-web-extension-packager` 与兼容别名 `safari-web-extension-converter` 均可调用。

### 已有 Safari 基础

- `scripts/utils.ts` 已识别 `SAFARI=true`；`scripts/prepare.ts`、`scripts/manifest.ts`、三份 Vite/tsup 配置均可输出到 `extension-safari/`。
- `package.json` 已有 `build-safari`、`convert-safari`、`clear-safari`，但转换脚本仍调用旧命令名，缺少非交互参数、固定 App 名称、固定 bundle identifier 和可复验的原生构建步骤。
- `src/manifest.ts` 为 Safari 生成非持久后台脚本，并主动移除 `scripting` 权限；`src/background/contentScriptRefreshPrompt.ts` 也在 Safari 构建中禁用依赖 `scripting.executeScript` 的更新提示。
- Safari 支持最初来自历史提交 `9932c777`，并在 `b9ba8dc1` 恢复；当前 README 明确表示上游不打包 Safari，因此本项目定位应是 fork 内的自用维护，而非宣称上游正式支持。

### 已确认风险

- Safari 动态规则使用 `modifyHeaders`，Apple 当前文档要求 `declarativeNetRequestWithHostAccess`；现有 Safari manifest 只声明 `declarativeNetRequest`，需要由生成 manifest 与真实运行验证共同确认权限策略。
- 后台 API 请求、登录态监听和 WBI 签名依赖 Cookie；Safari 历史上存在后台请求不自动携带 Cookie 的兼容问题，当前代码只为 Firefox 显式复制 Cookie，必须在真实账号环境验证后再决定是否扩展兼容路径。
- 第二组内容脚本使用 `world: 'MAIN'`；是否被当前 Safari 27 packager 接受，应以 packager 输出和页面功能为准，不能仅凭 TypeScript 类型判断。
- `browser.storage.session` 已在代码中做异常降级；Safari 27 支持该 API，但仍需验证非持久后台唤醒后设置同步、登录态广播和消息处理是否恢复。
- `.release-it.json` 仍调用已经不存在的 `pnpm run test --run`，这是现存发布配置缺陷，与自用 Safari 包无直接关系；本任务记录但不顺带修改。
- `build-safari` 会清理 `extension-safari/`；原生 Xcode 工程位于独立的 `extension-safari-macos/`，并由 `.gitignore` 排除，清理和重建时不得覆盖已配置的签名工程。

## 目标文件结构

- Modify: `package.json` — 统一 Safari 的构建、转换和本地检查入口，保留现有脚本名的兼容性。
- Modify: `src/manifest.ts` — 只放 Safari 所需的 manifest 权限与受验证的键差异。
- Create: `scripts/check-safari-build.mjs` — 对生成物执行无浏览器依赖的确定性检查，失败时返回非零状态。
- Modify: `knip.json` — 仅在新增脚本触发真实 Knip 误报时更新入口；不预先加入忽略项。
- Create: `docs/SAFARI-LOCAL.md` — 记录本机自用构建、Xcode 签名、Safari 启用、更新和恢复步骤，不修改上游 README 的支持承诺。
- Generated and ignored: `extension-safari/` — Safari WebExtension 构建产物。
- Generated and ignored: `extension-safari-macos/` — Xcode macOS 容器与本机签名配置。

### Task 1: 建立可复现工具链与基线

**Files:**
- Verify: `package.json`
- Verify: `pnpm-lock.yaml`
- Verify: `.npmrc`
- No source changes

**Interfaces:**
- Consumes: Node、npm、`packageManager: pnpm@11.17.0`、Xcode command line tools。
- Produces: 可用的 `pnpm 11.17.0`、按锁文件安装的依赖，以及 Chrome/Firefox 的现状基线。

- [ ] **Step 1: 创建实施分支并记录起点**

```bash
git switch -c feat/safari-extension
git status --short --branch
git rev-parse HEAD
```

Expected: 分支为 `feat/safari-extension`，起点为 `e838e1b6`，除本计划文件外无其他改动。

- [ ] **Step 2: 安装项目声明的 pnpm 版本**

```bash
npm install --global pnpm@11.17.0
pnpm --version
```

Expected: `pnpm --version` 输出 `11.17.0`；若 pnpm 11 拒绝 Node 25，则先安装并切换到当期 Node LTS，再重复本步骤，不修改锁文件来迁就本机环境。

- [ ] **Step 3: 严格按锁文件安装依赖**

```bash
pnpm install --frozen-lockfile
git status --short
```

Expected: 安装成功，`pnpm-lock.yaml` 与 `package.json` 均未被改写。

- [ ] **Step 4: 运行改动前静态基线**

```bash
pnpm lint
pnpm typecheck
pnpm knip
```

Expected: 三条命令全部退出码为 0；若存在上游基线失败，原样记录命令、错误和提交号，不把无关修复混入 Safari 改动。

- [ ] **Step 5: 运行现有 Chrome 与 Firefox 构建基线**

```bash
pnpm build
pnpm build-firefox
```

Expected: 生成 `extension/manifest.json` 与 `extension-firefox/manifest.json`，两条命令均退出码为 0。

- [ ] **Step 6: 提交计划检查点**

```bash
git add docs/superpowers/plans/2026-09-20-bewlycat-safari-extension.md
git commit -m "docs: 添加 Safari 自用扩展实施计划"
```

Expected: 只提交本计划；执行前确认用户已授权提交。

### Task 2: 固化 Safari manifest 契约与生成物检查

**Files:**
- Modify: `src/manifest.ts`
- Create: `scripts/check-safari-build.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `SAFARI=true`、`extension-safari/manifest.json`、现有 `CONTENT_SCRIPT_MATCHES`。
- Produces: `pnpm check:safari-build`，用于验证 Safari 构建目录、关键文件、manifest 权限和平台隔离。

- [ ] **Step 1: 先写会失败的 Safari 生成物检查器**

创建 `scripts/check-safari-build.mjs`，内容如下；它在任一条件不满足时输出具体错误并以非零状态结束：

```js
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = path.join(repositoryRoot, 'extension-safari')
const requiredFiles = [
  'manifest.json',
  'assets/icon-512.png',
  'assets/rules.json',
  'dist/background/index.js',
  'dist/contentScripts/pageLoading.js',
  'dist/contentScripts/index.global.js',
  'dist/contentScripts/inject.global.js',
  'dist/contentScripts/style.css',
]

const errors = []
function check(condition, message) {
  if (!condition)
    errors.push(message)
}

for (const relativePath of requiredFiles) {
  check(
    fs.existsSync(path.join(outputDirectory, relativePath)),
    `Missing Safari build file: ${relativePath}`,
  )
}

const manifestPath = path.join(outputDirectory, 'manifest.json')
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const permissions = new Set(manifest.permissions ?? [])
  const hostPermissions = new Set(manifest.host_permissions ?? [])
  const scripts = manifest.content_scripts ?? []

  check(manifest.manifest_version === 3, 'Safari manifest must use Manifest V3')
  check(
    manifest.background?.scripts?.length === 1
    && manifest.background.scripts[0] === './dist/background/index.js'
    && manifest.background.persistent === false,
    'Safari background must be the nonpersistent bundled background script',
  )
  for (const permission of [
    'storage',
    'cookies',
    'declarativeNetRequest',
    'declarativeNetRequestWithHostAccess',
  ]) {
    check(permissions.has(permission), `Missing Safari permission: ${permission}`)
  }
  for (const permission of ['scripting', 'webRequest', 'webRequestBlocking'])
    check(!permissions.has(permission), `Unexpected Safari permission: ${permission}`)
  check(hostPermissions.has('*://*.bilibili.com/*'), 'Missing Bilibili host permission')
  check(hostPermissions.has('*://*.hdslb.com/*'), 'Missing hdslb host permission')
  check(scripts.length === 2, 'Safari manifest must contain both content-script entries')
  check(
    scripts.some(entry => entry.world === 'MAIN'
      && entry.js?.includes('./dist/contentScripts/inject.global.js')),
    'Missing MAIN-world inject content script',
  )
  check(
    manifest.declarative_net_request?.rule_resources?.some(
      rule => rule.id === 'ruleset_1' && rule.path === 'assets/rules.json',
    ),
    'Missing declarative network request ruleset',
  )
  check(!manifest.browser_specific_settings?.gecko, 'Safari manifest contains Firefox settings')
}

if (errors.length > 0) {
  for (const error of errors)
    console.error(`FAIL: ${error}`)
  process.exitCode = 1
}
else {
  console.log(`Safari build verified: ${requiredFiles.length} files and manifest contract passed`)
}
```

- [ ] **Step 2: 添加检查命令并验证它先失败**

在 `package.json` 的 `scripts` 中加入：

```text
"check:safari-build": "node scripts/check-safari-build.mjs"
```

Run:

```bash
pnpm build-safari
pnpm check:safari-build
```

Expected: Safari 构建完成，但检查器因缺少 `declarativeNetRequestWithHostAccess` 明确失败。

- [ ] **Step 3: 最小化修正 Safari 权限**

在 `src/manifest.ts` 的权限数组中加入以下条件项，Chrome/Edge 和 Firefox 的权限集合保持原样。不要删除 `declarativeNetRequest`，因为代码调用 `updateDynamicRules` 且静态规则仍由 `declarative_net_request.rule_resources` 声明。

```text
permissions: [
  'storage',
  'declarativeNetRequest',
  ...(isSafari ? ['declarativeNetRequestWithHostAccess'] : []),
  'cookies',
  ...(!isSafari ? ['scripting'] : []),
  ...isFirefox
    ? ['webRequest', 'webRequestBlocking']
    : [],
],
```

- [ ] **Step 4: 验证 Safari manifest 契约通过**

```bash
pnpm build-safari
pnpm check:safari-build
```

Expected: 输出每项检查通过的摘要并退出 0；`extension-safari/manifest.json` 不包含个人签名或机器路径。

- [ ] **Step 5: 验证其他浏览器没有权限漂移**

```bash
pnpm build
pnpm build-firefox
node -e "const fs=require('node:fs');const c=JSON.parse(fs.readFileSync('extension/manifest.json'));const f=JSON.parse(fs.readFileSync('extension-firefox/manifest.json'));if(c.permissions.includes('declarativeNetRequestWithHostAccess')||f.permissions.includes('declarativeNetRequestWithHostAccess'))process.exit(1);console.log('non-Safari permissions unchanged')"
```

Expected: 输出 `non-Safari permissions unchanged` 并退出 0。

- [ ] **Step 6: 提交 manifest 与检查器**

```bash
git add package.json src/manifest.ts scripts/check-safari-build.mjs
git commit -m "build(safari): 校验生成物与专用权限"
```

Expected: pre-commit hook 通过，提交中不含生成目录。

### Task 3: 让 Safari 转换流程安全且可重复

**Files:**
- Modify: `package.json`
- Create: `docs/SAFARI-LOCAL.md`
- Generated: `extension-safari-macos/`

**Interfaces:**
- Consumes: 已通过 `check:safari-build` 的 `extension-safari/`。
- Produces: 名为 `BewlyCat Safari`、bundle identifier 为 `com.xuan.bewlycat` 的本地 macOS Xcode 工程。

- [ ] **Step 1: 更新转换脚本到当前命令名**

将现有 `convert-safari` 改成非交互、只生成 macOS Swift 容器且不自动打开 Xcode 的命令：

```text
"convert-safari": "xcrun safari-web-extension-packager ./extension-safari --project-location ./extension-safari-macos --app-name 'BewlyCat Safari' --bundle-identifier com.xuan.bewlycat --swift --macos-only --no-prompt --no-open"
```

不要添加 `--force` 或 `--copy-resources`：前者可能覆盖已配置签名的工程，后者会让 Xcode 使用脱离当前构建目录的副本。

- [ ] **Step 2: 增加串行入口避免跳过检查**

在 `package.json` 中加入：

```text
"prepare-safari": "pnpm build-safari && pnpm check:safari-build && pnpm convert-safari"
```

Expected: 用户只需运行一个命令即可按“构建 → 检查 → 转换”顺序生成首次工程。

- [ ] **Step 3: 首次生成 Xcode 工程并保存 packager 输出**

```bash
pnpm prepare-safari
find extension-safari-macos -name '*.xcodeproj' -print
```

Expected: packager 无致命 manifest 错误，命令输出一个 `.xcodeproj`；任何 manifest warning 必须先判断是否影响现有功能，不能直接忽略。

- [ ] **Step 4: 记录自用操作文档**

创建 `docs/SAFARI-LOCAL.md`，正文按以下结构写入；其中版本与命令固定，签名 Team 仅在 Xcode 界面选择而不记录具体 ID：

```markdown
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
```

- [ ] **Step 5: 检查 Xcode 工程设置而不写入个人身份**

```bash
xcodebuild -project "$(find extension-safari-macos -name '*.xcodeproj' -print -quit)" -list
git status --short
```

Expected: Xcode 列出 macOS app 与 extension 的 scheme；Git 状态只显示预期的 `package.json` 和 `docs/SAFARI-LOCAL.md`，不显示生成工程。

- [ ] **Step 6: 提交转换流程与本地文档**

```bash
git add package.json docs/SAFARI-LOCAL.md
git commit -m "build(safari): 完善本地转换与安装流程"
```

Expected: 提交不包含 Xcode 工程、构建产物或签名标识。

### Task 4: 在 Xcode 与真实 Safari 中完成首轮验证

**Files:**
- Generated only: `extension-safari/`
- Generated only: `extension-safari-macos/`
- Modify only with evidence: `src/manifest.ts`、`src/background/utils.ts`、`src/background/index.ts` 或对应实际故障文件

**Interfaces:**
- Consumes: 已生成的 Xcode 工程和用户本机 Xcode Personal Team。
- Produces: 能在 Safari 27 中启用并访问 Bilibili 的签名本地扩展，以及可复述的运行证据。

- [ ] **Step 1: 在 Xcode 完成一次人工签名设置**

打开生成的 `.xcodeproj`，为 macOS app target 与 Safari extension target 选择同一个个人 Team，保持 Automatically manage signing，不把 Team ID 写回受 Git 跟踪文件。选择 macOS app scheme 并执行 Product → Run。

Expected: 包含应用成功启动，Safari 设置 → 扩展中出现 `BewlyCat Safari`。

- [ ] **Step 2: 启用最小网站权限**

在 Safari 启用扩展，仅允许 Bilibili 相关站点访问；先访问 `https://www.bilibili.com/`，再按 Safari 提示授予实际需要的域权限。

Expected: 不请求与 `CONTENT_SCRIPT_HOSTS` 无关的网站访问权限。

- [ ] **Step 3: 验证未登录核心路径**

按顺序检查首页、搜索页、视频页、动态页与空间页：扩展 UI 只挂载一次，Shadow DOM 样式正常，原站不白屏，页面切换无持续报错，视频可播放且控制功能不破坏 Safari 原生媒体能力。

- [ ] **Step 4: 验证登录与 Cookie 相关路径**

在用户本人已登录的 Safari 环境检查头像/昵称、首页推荐、稍后再看或收藏相关入口、WBI 签名请求和登录态变化。只在出现未登录响应、风控 HTML 或 Cookie 缺失证据时，才为 Safari 增加显式 Cookie 兼容路径。

Expected: 登录态与 API 数据和网页账号一致；任何失败均记录请求 URL、响应码、Safari 控制台信息和对应代码调用链，日志不得包含 Cookie 值。

- [ ] **Step 5: 验证后台休眠与恢复**

关闭所有 Bilibili 标签页，等待 Safari 回收非持久后台页，再重新打开首页；随后切换设置、刷新页面并切换登录态。

Expected: 消息监听、设置同步、动态规则和登录态监听恢复；若只在后台重启后失败，优先修复顶层监听注册与持久状态恢复，不改成持久后台页。

- [ ] **Step 6: 处理运行时验证分支**

若全部验证通过，不增加任何兼容代码并进入 Task 5。若 `world: 'MAIN'`、Cookie、后台唤醒或其他核心路径失败，先保留控制台与网络证据并暂停本计划的交付判定，再为已经稳定复现的单一问题补写一份独立修复计划；修复计划必须遵循“复现 → 失败检查 → 最小修改 → Safari 复验 → Chrome/Firefox 回归”，不能在本计划中预设未经证实的 hack。

### Task 5: 全量回归、交付与恢复演练

**Files:**
- Verify: 所有本次受跟踪改动
- Update if evidence changed: `docs/SAFARI-LOCAL.md`

**Interfaces:**
- Consumes: 完成 Safari 实机验证的实现分支。
- Produces: 可复建、可更新、可回滚的本地 Safari 扩展交付。

- [ ] **Step 1: 运行完整静态检查**

```bash
pnpm lint
pnpm typecheck
pnpm knip
git diff --check main...HEAD
```

Expected: 全部退出 0；不以“Safari 能运行”为理由接受跨平台静态错误。

- [ ] **Step 2: 重建并验证三平台生成物**

```bash
pnpm build
pnpm build-firefox
pnpm build-safari
pnpm check:safari-build
```

Expected: 四条命令全部退出 0；Chrome/Firefox manifest 未出现 Safari 专用权限，Safari manifest 未出现 Firefox 专用设置。

- [ ] **Step 3: 从干净生成物复验本地更新流程**

```bash
pnpm clear-safari
pnpm build-safari
pnpm check:safari-build
```

Expected: WebExtension 生成物可从源码重建，既有 `extension-safari-macos/` 和其签名设置未被删除；在 Xcode 再次 Run 后 Safari 加载新构建。

- [ ] **Step 4: 检查交付边界**

```bash
git status --short
git diff --stat main...HEAD
git ls-files extension-safari extension-safari-macos
```

Expected: 工作区无意外修改，最后一条命令无输出，提交历史中没有生成物、凭据或个人 Team ID。

- [ ] **Step 5: 验证回滚路径**

源码回滚先用 `git log --oneline main..HEAD` 核对范围，再执行 `git revert --no-edit $(git rev-list main..HEAD)`，以从新到旧的顺序创建反向提交；本地产物回滚先退出 Xcode 与包含应用，再删除明确的 `extension-safari/` 和 `extension-safari-macos/`，最后从已知良好提交重新执行 `pnpm prepare-safari` 并重新选择签名 Team。删除前确认两个目录都位于仓库根目录且不含用户文件。

- [ ] **Step 6: 编写最终交接**

交接必须包含：最终提交号、Safari/Xcode/macOS 版本、使用的 bundle identifier、构建与检查结果、真实页面验证清单、已知限制、更新命令、签名有效性说明、回滚步骤，以及未处理的 `.release-it.json` 既有问题。

## 完成判定

只有同时满足以下条件才算完成：`pnpm lint`、`pnpm typecheck`、`pnpm knip`、Chrome 构建、Firefox 构建、Safari 构建和 Safari 生成物检查全部通过；Xcode 成功签名并运行 macOS 容器；Safari 27 能启用扩展；未登录和登录核心路径均完成人工验证；后台休眠恢复后功能仍可用；Git 不跟踪生成物或个人签名信息；本地更新与回滚步骤已写入文档并实际演练。

## 不在本阶段处理

- iPhone/iPad 版本、触摸交互专项适配、App Store Connect、TestFlight、公证、正式发布证书与商店审核材料。
- 上游 README 的 Safari 支持承诺、GitHub Actions 的 macOS 发布流水线、自动下载或分发 `.app`/`.dmg`。
- 与 Safari 无关的功能重构、依赖大版本升级、`.release-it.json` 中缺失 `test` 脚本的问题。
- 在没有运行证据时重写 Cookie、内容脚本主世界注入或后台生命周期架构。

## 自检结果

- Spec coverage: 已覆盖配置审计、计划文件、构建、转换、签名、Safari 实机验证、跨浏览器回归、Git 检查点、风险、回滚和交接。
- Placeholder scan: 所有核心文件、脚本名、生成目录和 bundle identifier 均已明确；个人签名 Team 只能由 Xcode 在本机安全选择，因此明确限定为不入库的人工步骤。
- Type and command consistency: `build-safari` 始终产出 `extension-safari/`，`check:safari-build` 只读取该目录，`convert-safari` 只生成 `extension-safari-macos/`，`prepare-safari` 串联前三者且不覆盖既有 Xcode 工程。
