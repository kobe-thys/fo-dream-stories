#!/usr/bin/env bash
# Re-normalize the story tiles onto their correct Kenney surface height.
#
# Kenney reference rims (measured, do not re-derive):
#   grass / sand / stone  -> 0.200   (two layers: step at 0.100, surface at 0.200)
#   water / dirt          -> 0.100   (one layer)
#
# Every story tile was previously built at --surface=0.1, which left the land ones
# sitting a whole layer below the grass around them. Only --surface changes here;
# all other flags are kept identical to the build Kobe already approved, so the
# look does not shift.
set -u
cd "$(dirname "$0")/../.."
SRC=art/source/stories
OUT=public/models
COMMON="--match-water --palette-lock --rebuild-base"

run() { # <source> <dest> <surface> [extra]
  echo "═══ $2  surface=$3"
  timeout 2400 node --max-old-space-size=8192 scripts/tiles/normalize-tile.mjs \
    "$SRC/$1" "$OUT/$2" --surface="$3" $COMMON ${4:-} 2>&1 \
    | grep -E "trim base|regularity|^output|surface=|triangles=|OK —|FAILED"
}

# ── grass surface (0.200) ────────────────────────────────────────────────
run "Tinkle Trunk.glb"                 tinkle-trunk.glb                0.200
run "Syrup tree.glb"                   syrup-tree.glb                  0.200
run "Sun Cave.glb"                     sun-cave.glb                    0.200
run "Once in a lifetime portal.glb"    once-in-a-lifetime-portal.glb   0.200
run "Enid's kingdom.glb"               enid-kingdom.glb                0.200 --budget=60000
run "Raindrop castle.glb"              raindrop-castle.glb             0.200 --budget=60000

# ── stone surface — same height as grass, per Kobe ───────────────────────
run "Dragon Mountain.glb"              dragon-mountain.glb             0.200
run "Dragon Mountain on sea.glb"       dragon-mountain-sea.glb         0.200

# ── water surface (0.100) ────────────────────────────────────────────────
run "Griffon's shell.glb"              griffon-shell.glb               0.100 --budget=60000
run "Sunken Elven Ship.glb"            sunken-elven-ship.glb           0.100

echo
echo "═══ stripping generator lights (sources carry 4 each) ═══"
node scripts/tiles/strip-lights.mjs \
  "$OUT/tinkle-trunk.glb" "$OUT/syrup-tree.glb" "$OUT/sun-cave.glb" \
  "$OUT/once-in-a-lifetime-portal.glb" "$OUT/enid-kingdom.glb" "$OUT/raindrop-castle.glb" \
  "$OUT/dragon-mountain.glb" "$OUT/dragon-mountain-sea.glb" \
  "$OUT/griffon-shell.glb" "$OUT/sunken-elven-ship.glb"
