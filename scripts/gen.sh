#!/usr/bin/env bash
# Regenerate the JS state machine + Graphviz state chart for every game from
# its .fjs spec. Run from the repo root: `npm run gen` (or `bash scripts/gen.sh`).
set -euo pipefail

# Default to the authoritative local dev build (~/.frame/local/bin/framec,
# X.Y.Z.N) so `npm run gen`/tests never silently drift onto a stale PATH
# framec (e.g. a crates.io ~/.cargo/bin install). Override with FRAMEC=<path>.
FRAMEC="${FRAMEC:-$HOME/.frame/local/bin/framec}"
command -v "$FRAMEC" >/dev/null 2>&1 || [ -x "$FRAMEC" ] || { echo "framec not found (set FRAMEC=path)"; exit 1; }
shopt -s nullglob   # CCA (src/cca/*.fjs) may not exist yet during early phases

for fjs in src/games/*/*.fjs src/cca/*.fjs; do
  dir="$(dirname "$fjs")"
  base="$(basename "$fjs" .fjs)"
  echo "framec: $fjs"
  "$FRAMEC" -l javascript "$fjs" > "$dir/$base.machine.js"
  "$FRAMEC" -l graphviz   "$fjs" > "$dir/$base.dot"
done

echo "done — generated *.machine.js + *.dot"
