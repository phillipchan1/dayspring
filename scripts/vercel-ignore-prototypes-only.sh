#!/usr/bin/env bash
# Used by the main Dayspring Vercel project (repo root).
# Exit 0 → skip build. Exit 1 → build.
# Prototypes (dayspring-prototypes) and the marketing/help site (dayspring-site)
# deploy as other Vercel projects; skip when only they changed.
# Empty diff (env-only Redeploy / same SHA) must BUILD so Vite can bake new VITE_* envs.

set -euo pipefail

PREV="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
CURRENT="${VERCEL_GIT_COMMIT_SHA:-HEAD}"

if ! git rev-parse "$PREV" >/dev/null 2>&1; then
  exit 1
fi

mapfile -t files < <(git diff --name-only "$PREV" "$CURRENT")

# No file changes → build (Production env redeploy / force rebuild).
if [ "${#files[@]}" -eq 0 ] || [ -z "${files[0]:-}" ]; then
  exit 1
fi

for file in "${files[@]}"; do
  [ -z "$file" ] && continue
  case "$file" in
    prototypes/*|site/*|site) ;;
    *) exit 1 ;;
  esac
done

exit 0
