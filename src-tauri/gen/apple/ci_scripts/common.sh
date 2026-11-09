#!/usr/bin/env bash
# Shared helpers for Xcode Cloud custom scripts (src-tauri/gen/apple/ci_scripts/).
# Sourced by ci_post_clone.sh and ci_pre_xcodebuild.sh. Not an Xcode Cloud
# entry point. Never print secret values — names and booleans only.
#
# Each Xcode Cloud script runs in a fresh shell. Nothing post-clone exported
# (PATH, Node, rustup) is inherited. Every entry-point script must source this
# file from its own directory, call dayspring_setup_path, and restore Node/Rust
# before invoking node/npm/cargo. The Xcode "Build Rust Code" phase
# (`npm run -- tauri ios xcode-script`) needs those tools on PATH too, so
# dayspring_persist_toolchain_path copies them into a directory already on
# the stock PATH.
#
# Do not write CFBundleVersion or CURRENT_PROJECT_VERSION. Xcode Cloud's
# CI_BUILD_NUMBER / Next Build Number must win.
#
# Node major matches .github/workflows/ios-release.yml (setup-node: 20).
# npm install (not npm ci) matches that workflow: vite 8 / rolldown pulls
# platform-specific optional deps that make a strict lockfile check brittle.

DAYSPRING_NODE_VERSION="${DAYSPRING_NODE_VERSION:-20}"
DAYSPRING_NODE_HOME="${DAYSPRING_NODE_HOME:-${HOME}/.dayspring-ci/node}"

DAYSPRING_REQUIRED_ENV_VARS="VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY VITE_API_BASE_URL VITE_RELEASE_CHANNEL APPLE_DEVELOPMENT_TEAM"

dayspring_log() {
  # stderr so command substitutions stay clean.
  printf '[dayspring-ci] %s\n' "$*" >&2
}

dayspring_scripts_dir() {
  cd "$(dirname "${BASH_SOURCE[0]}")" && pwd
}

# Repo root: Xcode Cloud sets CI_PRIMARY_REPOSITORY_PATH. Fallback walks up
# from src-tauri/gen/apple/ci_scripts/ (this file lives four levels below).
dayspring_repo_root() {
  if [ -n "${CI_PRIMARY_REPOSITORY_PATH:-}" ] && [ -f "${CI_PRIMARY_REPOSITORY_PATH}/package.json" ]; then
    printf '%s\n' "$CI_PRIMARY_REPOSITORY_PATH"
    return 0
  fi
  local here
  here="$(dayspring_scripts_dir)"
  printf '%s\n' "$(cd "${here}/../../../.." && pwd)"
}

dayspring_is_darwin() {
  [ "$(uname -s)" = "Darwin" ]
}

dayspring_has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

dayspring_log_tool() {
  local cmd="$1"
  local resolved=""
  resolved="$(command -v "$cmd" 2>/dev/null)" || resolved=""
  if [ -n "$resolved" ]; then
    dayspring_log "command -v ${cmd}: ${resolved}"
  else
    dayspring_log "command -v ${cmd}: not found"
  fi
}

dayspring_log_tool_path() {
  local path="$1"
  if [ -x "$path" ]; then
    dayspring_log "tool ${path}: present"
  else
    dayspring_log "tool ${path}: not found"
  fi
}

dayspring_log_key_tools() {
  local cmd
  dayspring_log "PATH=${PATH:-}"
  for cmd in "$@"; do
    dayspring_log_tool "$cmd"
  done
}

dayspring_try_node_prefix() {
  local prefix="$1"
  if [ -x "${prefix}/bin/node" ]; then
    export PATH="${prefix}/bin:${PATH}"
    hash -r 2>/dev/null || true
    dayspring_log "ensure_node: found ${prefix}/bin/node ($(node -v))"
    return 0
  fi
  dayspring_log "ensure_node: no node at ${prefix}/bin/node"
  return 1
}

# Idempotent. Puts cargo, Homebrew, /usr/local, and post-clone Node bins
# ahead of PATH. Safe to call from every script; required because each
# Xcode Cloud script starts with a stock PATH. Avoids process substitution
# so macOS /bin/bash 3.2 (Xcode Cloud) can source this file.
dayspring_setup_path() {
  local root extra
  if [ "${DAYSPRING_PATH_READY:-}" = "1" ]; then
    return 0
  fi
  root="$(dayspring_repo_root)"
  extra="${HOME}/.cargo/bin"
  extra="${extra}:${DAYSPRING_NODE_HOME}/bin:${HOME}/.dayspring-ci/node/bin:${root}/.dayspring-ci/node/bin"
  extra="${extra}:/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin"
  extra="${extra}:${HOME}/.local/bin"
  export PATH="${extra}:${PATH:-}"
  if [ -f "${HOME}/.cargo/env" ]; then
    # shellcheck disable=SC1091
    . "${HOME}/.cargo/env"
  fi
  export DAYSPRING_PATH_READY=1
  hash -r 2>/dev/null || true
}

dayspring_node_major() {
  if ! dayspring_has_cmd node; then
    return 1
  fi
  node -p "process.versions.node.split('.')[0]"
}

dayspring_node_matches() {
  local major
  major="$(dayspring_node_major)" || return 1
  [ "$major" = "$DAYSPRING_NODE_VERSION" ]
}

dayspring_try_nvm() {
  local nvm_dir="${NVM_DIR:-${HOME}/.nvm}"
  if [ ! -s "${nvm_dir}/nvm.sh" ]; then
    return 1
  fi
  dayspring_log "Installing Node ${DAYSPRING_NODE_VERSION} with nvm"
  set +u
  # nvm.sh references unset variables.
  # shellcheck disable=SC1091
  . "${nvm_dir}/nvm.sh"
  set -u
  nvm install "$DAYSPRING_NODE_VERSION"
  nvm use "$DAYSPRING_NODE_VERSION"
}

dayspring_install_node_tarball() {
  local os arch sums tarball url tmp inner dest
  case "$(uname -s)" in
    Darwin) os=darwin ;;
    Linux) os=linux ;;
    *)
      dayspring_log "No official Node tarball for OS $(uname -s)"
      return 1
      ;;
  esac
  case "$(uname -m)" in
    x86_64) arch=x64 ;;
    arm64|aarch64) arch=arm64 ;;
    *)
      dayspring_log "No official Node tarball for arch $(uname -m)"
      return 1
      ;;
  esac

  dayspring_log "Resolving official Node ${DAYSPRING_NODE_VERSION} tarball (${os}-${arch})"
  sums="$(curl -fsSL "https://nodejs.org/dist/latest-v${DAYSPRING_NODE_VERSION}.x/SHASUMS256.txt")"
  tarball="$(printf '%s\n' "$sums" | awk -v os="$os" -v arch="$arch" '
    $2 ~ ("^node-v[0-9.]+-" os "-" arch "\\.tar\\.gz$") { print $2; exit }
  ')"
  if [ -z "$tarball" ]; then
    dayspring_log "Could not find node-v${DAYSPRING_NODE_VERSION}*${os}-${arch}.tar.gz in SHASUMS256.txt"
    return 1
  fi

  url="https://nodejs.org/dist/latest-v${DAYSPRING_NODE_VERSION}.x/${tarball}"
  dest="${DAYSPRING_NODE_HOME}"
  tmp="$(mktemp -d "${TMPDIR:-/tmp}/dayspring-node.XXXXXX")"
  dayspring_log "Downloading ${tarball}"
  curl -fsSL "$url" | tar -xz -C "$tmp"
  inner="$(find "$tmp" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  if [ -z "$inner" ]; then
    dayspring_log "Node tarball extracted empty"
    rm -rf "$tmp"
    return 1
  fi
  mkdir -p "$(dirname "$dest")"
  rm -rf "$dest"
  mv "$inner" "$dest"
  rm -rf "$tmp"
  export PATH="${dest}/bin:${PATH}"
  hash -r 2>/dev/null || true
}

dayspring_try_brew_node() {
  local prefix
  if ! dayspring_is_darwin; then
    return 1
  fi
  if ! dayspring_has_cmd brew; then
    return 1
  fi
  export HOMEBREW_NO_AUTO_UPDATE=1
  export HOMEBREW_NO_INSTALL_CLEANUP=1
  dayspring_log "Installing Node ${DAYSPRING_NODE_VERSION} with Homebrew"
  if brew install "node@${DAYSPRING_NODE_VERSION}"; then
    prefix="$(brew --prefix "node@${DAYSPRING_NODE_VERSION}")"
    export PATH="${prefix}/bin:${PATH}"
    hash -r 2>/dev/null || true
    return 0
  fi
  if brew install node; then
    prefix="$(brew --prefix)"
    export PATH="${prefix}/bin:${PATH}"
    hash -r 2>/dev/null || true
    return 0
  fi
  return 1
}

dayspring_install_node() {
  dayspring_setup_path
  dayspring_log_tool node
  dayspring_log_tool npm
  dayspring_log_tool npx
  dayspring_log_tool brew
  dayspring_log_tool curl
  if dayspring_node_matches; then
    dayspring_log "Using existing Node $(node -v) ($(command -v node))"
    return 0
  fi
  if dayspring_has_cmd node; then
    dayspring_log "Found Node $(node -v); need major ${DAYSPRING_NODE_VERSION}"
  else
    dayspring_log "Node not on PATH; installing ${DAYSPRING_NODE_VERSION}"
  fi

  if dayspring_try_nvm && dayspring_node_matches; then
    dayspring_log "Node $(node -v) via nvm"
    return 0
  fi
  if dayspring_install_node_tarball && dayspring_node_matches; then
    dayspring_log "Node $(node -v) via official tarball"
    return 0
  fi
  if dayspring_try_brew_node && dayspring_node_matches; then
    dayspring_log "Node $(node -v) via Homebrew"
    return 0
  fi

  dayspring_log "Failed to install Node ${DAYSPRING_NODE_VERSION}"
  return 1
}

# Idempotent. If node is already on PATH, return. Otherwise try the
# post-clone tarball dir, then brew, then the official tarball.
dayspring_ensure_node() {
  local root
  dayspring_setup_path
  if dayspring_has_cmd node; then
    dayspring_log "ensure_node: using $(command -v node) ($(node -v))"
    return 0
  fi

  root="$(dayspring_repo_root)"
  dayspring_log "ensure_node: node not on PATH; trying post-clone install locations"
  if dayspring_try_node_prefix "$DAYSPRING_NODE_HOME"; then
    return 0
  fi
  if dayspring_try_node_prefix "${HOME}/.dayspring-ci/node"; then
    return 0
  fi
  if dayspring_try_node_prefix "${root}/.dayspring-ci/node"; then
    return 0
  fi

  dayspring_log "ensure_node: trying Homebrew"
  dayspring_log_tool brew
  if dayspring_try_brew_node && dayspring_has_cmd node; then
    dayspring_log "ensure_node: Node $(node -v) via Homebrew"
    return 0
  fi

  dayspring_log "ensure_node: trying official tarball fallback"
  if dayspring_install_node_tarball && dayspring_has_cmd node; then
    dayspring_log "ensure_node: Node $(node -v) via official tarball"
    return 0
  fi

  dayspring_log "ensure_node: node still not found (this would be exit 127)"
  dayspring_log_tool node
  dayspring_log_tool npm
  dayspring_log_tool npx
  return 1
}

dayspring_install_rust() {
  dayspring_setup_path
  if ! dayspring_has_cmd rustup || ! dayspring_has_cmd cargo || ! dayspring_has_cmd rustc; then
    dayspring_log "Installing rustup (stable, minimal profile)"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal
    if [ -f "${HOME}/.cargo/env" ]; then
      # shellcheck disable=SC1091
      . "${HOME}/.cargo/env"
    fi
    export PATH="${HOME}/.cargo/bin:${PATH}"
    hash -r 2>/dev/null || true
  else
    dayspring_log "Using existing Rust $(rustc --version) ($(command -v rustc))"
  fi
  if ! dayspring_has_cmd rustup; then
    dayspring_log "rustup not found after install"
    return 1
  fi
  dayspring_log "Adding rust target aarch64-apple-ios"
  rustup target add aarch64-apple-ios
  dayspring_log_tool rustc
  dayspring_log_tool cargo
  dayspring_log_tool rustup
}

# Restore rustup from the post-clone install. Does not re-download if cargo
# is already on PATH after dayspring_setup_path.
dayspring_ensure_rust() {
  dayspring_setup_path
  if [ -f "${HOME}/.cargo/env" ]; then
    # shellcheck disable=SC1091
    . "${HOME}/.cargo/env"
  fi
  export PATH="${HOME}/.cargo/bin:${PATH}"
  hash -r 2>/dev/null || true
  if dayspring_has_cmd cargo && dayspring_has_cmd rustc; then
    dayspring_log "ensure_rust: using $(command -v rustc) ($(rustc --version))"
    return 0
  fi
  dayspring_log "ensure_rust: cargo/rustc missing; installing"
  dayspring_install_rust
}

# Copy node/npm/cargo onto a directory that stock /bin/sh PATH already
# includes, so Tauri's Xcode "Build Rust Code" phase can find them even
# if this script's exports are not inherited.
dayspring_persist_toolchain_path() {
  local dest cmd src name
  dest="/usr/local/bin"
  if [ ! -d "$dest" ] || [ ! -w "$dest" ]; then
    dest="${HOME}/.local/bin"
    mkdir -p "$dest"
    export PATH="${dest}:${PATH}"
  fi
  for cmd in node npm npx cargo rustc rustup; do
    src="$(command -v "$cmd" 2>/dev/null)" || src=""
    if [ -z "$src" ]; then
      continue
    fi
    name="$(basename "$src")"
    if [ -e "${dest}/${name}" ]; then
      continue
    fi
    ln -sf "$src" "${dest}/${name}" || true
    dayspring_log "persist: ${src} -> ${dest}/${name}"
  done
}

dayspring_env_is_set() {
  local name="$1"
  eval "[ -n \"\${${name}:-}\" ]"
}

# Fail clearly, naming every missing variable. Never print secret values.
# VITE_RELEASE_CHANNEL must be appstore: the TestFlight IPA is the App Store
# binary if it is promoted in ASC (same rule as ios-release.yml).
dayspring_require_web_env() {
  local name missing=""
  for name in $DAYSPRING_REQUIRED_ENV_VARS; do
    if dayspring_env_is_set "$name"; then
      if [ "$name" = "VITE_SUPABASE_ANON_KEY" ]; then
        dayspring_log "${name}: set"
      else
        eval "dayspring_log \"${name}=\${${name}}\""
      fi
    else
      dayspring_log "${name}: MISSING"
      if [ -n "$missing" ]; then
        missing="${missing} ${name}"
      else
        missing="$name"
      fi
    fi
  done
  if [ -n "$missing" ]; then
    dayspring_log "Missing required Xcode Cloud environment variable(s): ${missing}"
    dayspring_log "Set them in App Store Connect → the app → Xcode Cloud → the workflow → Environment."
    dayspring_log "See docs/IOS.md § Xcode Cloud. Values match .github/workflows/ios-release.yml."
    return 1
  fi
  if [ "${VITE_RELEASE_CHANNEL}" != "appstore" ]; then
    dayspring_log "VITE_RELEASE_CHANNEL must be 'appstore' for a TestFlight/App Store archive (got: ${VITE_RELEASE_CHANNEL})."
    dayspring_log "A TestFlight IPA promoted to App Review is the same binary — never stamp it as alpha."
    return 1
  fi
}

# Export the web-build vars and write a gitignored Vite env file so the
# production frontend build sees them even if xcodebuild strips this shell.
dayspring_export_web_env() {
  local root="$1"
  local env_file="${root}/.env.production.local"
  dayspring_require_web_env || return 1
  export VITE_SUPABASE_URL
  export VITE_SUPABASE_ANON_KEY
  export VITE_API_BASE_URL
  export VITE_RELEASE_CHANNEL
  export APPLE_DEVELOPMENT_TEAM
  umask 077
  {
    printf 'VITE_SUPABASE_URL=%s\n' "${VITE_SUPABASE_URL}"
    printf 'VITE_SUPABASE_ANON_KEY=%s\n' "${VITE_SUPABASE_ANON_KEY}"
    printf 'VITE_API_BASE_URL=%s\n' "${VITE_API_BASE_URL}"
    printf 'VITE_RELEASE_CHANNEL=%s\n' "${VITE_RELEASE_CHANNEL}"
  } > "$env_file"
  dayspring_log "Wrote ${env_file} (gitignored) for the Vite production build"
}

dayspring_npm_install() {
  local root="$1"
  dayspring_ensure_node
  dayspring_log_tool npm
  dayspring_log "npm install --no-audit --no-fund ($(command -v npm))"
  (cd "$root" && npm install --no-audit --no-fund)
}

# Only run CocoaPods when the Podfile actually lists pods. The committed
# Podfile is a Tauri stub (empty targets). `pod install` on that stub would
# create app.xcworkspace, and Xcode Cloud archives app.xcodeproj.
dayspring_pod_install_if_used() {
  local root="$1"
  local podfile="${root}/src-tauri/gen/apple/Podfile"
  if [ ! -f "$podfile" ]; then
    dayspring_log "No Podfile; skipping pod install"
    return 0
  fi
  if ! grep -qE '^[[:space:]]*pod[[:space:]]' "$podfile"; then
    dayspring_log "Podfile has no pods; skipping pod install"
    return 0
  fi
  if [ "${DAYSPRING_SKIP_IOS_NATIVE:-}" = "1" ]; then
    dayspring_log "Podfile lists pods; skipping pod install (DAYSPRING_SKIP_IOS_NATIVE=1)"
    return 0
  fi
  if ! dayspring_has_cmd pod; then
    dayspring_log "Podfile lists pods but pod is not installed"
    return 1
  fi
  dayspring_log "pod install (${podfile})"
  (cd "$(dirname "$podfile")" && pod install)
}

# Restores Info.plist keys, dayspring:// URL types, and the committed icon
# catalog. Same script the GH iOS workflow runs after init. We do not run
# `tauri ios init` here: the Xcode project is committed and Xcode Cloud
# archives it; init would regenerate pbxproj / entitlements.
dayspring_ios_postinit() {
  local root="$1"
  local script="${root}/scripts/ios-postinit.sh"
  if [ ! -f "$script" ]; then
    dayspring_log "Missing ${script}"
    return 1
  fi
  dayspring_log "bash scripts/ios-postinit.sh"
  bash "$script"
}

dayspring_log_build_number_policy() {
  local ci_build="${CI_BUILD_NUMBER:-unset}"
  dayspring_log "CI_BUILD_NUMBER=${ci_build}"
  dayspring_log "CFBundleVersion / CURRENT_PROJECT_VERSION are left to Xcode Cloud (set Next Build Number > latest TestFlight)."
}

# Source-time PATH so a script that forgets dayspring_setup_path still finds
# cargo and a post-clone Node tarball. Entry-point scripts also call it.
dayspring_setup_path
