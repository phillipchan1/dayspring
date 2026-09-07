#!/usr/bin/env bash
# Used by the dayspring-prototypes Vercel project (root: prototypes/).
# Exit 0 → skip build. Exit 1 → build.
# Only rebuild when something under prototypes/ changed.

set -euo pipefail

PREV="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
CURRENT="${VERCEL_GIT_COMMIT_SHA:-HEAD}"

if ! git rev-parse "$PREV" >/dev/null 2>&1; then
  exit 1
fi

if git diff --name-only "$PREV" "$CURRENT" | grep -q '^prototypes/'; then
  exit 1
fi

exit 0
