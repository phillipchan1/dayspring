#!/usr/bin/env bash
# Xcode Cloud pre-xcodebuild: restore Node and Rust on PATH so Tauri's
# "Build Rust Code" phase (`npm run -- tauri ios xcode-script` — Rust
# compile + Vite web build) works during archive.
#
# Web build env comes from Xcode Cloud environment variables (same names
# as .github/workflows/ios-release.yml). Fail clearly if a required one
# is missing. Do not write CFBundleVersion / CURRENT_PROJECT_VERSION —
# Xcode Cloud assigns CI_BUILD_NUMBER when Next Build Number is set
# above the latest TestFlight build.
#
# This script runs in a FRESH shell. PATH, Node, and rustup from
# ci_post_clone.sh are not inherited. Source common.sh and call
# dayspring_setup_path / dayspring_ensure_node / dayspring_ensure_rust
# before any external tool.
#
# Never print secrets.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh disable=SC1091
. "${SCRIPT_DIR}/common.sh"

dayspring_setup_path

ROOT="$(dayspring_repo_root)"
cd "$ROOT"

dayspring_log "=== ci_pre_xcodebuild.sh ==="
dayspring_log "Repo root: ${ROOT}"
dayspring_log "Host: $(uname -s) $(uname -m)"
if [ -n "${CI_XCODE_CLOUD:-}" ]; then
  dayspring_log "CI_XCODE_CLOUD is set"
fi
if [ -n "${CI_XCODEBUILD_ACTION:-}" ]; then
  dayspring_log "CI_XCODEBUILD_ACTION=${CI_XCODEBUILD_ACTION}"
fi

dayspring_log "=== restore Node / Rust on PATH ==="
dayspring_ensure_node
dayspring_ensure_rust
dayspring_persist_toolchain_path

dayspring_log "=== tools on PATH ==="
dayspring_log_key_tools node npm npx cargo rustc rustup python3
dayspring_log_tool_path /usr/libexec/PlistBuddy
dayspring_log_tool_path "${HOME}/.cargo/bin/cargo"
dayspring_log_tool_path "${HOME}/.dayspring-ci/node/bin/node"

if ! dayspring_has_cmd node || ! dayspring_has_cmd npm; then
  dayspring_log "node/npm not on PATH; Tauri's Xcode build phase will fail with exit 127"
  exit 127
fi
if ! dayspring_has_cmd cargo || ! dayspring_has_cmd rustc; then
  dayspring_log "cargo/rustc not on PATH; Tauri's Xcode build phase will fail with exit 127"
  exit 127
fi

dayspring_log "=== web build env (Xcode Cloud env vars) ==="
dayspring_export_web_env "$ROOT"
dayspring_log_build_number_policy
dayspring_log "ci_pre_xcodebuild.sh finished"
