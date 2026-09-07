#!/usr/bin/env bash
# Used by the dayspring-site Vercel project (Root Directory = site).
# Exit 0 → skip build. Exit 1 → build.
# The app and prototypes deploy as other Vercel projects; skip unless site/ changed.

set -euo pipefail

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
