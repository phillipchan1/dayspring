import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { accessSync, constants, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Guardrail for the Xcode Cloud scripts that will archive the Tauri iOS app.
 * They live next to src-tauri/gen/apple/app.xcodeproj. A missing bit, a
 * forgotten chmod, or a script that stamps CFBundleVersion would make
 * Xcode Cloud either skip the scripts or collide with TestFlight builds
 * already uploaded by GitHub Actions.
 */
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CI_SCRIPTS_DIR = join(ROOT, 'src-tauri/gen/apple/ci_scripts')
const ENTRY_POINTS = ['ci_post_clone.sh', 'ci_pre_xcodebuild.sh'] as const
const ALL_SCRIPTS = [...ENTRY_POINTS, 'common.sh'] as const

const BUILD_NUMBER_KEYS = ['CFBundleVersion', 'CURRENT_PROJECT_VERSION'] as const

function readScript(name: string): string {
  return readFileSync(join(CI_SCRIPTS_DIR, name), 'utf8')
}

function stripComments(src: string): string {
  return src
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n')
}

describe('Xcode Cloud ci_scripts', () => {
  it('lives next to the committed app.xcodeproj', () => {
    expect(statSync(join(ROOT, 'src-tauri/gen/apple/app.xcodeproj')).isDirectory()).toBe(true)
    expect(statSync(CI_SCRIPTS_DIR).isDirectory()).toBe(true)
    const names = readdirSync(CI_SCRIPTS_DIR)
    for (const name of ALL_SCRIPTS) {
      expect(names, `missing ${name}`).toContain(name)
    }
  })

  it('is not swallowed by src-tauri/.gitignore /gen/apple', () => {
    for (const name of ALL_SCRIPTS) {
      const rel = `src-tauri/gen/apple/ci_scripts/${name}`
      const ignored = spawnSync('git', ['check-ignore', '-v', rel], {
        cwd: ROOT,
        encoding: 'utf8',
      })
      if (ignored.status === 0) {
        const last = (ignored.stdout || '').trim().split('\n').pop() || ''
        expect(last, `${rel} last matching rule must un-ignore, got: ${last}`).toMatch(/:\d+:!/)
      }
    }
  })

  it('marks the Apple entry points executable', () => {
    for (const name of ENTRY_POINTS) {
      const path = join(CI_SCRIPTS_DIR, name)
      expect(statSync(path).mode & 0o111, `${name} is not executable`).not.toBe(0)
      accessSync(path, constants.X_OK)
    }
  })

  it('never sets CFBundleVersion or CURRENT_PROJECT_VERSION', () => {
    for (const name of ALL_SCRIPTS) {
      const src = readScript(name)
      const active = stripComments(src)
      for (const key of BUILD_NUMBER_KEYS) {
        expect(active, `${name} must not assign ${key}`).not.toMatch(
          new RegExp(`${key}\\s*=`),
        )
        expect(active, `${name} must not pass --build-number`).not.toMatch(/--build-number/)
        expect(active, `${name} must not invoke agvtool`).not.toMatch(/\bagvtool\b/)
      }
      expect(src, `${name} should document the build-number policy`).toMatch(
        /CI_BUILD_NUMBER|Next Build Number/,
      )
    }
  })

  it('mirrors the GH iOS pre-archive steps that Xcode Cloud does not own', () => {
    const post = readScript('ci_post_clone.sh')
    const common = readScript('common.sh')
    const pre = readScript('ci_pre_xcodebuild.sh')

    expect(post).toMatch(/^#!/)
    expect(pre).toMatch(/^#!/)
    expect(post).toMatch(/^set -euo pipefail$/m)
    expect(pre).toMatch(/^set -euo pipefail$/m)

    expect(post).toMatch(/SCRIPT_DIR="\$\(cd "\$\(dirname "\$\{BASH_SOURCE\[0\]\}"\)" && pwd\)"/)
    expect(pre).toMatch(/SCRIPT_DIR="\$\(cd "\$\(dirname "\$\{BASH_SOURCE\[0\]\}"\)" && pwd\)"/)
    expect(post).toMatch(/\. "\$\{SCRIPT_DIR\}\/common\.sh"/)
    expect(pre).toMatch(/\. "\$\{SCRIPT_DIR\}\/common\.sh"/)

    expect(common).toMatch(/DAYSPRING_NODE_VERSION="\$\{DAYSPRING_NODE_VERSION:-20\}"/)
    expect(common).toMatch(/aarch64-apple-ios/)
    expect(common).toMatch(/npm install --no-audit --no-fund/)
    expect(common).toMatch(/scripts\/ios-postinit\.sh/)
    expect(common).toMatch(/pod install/)

    expect(post).toMatch(/dayspring_install_node/)
    expect(post).toMatch(/dayspring_install_rust/)
    expect(post).toMatch(/dayspring_npm_install/)
    expect(post).toMatch(/dayspring_pod_install_if_used/)
    expect(post).toMatch(/dayspring_ios_postinit/)
    expect(stripComments(post)).not.toMatch(/tauri ios init/)

    expect(pre).toMatch(/dayspring_ensure_node/)
    expect(pre).toMatch(/dayspring_ensure_rust/)
    expect(pre).toMatch(/dayspring_export_web_env/)
    expect(pre).toMatch(/dayspring_persist_toolchain_path/)
  })

  it('requires the Xcode Cloud web-build env vars and treats the anon key as secret', () => {
    const common = readScript('common.sh')
    for (const name of [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'VITE_API_BASE_URL',
      'VITE_RELEASE_CHANNEL',
      'APPLE_DEVELOPMENT_TEAM',
    ]) {
      expect(common, `required env ${name}`).toContain(name)
    }
    expect(common).toMatch(/VITE_RELEASE_CHANNEL must be 'appstore'/)
    expect(common).toContain('"$name" = "VITE_SUPABASE_ANON_KEY"')
    expect(common).toMatch(/Never print secret/)
  })

  it('leaves entitlements and the GitHub iOS workflow untouched', () => {
    const entitlements = readFileSync(
      join(ROOT, 'src-tauri/gen/apple/app_iOS/app_iOS.entitlements'),
      'utf8',
    )
    const pbx = readFileSync(join(ROOT, 'src-tauri/gen/apple/app.xcodeproj/project.pbxproj'), 'utf8')
    expect(pbx).toMatch(/CODE_SIGN_ENTITLEMENTS = app_iOS\/app_iOS\.entitlements;/)
    expect(pbx).toMatch(/PRODUCT_BUNDLE_IDENTIFIER = com\.phillipchan\.dayspring;/)
    expect(entitlements).toMatch(/<!DOCTYPE plist/)

    const workflow = readFileSync(join(ROOT, '.github/workflows/ios-release.yml'), 'utf8')
    expect(workflow).toMatch(/tauri ios init/)
    expect(workflow).toMatch(/scripts\/ios-postinit\.sh/)
    expect(workflow).toMatch(/VITE_RELEASE_CHANNEL: appstore/)
  })
})
