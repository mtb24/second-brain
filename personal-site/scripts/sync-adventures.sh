#!/usr/bin/env bash
# Full-tree sync: local adventure staging → Backblaze B2 (adventures/<category>/...)
# then regenerate app/data/adventureManifest.files.json from the local tree.
#
# Prerequisites: b2 CLI (pip install b2), B2_KEY_ID + B2_APP_KEY in env.
# Optional: B2_BUCKET_NAME (default kendowney-assets), ADVENTURE_STAGING_ROOT.
# HEIC: before sync, all .heic/.HEIC under staging are converted to .jpg via macOS
# sips and the HEIC originals are removed locally; b2 sync also excludes *.heic.
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

: "${B2_KEY_ID:?Set B2_KEY_ID (see personal-site/.env.example)}"
: "${B2_APP_KEY:?Set B2_APP_KEY (see personal-site/.env.example)}"

BUCKET="${B2_BUCKET_NAME:-kendowney-assets}"

if [[ ! -d "$STAGING" ]]; then
  echo "error: staging directory does not exist: $STAGING" >&2
  echo "Create it (see ~/Sites/kendowney.com/images/adventures/README.md) or set ADVENTURE_STAGING_ROOT." >&2
  exit 1
fi

echo "Staging:  $STAGING"
echo "B2 target: b2://${BUCKET}/adventures"

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

b2 account authorize "$B2_KEY_ID" "$B2_APP_KEY" >/dev/null

# Mirror local categories to B2; --delete removes remote files absent locally.
# Exclude junk so Finder metadata never lands in the bucket; exclude HEIC as a safety net.
b2 sync --delete \
  --exclude-regex '(.*\.DS_Store|.*\.[Hh][Ee][Ii][Cc])' \
  --allow-empty-source \
  "$STAGING" \
  "b2://${BUCKET}/adventures"

node "$GENERATE_MANIFEST"
echo "Done. Commit app/data/adventureManifest.files.json if changed; then build/deploy the site."
