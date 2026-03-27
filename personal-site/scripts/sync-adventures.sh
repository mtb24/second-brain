#!/usr/bin/env bash
# Full-tree sync: local adventure staging → VPS static dir (Nginx serves /images/adventures/)
# then regenerate app/data/adventureManifest.files.json from the local staging tree.
#
# Prerequisites: rsync + SSH to the VPS; macOS sips for HEIC + optimization (local only).
# Optional env:
#   ADVENTURE_STAGING_ROOT — default ~/Sites/kendowney.com/images/adventures
#   ADVENTURE_RSYNC_DEST   — default brain@147.182.240.24:/home/brain/adventure-images/adventures/
#
# HEIC → JPEG, max edge 1600px, JPEG Q≈70 before rsync (see inline comments below).
#
# Usage (from personal-site/):
#   npm run sync-adventures
#   ./scripts/sync-adventures.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GENERATE_MANIFEST="$SCRIPT_DIR/generate-adventure-manifest.mjs"

DEFAULT_STAGING="${HOME}/Sites/kendowney.com/images/adventures"
STAGING="${ADVENTURE_STAGING_ROOT:-$DEFAULT_STAGING}"
STAGING="$(cd "$(dirname "$STAGING")" && pwd)/$(basename "$STAGING")"

RSYNC_DEST="${ADVENTURE_RSYNC_DEST:-brain@147.182.240.24:/home/brain/adventure-images/adventures/}"

if [[ ! -d "$STAGING" ]]; then
  echo "error: staging directory does not exist: $STAGING" >&2
  echo "Create it (see ~/Sites/kendowney.com/images/adventures/README.md) or set ADVENTURE_STAGING_ROOT." >&2
  exit 1
fi

echo "Staging:    $STAGING"
echo "Rsync dest: $RSYNC_DEST"

# HEIC → JPEG before sync (browsers cannot display HEIC). macOS sips only.
if command -v sips >/dev/null 2>&1; then
  while IFS= read -r -d '' heic; do
    jpg="${heic%.*}.jpg"
    if sips -s format jpeg "$heic" --out "$jpg" >/dev/null 2>&1; then
      rm -f "$heic"
    else
      echo "error: sips failed to convert HEIC: $heic" >&2
      exit 1
    fi
  done < <(find "$STAGING" -type f \( -iname '*.heic' \) -print0 2>/dev/null)
else
  if find "$STAGING" -type f -iname '*.heic' 2>/dev/null | head -1 | grep -q .; then
    echo "error: staging contains .heic/.HEIC files; sync-adventures.sh needs macOS sips to convert them to JPEG." >&2
    exit 1
  fi
fi

# Resize + compress (skip GIF — sips can break animation).
if command -v sips >/dev/null 2>&1; then
  while IFS= read -r -d '' img; do
    ext="${img##*.}"
    ext_lc=$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')
    [[ "$ext_lc" == "gif" ]] && continue
    if ! sips -Z 1600 "$img" >/dev/null 2>&1; then
      echo "warning: sips -Z 1600 failed, skipping: $img" >&2
      continue
    fi
    case "$ext_lc" in
      jpg|jpeg)
        sips -s formatOptions 70 "$img" >/dev/null 2>&1 \
          || echo "warning: sips formatOptions 70 failed: $img" >&2
        ;;
    esac
  done < <(
    find "$STAGING" -type f \( \
      -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \
    \) -print0 2>/dev/null
  )
else
  echo "warning: sips not found; images are not resized before rsync." >&2
fi

rsync -av --delete \
  --exclude='.DS_Store' \
  --exclude='*.heic' --exclude='*.HEIC' \
  "$STAGING/" \
  "$RSYNC_DEST"

node "$GENERATE_MANIFEST"
echo "Done. Commit app/data/adventureManifest.files.json if changed; then build/deploy the site."
