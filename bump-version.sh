#!/usr/bin/env bash
# bump-version.sh — bump the extension version everywhere, commit, tag, and
# (optionally) push to trigger the GitHub release workflow (.github/workflows/release.yml).
#
# The version lives in two manifests (src/chrome_manifest.json,
# src/firefox_manifest.json) and is referenced by the git-tag examples in
# README.md. This keeps all three in sync.
#
# Usage:
#   ./bump-version.sh                 # auto-increment the last version segment (x.y.z.N -> x.y.z.N+1)
#   ./bump-version.sh 4.3.82.0        # set an explicit version
#   ./bump-version.sh --dry-run       # show what would change, touch nothing
#   ./bump-version.sh --push          # after bump+commit+tag, push branch + tag to origin
#   ./bump-version.sh 4.3.82.0 --push # explicit version and push
#
# Notes:
#   - Chrome allows up to 4 dot-separated integers, each 0..65535.
#   - Pushing is outward-facing: it publishes the source and, via the tag,
#     triggers a public GitHub Release. It is never done unless you pass --push.
#   - Portable sed (works on macOS/BSD and Linux) via temp files.

set -euo pipefail

repo="$(cd "$(dirname "$0")" && pwd)"
cd "$repo"

CHROME_MANIFEST="src/chrome_manifest.json"
FIREFOX_MANIFEST="src/firefox_manifest.json"
README="README.md"

DRY_RUN=0
PUSH=0
NEWVER=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --push)    PUSH=1 ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    --*)       echo "Unknown flag: $arg" >&2; exit 1 ;;
    *)         NEWVER="$arg" ;;
  esac
done

# --- Read current version from the chrome manifest (source of truth) ---
CURVER="$(grep -E '"version"[[:space:]]*:' "$CHROME_MANIFEST" \
          | head -n1 | grep -oE '[0-9]+(\.[0-9]+){1,3}')"
[ -n "$CURVER" ] || { echo "Could not read current version from $CHROME_MANIFEST" >&2; exit 1; }

# --- Determine the new version ---
if [ -z "$NEWVER" ]; then
  base="${CURVER%.*}"; last="${CURVER##*.}"
  NEWVER="${base}.$((last + 1))"
fi

echo "$NEWVER" | grep -qE '^[0-9]+(\.[0-9]+){0,3}$' \
  || { echo "Invalid version: '$NEWVER' (expected up to 4 dot-separated integers)" >&2; exit 1; }

TAG="v$NEWVER"
echo "Version: $CURVER -> $NEWVER   (tag: $TAG)"

if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null 2>&1; then
  echo "Tag $TAG already exists — pick a different version." >&2
  exit 1
fi

# --- Rewrite helper: replace the value of the top-level "version" key ---
bump_manifest() {
  local f="$1" tmp
  tmp="$(mktemp)"
  # Anchor on leading whitespace so we never touch "manifest_version".
  sed -E "s/^([[:space:]]*\"version\"[[:space:]]*:[[:space:]]*\")[0-9.]+(\".*)$/\1${NEWVER}\2/" \
    "$f" > "$tmp"
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "  would update $f:"; grep -nE '"version"[[:space:]]*:' "$tmp" | head -n1 | sed 's/^/    /'
    rm -f "$tmp"
  else
    mv "$tmp" "$f"
    grep -q "\"version\": \"$NEWVER\"" "$f" || { echo "Failed to update $f" >&2; exit 1; }
    echo "  updated $f"
  fi
}

bump_manifest "$CHROME_MANIFEST"
bump_manifest "$FIREFOX_MANIFEST"

# --- Sync the git-tag examples in the README (vCURVER -> vNEWVER) ---
if grep -q "v$CURVER" "$README" 2>/dev/null; then
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "  would update $README references v$CURVER -> v$NEWVER"
  else
    tmp="$(mktemp)"; sed "s/v$CURVER/v$NEWVER/g" "$README" > "$tmp"; mv "$tmp" "$README"
    echo "  updated $README"
  fi
fi

if [ "$DRY_RUN" -eq 1 ]; then
  echo "Dry run — nothing committed, tagged, or pushed."
  exit 0
fi

# --- Commit + tag ---
git add "$CHROME_MANIFEST" "$FIREFOX_MANIFEST" "$README"
git commit -m "Bump version to $NEWVER" >/dev/null
echo "Committed."
git tag "$TAG"
echo "Tagged $TAG."

# --- Push (only with --push) ---
branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$PUSH" -eq 1 ]; then
  echo "Pushing $branch and $TAG to origin..."
  git push origin "$branch"
  git push origin "$TAG"
  echo "Pushed. The release workflow will build and publish for tag $TAG."
else
  echo
  echo "Not pushed. To trigger the release workflow, run:"
  echo "    git push origin $branch && git push origin $TAG"
fi
