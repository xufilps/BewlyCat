import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
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
