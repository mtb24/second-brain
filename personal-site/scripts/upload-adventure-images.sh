#!/usr/bin/env bash
# Upload local adventure photos to Backblaze B2 and merge filenames into
# app/data/adventureManifest.files.json.
#
# Prerequisites: b2 CLI (e.g. pip install b2), credentials in env.
# Env (see BRAIN.md): B2_KEY_ID, B2_APP_KEY, optional B2_BUCKET_NAME, B2_PUBLIC_URL.
#
# Usage:
#   ./scripts/upload-adventure-images.sh ~/Photos/baja baja-racing

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST_NODE="$SCRIPT_DIR/update-adventure-manifest.mjs"

if [[ $# -lt 2 ]]; then
  echo "usage: $0 <local-folder> <category-slug>" >&2
  exit 1
fi

LOCAL_DIR="${1%/}"
SLUG="$2"

if [[ ! -d "$LOCAL_DIR" ]]; then
  echo "error: not a directory: $LOCAL_DIR" >&2
  exit 1
fi

# shellcheck disable=SC1090
for envfile in "$SITE_ROOT/../.env" "$SITE_ROOT/.env"; do
  if [[ -f "$envfile" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$envfile"
    set +a
    break
  fi
done

if ! command -v b2 >/dev/null 2>&1; then
  echo "error: b2 CLI not found. Install: pip install b2  (then ensure b2 is on PATH)" >&2
  exit 1
fi

: "${B2_KEY_ID:?Set B2_KEY_ID (see BRAIN.md)}"
: "${B2_APP_KEY:?Set B2_APP_KEY (see BRAIN.md)}"

BUCKET="${B2_BUCKET_NAME:-kendowney-assets}"

b2 authorize-account "$B2_KEY_ID" "$B2_APP_KEY" >/dev/null

shopt -s nullglob
uploaded=()
for f in "$LOCAL_DIR"/*.{jpg,jpeg,png,gif,webp,JPG,JPEG,PNG,GIF,WEBP}; do
  [[ -f "$f" ]] || continue
  base="$(basename "$f")"
  b2_key="adventures/${SLUG}/${base}"
  echo "Uploading $base -> $BUCKET/$b2_key"
  b2 upload-file --contentType auto "$BUCKET" "$f" "$b2_key"
  uploaded+=("$base")
done
shopt -u nullglob

if [[ ${#uploaded[@]} -eq 0 ]]; then
  echo "error: no image files found in $LOCAL_DIR" >&2
  exit 1
fi

node "$MANIFEST_NODE" "$SLUG" "${uploaded[@]}"
echo "Done. Rebuild or deploy the site so clients pick up new manifest URLs."
if [[ -n "${B2_PUBLIC_URL:-}" ]]; then
  echo "Friendly URL base (for reference): ${B2_PUBLIC_URL}/adventures/${SLUG}/<file>"
fi
