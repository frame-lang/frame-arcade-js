// Port of Godot tests/test_cca_pirate_rustling.gd — canon msg #127, the pirate
// "faint rustling noises" hint fires ~20% per turn while the pirate is stalking
// and the player is in a deep-cave room (canon LOC>=15). Exercised via the
// factored checkPirateRustle() helper (driving full checkPirateSteal would consume
// the pirate state on a successful steal). Distribution checks use ±5σ ranges, so
// the engine-RNG residual doesn't matter — only the ~20% rate.
import { file, expect, ok, makeDriver } from "./_harness";
import type { CcaDriver } from "../driver";

file("test_cca_pirate_rustling");

function forceStalking(d: CcaDriver): void {
  const a = d.machine();
  const here: number = a.player_room();
  for (const t of [a.gold, a.silver, a.diamonds]) {
    t.reappear(here);
    t.try_take(here);
  }
  a.player.take(a.GOLD_ID);
  a.player.take(a.SILVER_ID);
  a.player.take(a.DIAMONDS_ID);
  a.pirate.treasures_carried(a.player.inventory_size());
}

function countRustles(d: CcaDriver): number {
  return d.captured.filter((l) => l.includes("rustling noises")).length;
}

function inRange(label: string, actual: number, lo: number, hi: number): void {
  ok(`${label} = ${actual} (in [${lo}, ${hi}])`, actual >= lo && actual <= hi);
}

// Phase 1: pirate dormant — no rustling.
const d1 = makeDriver();
d1.machine().player.move_to(15);
for (let i = 0; i < 200; i++) d1.checkPirateRustle();
expect("dormant pirate emits 0 rustles in 200 ticks", countRustles(d1), 0);

// Phase 2: pirate stalking @ canon 15 — ~20% rate over 1000 rolls (±5σ → [137,263]).
const d2 = makeDriver();
forceStalking(d2);
d2.machine().player.move_to(15);
expect("setup: pirate stalking", d2.machine().pirate_state(), "stalking");
for (let i = 0; i < 1000; i++) d2.checkPirateRustle();
inRange("rustling fires (canon ~20%)", countRustles(d2), 137, 263);

// Phase 3: pirate stalking @ surface (canon 2) — no rustling.
const d3 = makeDriver();
forceStalking(d3);
d3.machine().player.move_to(2);
for (let i = 0; i < 200; i++) d3.checkPirateRustle();
expect("surface room emits 0 rustles", countRustles(d3), 0);

// Phase 4: post-steal Pirate state ($Vanished) suppresses rustling.
const d4 = makeDriver();
forceStalking(d4);
d4.machine().player.move_to(15);
for (let i = 0; i < 100; i++) if (d4.machine().pirate.try_steal()) break;
expect("pirate vanished after forced steal", d4.machine().pirate_state(), "vanished");
const preCount = countRustles(d4);
for (let i = 0; i < 200; i++) d4.checkPirateRustle();
expect("post-vanished state emits 0 rustles", countRustles(d4) - preCount, 0);
