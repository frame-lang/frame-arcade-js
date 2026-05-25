#!/usr/bin/env bash
# Regenerate the JS state machine + Graphviz state chart for every game from
# its .frm spec. Run from the repo root: `npm run gen` (or `bash scripts/gen.sh`).
set -euo pipefail

FRAMEC="${FRAMEC:-framec}"
command -v "$FRAMEC" >/dev/null || { echo "framec not found (set FRAMEC=path)"; exit 1; }

for frm in src/games/*/*.frm; do
  dir="$(dirname "$frm")"
  base="$(basename "$frm" .frm)"
  echo "framec: $frm"
  "$FRAMEC" -l javascript "$frm" > "$dir/$base.machine.js"
  "$FRAMEC" -l graphviz   "$frm" > "$dir/$base.dot"
done

echo "done — generated *.machine.js + *.dot"
