#!/usr/bin/env bash
# Xcode Cloud post-clone: install Node 20 and Rust stable + aarch64-apple-ios,
# npm install, pod install if the Podfile lists pods, then ios-postinit.sh
# (Info.plist keys, dayspring:// URL types, committed icons).
#
# Mirrors every pre-archive step in .github/workflows/ios-release.yml that
# is not signing, version stamping, or uploading (Xcode Cloud handles those).
# Does not run `tauri ios init` — src-tauri/gen/apple/app.xcodeproj is
# committed; init would regenerate it.
#
# Apple runs this from src-tauri/gen/apple/ci_scripts/ after the clone and
# before it resolves packages.
# https://developer.apple.com/documentation/xcode/writing-custom-build-scripts
#
# This script runs in a FRESH shell. Later scripts (ci_pre_xcodebuild.sh)
# do not inherit PATH. Install Node into $HOME/.dayspring-ci/node and Rust
# into $HOME/.cargo so those shells can find them.
#
# Never print secrets. Never set CFBundleVersion / CURRENT_PROJECT_VERSION —
# Xcode Cloud's CI_BUILD_NUMBER / Next Build Number must win.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh disable=SC1091
. "${SCRIPT_DIR}/common.sh"

dayspring_setup_path

ROOT="$(dayspring_repo_root)"
cd "$ROOT"

dayspring_log "=== ci_post_clone.sh ==="
dayspring_log "Repo root: ${ROOT}"
dayspring_log "Host: $(uname -s) $(uname -m)"
if [ -n "${CI_XCODE_CLOUD:-}" ]; then
  dayspring_log "CI_XCODE_CLOUD is set"
fi
if [ -n "${CI_XCODEBUILD_ACTION:-}" ]; then
  dayspring_log "CI_XCODEBUILD_ACTION=${CI_XCODEBUILD_ACTION}"
fi

dayspring_log "=== required Xcode Cloud env vars ==="
dayspring_require_web_env

dayspring_log "=== tools on PATH (before installs) ==="
dayspring_log_key_tools node npm npx cargo rustc rustup python3 brew curl tar git
dayspring_log_tool_path /usr/libexec/PlistBuddy

dayspring_log "=== step 1/5: install Node 20 ==="
dayspring_ensure_node
dayspring_install_node
dayspring_log "node $(node -v)  npm $(npm -v)"
dayspring_log_tool node
dayspring_log_tool npm
dayspring_log_tool npx

dayspring_log "=== step 2/5: install Rust stable + aarch64-apple-ios ==="
dayspring_install_rust

dayspring_log "=== step 3/5: npm install ==="
dayspring_npm_install "$ROOT"

dayspring_log "=== step 4/5: pod install if used ==="
dayspring_pod_install_if_used "$ROOT"

dayspring_log "=== step 5/5: scripts/ios-postinit.sh ==="
dayspring_ios_postinit "$ROOT"

dayspring_persist_toolchain_path
dayspring_log_build_number_policy
dayspring_log "ci_post_clone.sh finished"
