#!/usr/bin/env bash
# Copy a local folder of adventure photos to the VPS static tree and merge
# basenames into app/data/adventureManifest.files.json.
#
# Prerequisites: rsync + SSH. No B2.
# Optional: ADVENTURE_RSYNC_SSH (default brain@147.182.240.24), category root on VPS
#           /home/brain/adventure-images/adventures/<slug>/
#
# Usage:
#   ./scripts/upload-adventure-images.sh ~/Photos/baja baja-racing

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST_NODE="$SCRIPT_DIR/update-adventure-manifest.mjs"

RSYNC_SSH="${ADVENTURE_RSYNC_SSH:-brain@147.182.240.24}"
VPS_ADVENTURE_ROOT="${ADVENTURE_VPS_ROOT:-/home/brain/adventure-images/adventures}"

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

if [[ "$SLUG" == *"/"* ]] || [[ -z "$SLUG" ]]; then
  echo "error: invalid category slug: $SLUG" >&2
  exit 1
fi

shopt -s nullglob
uploaded=()
for f in "$LOCAL_DIR"/*.{jpg,jpeg,png,gif,webp,JPG,JPEG,PNG,GIF,WEBP}; do
  [[ -f "$f" ]] || continue
  uploaded+=("$(basename "$f")")
done
shopt -u nullglob

if [[ ${#uploaded[@]} -eq 0 ]]; then
  echo "error: no image files found in $LOCAL_DIR" >&2
  exit 1
fi

DEST="${RSYNC_SSH}:${VPS_ADVENTURE_ROOT}/${SLUG}/"
echo "Rsync -> $DEST"
rsync -av "$LOCAL_DIR/" "$DEST"

node "$MANIFEST_NODE" "$SLUG" "${uploaded[@]}"
echo "Done. Commit app/data/adventureManifest.files.json if changed; deploy personal-site (and ensure VPS manifest matches if you edit only locally)."
