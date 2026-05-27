#!/usr/bin/env bash
# Regenerate the JS state machine + Graphviz state chart for every game from
# its .fjs spec. Run from the repo root: `npm run gen` (or `bash scripts/gen.sh`).
set -euo pipefail

FRAMEC="${FRAMEC:-framec}"
command -v "$FRAMEC" >/dev/null || { echo "framec not found (set FRAMEC=path)"; exit 1; }
shopt -s nullglob   # CCA (src/cca/*.fjs) may not exist yet during early phases

for fjs in src/games/*/*.fjs src/cca/*.fjs; do
  dir="$(dirname "$fjs")"
  base="$(basename "$fjs" .fjs)"
  echo "framec: $fjs"
  "$FRAMEC" -l javascript "$fjs" > "$dir/$base.machine.js"
  "$FRAMEC" -l graphviz   "$fjs" > "$dir/$base.dot"
done

echo "done — generated *.machine.js + *.dot"
