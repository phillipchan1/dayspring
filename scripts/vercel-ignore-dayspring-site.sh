#!/usr/bin/env bash
# For the dayspring-site Vercel project once its Root Directory is cleared to the
# repo root: clear Root Directory, then point Ignored Build Step at this script.
# Exit 0 → skip build. Exit 1 → build.
# Tolerates branches with no site/ at all (stable today), which is what breaks a
# Root Directory = site setup before any ignore command can run.

set -euo pipefail

if [ ! -d site ]; then
  exit 0
fi

PREV="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
CURRENT="${VERCEL_GIT_COMMIT_SHA:-HEAD}"

if ! git rev-parse "$PREV" >/dev/null 2>&1; then
  exit 1
fi

while IFS= read -r file; do
  [ -z "$file" ] && continue
  case "$file" in
    site/*|site) exit 1 ;;
  esac
done < <(git diff --name-only "$PREV" "$CURRENT")

exit 0
