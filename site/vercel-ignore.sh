#!/usr/bin/env bash
# Used by the dayspring-site Vercel project (Root Directory = site).
# Exit 0 → skip build. Exit 1 → build.
# The app and prototypes deploy as other Vercel projects; skip unless site/ changed.
#
# Skip (exit 0) only when the diff succeeds AND no site/ paths changed.
# Any missing SHA, unreadable object, or git failure → exit 1 (build).
# Do not use process substitution for `git diff`: a failed command inside
# `< <(...)` does not trip `set -e`, the loop sees no files, and we would
# skip the build (this canceled production deploys when
# VERCEL_GIT_PREVIOUS_SHA was absent from the shallow clone).

set -euo pipefail

PREV="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
CURRENT="${VERCEL_GIT_COMMIT_SHA:-HEAD}"

# rev-parse without --verify accepts a 40-char hex string that is not in
# the object database. Require a readable commit, or build.
if ! git rev-parse --verify --quiet "${PREV}^{commit}" >/dev/null; then
  exit 1
fi
if ! git rev-parse --verify --quiet "${CURRENT}^{commit}" >/dev/null; then
  exit 1
fi

if ! changed="$(git diff --name-only "$PREV" "$CURRENT")"; then
  exit 1
fi

while IFS= read -r file; do
  [ -z "$file" ] && continue
  case "$file" in
    site/*|site) exit 1 ;;
  esac
done <<< "$changed"

exit 0
