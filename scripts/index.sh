#!/usr/bin/env bash
set -euo pipefail
repo="${1:-.}"
test -d "$repo/.git" || { printf 'not a Git repository: %s\n' "$repo" >&2; exit 1; }
git -C "$repo" ls-files -s
